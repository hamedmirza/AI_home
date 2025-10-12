import { dbService } from './database';
import { homeAssistantService } from './homeAssistant';

interface EnergySnapshot {
  timestamp: Date;
  totalPower: number;
  solarProduction: number;
  gridConsumption: number;
  batteryLevel: number;
  activeDevices: string[];
}

interface UsagePattern {
  timeOfDay: number;
  dayOfWeek: number;
  averagePower: number;
  peakPower: number;
  commonDevices: string[];
}

interface EnergySuggestion {
  type: 'cost_saving' | 'efficiency' | 'timing' | 'device_optimization';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedSavings: number;
  actions: Array<{
    deviceId: string;
    action: string;
    timing?: string;
  }>;
}

class EnergyPatternService {
  private learningInterval: number | null = null;
  private snapshotInterval: number | null = null;

  async startLearning(intervalMinutes: number = 15) {
    this.stopLearning();

    await this.captureEnergySnapshot();

    this.snapshotInterval = window.setInterval(async () => {
      try {
        await this.captureEnergySnapshot();
      } catch (error) {
        console.error('Error capturing energy snapshot:', error);
      }
    }, intervalMinutes * 60 * 1000);

    this.learningInterval = window.setInterval(async () => {
      try {
        await this.analyzeAndLearn();
      } catch (error) {
        console.error('Error in energy learning:', error);
      }
    }, 60 * 60 * 1000);

    console.log(`Energy learning started (snapshot every ${intervalMinutes}min, analysis every 1hr)`);
  }

  stopLearning() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
    if (this.learningInterval) {
      clearInterval(this.learningInterval);
      this.learningInterval = null;
    }
  }

  private async captureEnergySnapshot() {
    try {
      const entities = await dbService.getEntities();

      const powerSensors = entities.filter(e =>
        e.entity_id.includes('power') ||
        e.attributes?.unit_of_measurement?.toLowerCase().includes('w')
      );

      const solarSensors = entities.filter(e =>
        e.entity_id.includes('solar') && e.entity_id.includes('power')
      );

      const batterySensors = entities.filter(e =>
        e.entity_id.includes('battery') &&
        (e.entity_id.includes('level') || e.entity_id.includes('soc'))
      );

      const activeDevices = entities.filter(e =>
        (e.entity_id.startsWith('light.') ||
         e.entity_id.startsWith('switch.') ||
         e.entity_id.startsWith('climate.')) &&
        e.state === 'on'
      ).map(e => e.entity_id);

      const totalPower = powerSensors.reduce((sum, e) => {
        const value = parseFloat(e.state);
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

      const solarProduction = solarSensors.reduce((sum, e) => {
        const value = parseFloat(e.state);
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

      const batteryLevel = batterySensors.length > 0
        ? parseFloat(batterySensors[0].state) || 0
        : 0;

      const snapshot: EnergySnapshot = {
        timestamp: new Date(),
        totalPower,
        solarProduction,
        gridConsumption: Math.max(0, totalPower - solarProduction),
        batteryLevel,
        activeDevices
      };

      await this.saveSnapshot(snapshot);

      return snapshot;
    } catch (error) {
      console.error('Error capturing energy snapshot:', error);
      throw error;
    }
  }

  private async saveSnapshot(snapshot: EnergySnapshot) {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('learned_patterns').insert({
      user_id: user?.id || null,
      pattern_type: 'energy_snapshot',
      pattern_key: snapshot.timestamp.toISOString(),
      pattern_value: {
        totalPower: snapshot.totalPower,
        solarProduction: snapshot.solarProduction,
        gridConsumption: snapshot.gridConsumption,
        batteryLevel: snapshot.batteryLevel,
        activeDevices: snapshot.activeDevices,
        hour: snapshot.timestamp.getHours(),
        dayOfWeek: snapshot.timestamp.getDay()
      },
      confidence_score: 1.0,
      usage_count: 1
    });
  }

  private async analyzeAndLearn() {
    console.log('[EnergyPattern] Starting pattern analysis...');

    const usagePatterns = await this.identifyUsagePatterns();
    const peakTimes = await this.identifyPeakUsageTimes();
    const devicePatterns = await this.identifyDeviceUsagePatterns();
    const wastePatterns = await this.identifyEnergyWaste();

    await this.saveLearnedPatterns({
      usagePatterns,
      peakTimes,
      devicePatterns,
      wastePatterns
    });

    console.log('[EnergyPattern] Analysis complete');
  }

  private async identifyUsagePatterns(): Promise<UsagePattern[]> {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    const oneDayAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data: snapshots } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('user_id', user?.id)
      .eq('pattern_type', 'energy_snapshot')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: true });

    if (!snapshots || snapshots.length === 0) return [];

    const hourlyData: { [key: string]: { total: number; count: number; peaks: number[]; devices: Set<string> } } = {};

    snapshots.forEach(snap => {
      const value = snap.pattern_value;
      const key = `${value.dayOfWeek}-${value.hour}`;

      if (!hourlyData[key]) {
        hourlyData[key] = { total: 0, count: 0, peaks: [], devices: new Set() };
      }

      hourlyData[key].total += value.totalPower;
      hourlyData[key].count += 1;
      hourlyData[key].peaks.push(value.totalPower);
      value.activeDevices?.forEach((d: string) => hourlyData[key].devices.add(d));
    });

    return Object.entries(hourlyData).map(([key, data]) => {
      const [dayOfWeek, timeOfDay] = key.split('-').map(Number);
      return {
        timeOfDay,
        dayOfWeek,
        averagePower: data.total / data.count,
        peakPower: Math.max(...data.peaks),
        commonDevices: Array.from(data.devices)
      };
    });
  }

  private async identifyPeakUsageTimes(): Promise<Array<{ hour: number; power: number }>> {
    const patterns = await this.identifyUsagePatterns();

    return patterns
      .sort((a, b) => b.averagePower - a.averagePower)
      .slice(0, 5)
      .map(p => ({ hour: p.timeOfDay, power: p.averagePower }));
  }

  private async identifyDeviceUsagePatterns() {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const { data: snapshots } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('user_id', user?.id)
      .eq('pattern_type', 'energy_snapshot')
      .gte('created_at', threeDaysAgo.toISOString());

    if (!snapshots || snapshots.length === 0) return {};

    const deviceUsage: { [deviceId: string]: { count: number; hours: Set<number> } } = {};

    snapshots.forEach(snap => {
      const value = snap.pattern_value;
      value.activeDevices?.forEach((deviceId: string) => {
        if (!deviceUsage[deviceId]) {
          deviceUsage[deviceId] = { count: 0, hours: new Set() };
        }
        deviceUsage[deviceId].count += 1;
        deviceUsage[deviceId].hours.add(value.hour);
      });
    });

    const result: { [deviceId: string]: { usageCount: number; commonHours: number[] } } = {};

    Object.entries(deviceUsage).forEach(([deviceId, data]) => {
      result[deviceId] = {
        usageCount: data.count,
        commonHours: Array.from(data.hours).sort((a, b) => a - b)
      };
    });

    return result;
  }

  private async identifyEnergyWaste() {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: snapshots } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('user_id', user?.id)
      .eq('pattern_type', 'energy_snapshot')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: true });

    if (!snapshots || snapshots.length < 10) return [];

    const wastePatterns = [];

    const nightSnapshots = snapshots.filter(s => {
      const hour = s.pattern_value.hour;
      return hour >= 23 || hour <= 5;
    });

    if (nightSnapshots.length > 0) {
      const avgNightPower = nightSnapshots.reduce((sum, s) => sum + s.pattern_value.totalPower, 0) / nightSnapshots.length;
      const commonNightDevices = this.findCommonDevices(nightSnapshots);

      if (avgNightPower > 100 && commonNightDevices.length > 0) {
        wastePatterns.push({
          type: 'night_usage',
          averagePower: avgNightPower,
          devices: commonNightDevices,
          potential_savings: (avgNightPower * 6 * 30 * 0.15) / 1000
        });
      }
    }

    const idleDevices = this.findAlwaysOnDevices(snapshots);
    if (idleDevices.length > 0) {
      wastePatterns.push({
        type: 'always_on_devices',
        devices: idleDevices,
        potential_savings: idleDevices.length * 10 * 24 * 30 * 0.15 / 1000
      });
    }

    return wastePatterns;
  }

  private findCommonDevices(snapshots: any[]): string[] {
    const deviceCount: { [deviceId: string]: number } = {};

    snapshots.forEach(snap => {
      snap.pattern_value.activeDevices?.forEach((deviceId: string) => {
        deviceCount[deviceId] = (deviceCount[deviceId] || 0) + 1;
      });
    });

    const threshold = snapshots.length * 0.7;
    return Object.entries(deviceCount)
      .filter(([_, count]) => count >= threshold)
      .map(([deviceId]) => deviceId);
  }

  private findAlwaysOnDevices(snapshots: any[]): string[] {
    if (snapshots.length < 20) return [];

    const deviceAppearances: { [deviceId: string]: number } = {};

    snapshots.forEach(snap => {
      snap.pattern_value.activeDevices?.forEach((deviceId: string) => {
        deviceAppearances[deviceId] = (deviceAppearances[deviceId] || 0) + 1;
      });
    });

    const threshold = snapshots.length * 0.95;
    return Object.entries(deviceAppearances)
      .filter(([deviceId, count]) =>
        count >= threshold &&
        (deviceId.includes('light') || deviceId.includes('switch'))
      )
      .map(([deviceId]) => deviceId);
  }

  private async saveLearnedPatterns(analysis: any) {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('learned_patterns').upsert({
      user_id: user?.id,
      pattern_type: 'energy_analysis',
      pattern_key: 'latest_analysis',
      pattern_value: {
        timestamp: new Date().toISOString(),
        ...analysis
      },
      confidence_score: 0.8,
      usage_count: 1
    }, {
      onConflict: 'user_id,pattern_type,pattern_key'
    });
  }

  async generateEnergySuggestions(): Promise<EnergySuggestion[]> {
    const suggestions: EnergySuggestion[] = [];

    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: analysis } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('user_id', user?.id)
      .eq('pattern_type', 'energy_analysis')
      .eq('pattern_key', 'latest_analysis')
      .maybeSingle();

    if (!analysis) {
      return [{
        type: 'efficiency',
        priority: 'medium',
        title: 'Start Energy Monitoring',
        description: 'I need more data to provide personalized energy saving suggestions. Let me monitor your usage for 24 hours.',
        estimatedSavings: 0,
        actions: []
      }];
    }

    const { data: feedbackPatterns } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('user_id', user?.id)
      .eq('pattern_type', 'suggestion_feedback')
      .order('usage_count', { ascending: false })
      .limit(10);

    const dislikedTypes = feedbackPatterns
      ?.filter(p => p.pattern_value?.rating === 'down')
      .map(p => p.pattern_key) || [];

    const wastePatterns = analysis.pattern_value.wastePatterns || [];

    wastePatterns.forEach((waste: any) => {
      if (waste.type === 'night_usage') {
        suggestions.push({
          type: 'cost_saving',
          priority: 'high',
          title: 'High Nighttime Energy Usage Detected',
          description: `You're using an average of ${waste.averagePower.toFixed(0)}W during late night hours (11 PM - 5 AM). Consider turning off unnecessary devices.`,
          estimatedSavings: waste.potential_savings,
          actions: waste.devices.map((deviceId: string) => ({
            deviceId,
            action: 'turn_off',
            timing: '11:00 PM'
          }))
        });
      }

      if (waste.type === 'always_on_devices') {
        suggestions.push({
          type: 'device_optimization',
          priority: 'medium',
          title: 'Devices Running Continuously',
          description: `${waste.devices.length} devices are on almost 24/7. Consider creating automation to turn them off when not needed.`,
          estimatedSavings: waste.potential_savings,
          actions: waste.devices.map((deviceId: string) => ({
            deviceId,
            action: 'create_automation'
          }))
        });
      }
    });

    const peakTimes = analysis.pattern_value.peakTimes || [];
    if (peakTimes.length > 0) {
      const topPeak = peakTimes[0];
      suggestions.push({
        type: 'timing',
        priority: 'medium',
        title: 'Peak Usage Time Identified',
        description: `Your highest energy usage is at ${topPeak.hour}:00 (${topPeak.power.toFixed(0)}W average). Consider shifting some activities to off-peak hours to save on electricity costs.`,
        estimatedSavings: (topPeak.power * 0.3 * 30 * 0.10) / 1000,
        actions: []
      });
    }

    const devicePatterns = analysis.pattern_value.devicePatterns || {};
    const frequentDevices = Object.entries(devicePatterns)
      .filter(([_, data]: [string, any]) => data.usageCount > 100)
      .slice(0, 3);

    if (frequentDevices.length > 0) {
      suggestions.push({
        type: 'efficiency',
        priority: 'low',
        title: 'High-Usage Devices',
        description: `Your most frequently used devices could benefit from energy-efficient upgrades or usage scheduling.`,
        estimatedSavings: 15,
        actions: frequentDevices.map(([deviceId]) => ({
          deviceId,
          action: 'optimize'
        }))
      });
    }

    const filteredSuggestions = suggestions.filter(s => !dislikedTypes.includes(s.type));

    return filteredSuggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  async recordSuggestionFeedback(suggestionType: string, rating: 'up' | 'down') {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('learned_patterns').upsert({
      user_id: user?.id,
      pattern_type: 'suggestion_feedback',
      pattern_key: suggestionType,
      pattern_value: {
        rating,
        timestamp: new Date().toISOString()
      },
      confidence_score: rating === 'up' ? 0.8 : 0.2,
      usage_count: 1
    }, {
      onConflict: 'user_id,pattern_type,pattern_key'
    });
  }

  async getEnergyInsights() {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data: dailySnapshots } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('user_id', user?.id)
      .eq('pattern_type', 'energy_snapshot')
      .gte('created_at', oneDayAgo.toISOString());

    const { data: weeklySnapshots } = await supabase
      .from('learned_patterns')
      .select('*')
      .eq('user_id', user?.id)
      .eq('pattern_type', 'energy_snapshot')
      .gte('created_at', oneWeekAgo.toISOString());

    if (!dailySnapshots || dailySnapshots.length === 0) {
      return {
        dailyAverage: 0,
        weeklyAverage: 0,
        trend: 'insufficient_data',
        totalSnapshots: 0
      };
    }

    const dailyAvg = dailySnapshots.reduce((sum, s) => sum + s.pattern_value.totalPower, 0) / dailySnapshots.length;
    const weeklyAvg = weeklySnapshots ? weeklySnapshots.reduce((sum, s) => sum + s.pattern_value.totalPower, 0) / weeklySnapshots.length : dailyAvg;

    return {
      dailyAverage: dailyAvg,
      weeklyAverage: weeklyAvg,
      trend: dailyAvg > weeklyAvg * 1.1 ? 'increasing' : dailyAvg < weeklyAvg * 0.9 ? 'decreasing' : 'stable',
      totalSnapshots: dailySnapshots.length,
      solarProduction: dailySnapshots.reduce((sum, s) => sum + (s.pattern_value.solarProduction || 0), 0) / dailySnapshots.length
    };
  }
}

export const energyPatternService = new EnergyPatternService();
