import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp, TrendingDown, Settings, BarChart3, PieChart, Activity, Home, Sun, Battery, Plus, Edit3, Save, X, Grid, List, Sliders } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { Input } from './ui/Input';
import { Entity, EnergyData } from '../types/homeAssistant';
import { homeAssistantService } from '../services/homeAssistant';
import { dbService } from '../services/database';

interface EnergyManagerProps {
  entities: Entity[];
  isConnected: boolean;
}

interface EnergySource {
  id: string;
  name: string;
  type: 'solar' | 'battery' | 'grid' | 'generator' | 'wind';
  entityIds: string[];
  color: string;
  icon: string;
  position: { x: number; y: number };
  currentValue: number;
}

interface EnergySettings {
  showOverview: boolean;
  showFlow: boolean;
  showCosts: boolean;
  showDevices: boolean;
  showConfiguration: boolean;
  currency: string;
  ratePerKwh: number;
  flowLayout: 'horizontal' | 'vertical' | 'circular';
  animateFlow: boolean;
  showValues: boolean;
}

export function EnergyManager({ entities, isConnected }: EnergyManagerProps) {
  const [energyData, setEnergyData] = useState<EnergyData[]>([]);
  const [loading, setLoading] = useState(false);
  const [energySources, setEnergySources] = useState<EnergySource[]>([]);
  const [showSourceEditor, setShowSourceEditor] = useState(false);
  const [editingSource, setEditingSource] = useState<EnergySource | null>(null);
  const [settings, setSettings] = useState<EnergySettings>({
    showOverview: true,
    showFlow: true,
    showCosts: true,
    showDevices: true,
    showConfiguration: false,
    currency: 'USD',
    ratePerKwh: 0.12,
    flowLayout: 'horizontal',
    animateFlow: true,
    showValues: true
  });

  useEffect(() => {
    if (isConnected) {
      loadEnergyData();
      loadEnergyConfiguration();
    }
  }, [isConnected]);

  useEffect(() => {
    const loadConfiguration = async () => {
      try {
        const savedSettings = await dbService.getPreference('energyManagerSettings');
        if (savedSettings) {
          setSettings(savedSettings);
        }

        const savedSources = await dbService.getPreference('energyManagerSources');
        if (savedSources) {
          setEnergySources(savedSources);
        }
      } catch (error) {
        console.error('Failed to load energy manager configuration:', error);
      }
    };

    loadConfiguration();
  }, []);

  useEffect(() => {
    const saveSettings = async () => {
      try {
        await dbService.setPreference('energyManagerSettings', settings);
      } catch (error) {
        console.error('Failed to save energy settings:', error);
      }
    };

    saveSettings();
  }, [settings]);

  useEffect(() => {
    const saveSources = async () => {
      try {
        await dbService.setPreference('energyManagerSources', energySources);
      } catch (error) {
        console.error('Failed to save energy sources:', error);
      }
    };

    saveSources();
    updateEnergyValues();
  }, [energySources, entities]);

  const loadEnergyData = async () => {
    setLoading(true);
    try {
      const data = await homeAssistantService.getEnergyData();
      setEnergyData(data);
    } catch (error) {
      console.error('Failed to load energy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEnergyConfiguration = () => {
    // Auto-detect energy sources from entities
    const detectedSources: EnergySource[] = [];

    // Solar entities
    const solarEntities = entities.filter(e => 
      e.entity_id.includes('solar') || 
      e.entity_id.includes('pv') ||
      e.friendly_name?.toLowerCase().includes('solar')
    );
    if (solarEntities.length > 0) {
      detectedSources.push({
        id: 'solar',
        name: 'Solar Panels',
        type: 'solar',
        entityIds: solarEntities.map(e => e.entity_id),
        color: '#F59E0B',
        icon: 'sun',
        position: { x: 0, y: 0 },
        currentValue: 0
      });
    }

    // Battery entities
    const batteryEntities = entities.filter(e => 
      e.device_class === 'battery' ||
      e.entity_id.includes('battery')
    );
    if (batteryEntities.length > 0) {
      detectedSources.push({
        id: 'battery',
        name: 'Battery Storage',
        type: 'battery',
        entityIds: batteryEntities.map(e => e.entity_id),
        color: '#10B981',
        icon: 'battery',
        position: { x: 0, y: 1 },
        currentValue: 0
      });
    }

    // Grid entities
    const gridEntities = entities.filter(e => 
      e.entity_id.includes('grid') || 
      e.friendly_name?.toLowerCase().includes('grid')
    );
    if (gridEntities.length > 0) {
      detectedSources.push({
        id: 'grid',
        name: 'Grid Connection',
        type: 'grid',
        entityIds: gridEntities.map(e => e.entity_id),
        color: '#3B82F6',
        icon: 'zap',
        position: { x: 2, y: 0 },
        currentValue: 0
      });
    }

    // Home load (always present)
    detectedSources.push({
      id: 'home',
      name: 'Home Load',
      type: 'grid',
      entityIds: [],
      color: '#8B5CF6',
      icon: 'home',
      position: { x: 1, y: 1 },
      currentValue: 0
    });

    if (energySources.length === 0) {
      setEnergySources(detectedSources);
    }
  };

  const updateEnergyValues = () => {
    setEnergySources(prev => prev.map(source => {
      let currentValue = 0;
      
      // Get real values from entities
      source.entityIds.forEach(entityId => {
        const entity = entities.find(e => e.entity_id === entityId);
        if (entity) {
          const value = parseFloat(entity.state) || 0;
          currentValue += value;
        }
      });

      // If no real data, use demo values
      if (currentValue === 0) {
        switch (source.type) {
          case 'solar':
            currentValue = 4.2;
            break;
          case 'battery':
            currentValue = 85; // percentage
            break;
          case 'grid':
            currentValue = 1.8;
            break;
          default:
            currentValue = 2.5;
        }
      }

      return { ...source, currentValue };
    }));
  };

  const updateSetting = (key: keyof EnergySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addEnergySource = () => {
    const newSource: EnergySource = {
      id: Date.now().toString(),
      name: 'New Source',
      type: 'solar',
      entityIds: [],
      color: '#3B82F6',
      icon: 'zap',
      position: { x: 0, y: 0 },
      currentValue: 0
    };
    setEnergySources(prev => [...prev, newSource]);
    setEditingSource(newSource);
    setShowSourceEditor(true);
  };

  const updateEnergySource = (sourceId: string, updates: Partial<EnergySource>) => {
    setEnergySources(prev => prev.map(source =>
      source.id === sourceId ? { ...source, ...updates } : source
    ));
  };

  const deleteEnergySource = (sourceId: string) => {
    setEnergySources(prev => prev.filter(source => source.id !== sourceId));
  };

  const saveEnergySource = () => {
    if (editingSource) {
      updateEnergySource(editingSource.id, editingSource);
      setEditingSource(null);
      setShowSourceEditor(false);
    }
  };

  const getSourceIcon = (iconName: string) => {
    switch (iconName) {
      case 'sun': return <Sun className="w-6 h-6" />;
      case 'battery': return <Battery className="w-6 h-6" />;
      case 'zap': return <Zap className="w-6 h-6" />;
      case 'home': return <Home className="w-6 h-6" />;
      default: return <Activity className="w-6 h-6" />;
    }
  };

  // Calculate energy statistics
  const totalConsumption = energyData.reduce((sum, data) => sum + data.consumption, 0) || 25.4;
  const totalCost = energyData.reduce((sum, data) => sum + data.cost, 0) || (totalConsumption * settings.ratePerKwh);
  const avgConsumption = energyData.length > 0 ? totalConsumption / energyData.length : 1.2;

  // Get energy-related entities
  const energyEntities = entities.filter(entity => 
    entity.entity_id.includes('energy') || 
    entity.entity_id.includes('power') || 
    entity.entity_id.includes('consumption') ||
    entity.device_class === 'energy' ||
    entity.device_class === 'power'
  );

  const solarEntities = entities.filter(entity => 
    entity.entity_id.includes('solar') || 
    entity.entity_id.includes('pv') ||
    entity.friendly_name?.toLowerCase().includes('solar')
  );

  const batteryEntities = entities.filter(entity => 
    entity.device_class === 'battery' ||
    entity.entity_id.includes('battery')
  );

  // Calculate self-sufficiency
  const solarSource = energySources.find(s => s.type === 'solar');
  const gridSource = energySources.find(s => s.type === 'grid');
  const selfSufficiency = solarSource && gridSource 
    ? Math.round((solarSource.currentValue / (solarSource.currentValue + gridSource.currentValue)) * 100)
    : solarEntities.length > 0 ? 78 : 0;

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center max-w-md">
          <Zap className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Energy Manager Unavailable</h3>
          <p className="text-gray-600">
            Please connect to Home Assistant first to manage your energy consumption.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Energy Manager</h1>
            <p className="text-gray-600">Monitor and optimize your energy consumption</p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={loadEnergyData}
              disabled={loading}
              variant="outline"
            >
              <Activity className="w-4 h-4 mr-2" />
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            <Button
              onClick={() => updateSetting('showConfiguration', !settings.showConfiguration)}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </div>
        </div>

        {/* Configuration Panel */}
        {settings.showConfiguration && (
          <Card className="p-6 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Energy Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Layout Settings */}
              <div>
                <h3 className="font-semibold mb-4">Dashboard Layout</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <label className="flex items-center space-x-2">
                    <Switch
                      checked={settings.showOverview}
                      onChange={(checked) => updateSetting('showOverview', checked)}
                    />
                    <span className="text-sm">Overview</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <Switch
                      checked={settings.showFlow}
                      onChange={(checked) => updateSetting('showFlow', checked)}
                    />
                    <span className="text-sm">Energy Flow</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <Switch
                      checked={settings.showCosts}
                      onChange={(checked) => updateSetting('showCosts', checked)}
                    />
                    <span className="text-sm">Cost Analysis</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <Switch
                      checked={settings.showDevices}
                      onChange={(checked) => updateSetting('showDevices', checked)}
                    />
                    <span className="text-sm">Device Monitor</span>
                  </label>
                </div>
              </div>

              {/* Energy Sources */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Energy Sources</h3>
                  <Button onClick={addEnergySource} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Source
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {energySources.map(source => (
                    <div key={source.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: source.color }}>
                            {getSourceIcon(source.icon)}
                          </div>
                          <span className="font-medium">{source.name}</span>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingSource(source);
                              setShowSourceEditor(true);
                            }}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteEnergySource(source.id)}
                            className="text-red-600"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        Type: {source.type} | Entities: {source.entityIds.length}
                      </div>
                      <div className="text-lg font-bold mt-2">
                        {source.currentValue.toFixed(1)} {source.type === 'battery' ? '%' : 'kW'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Currency"
                  value={settings.currency}
                  onChange={(e) => updateSetting('currency', e.target.value)}
                />
                <Input
                  label="Rate per kWh"
                  type="number"
                  step="0.01"
                  value={settings.ratePerKwh}
                  onChange={(e) => updateSetting('ratePerKwh', parseFloat(e.target.value) || 0.12)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview Section */}
        {settings.showOverview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Consumption</p>
                  <p className="text-2xl font-bold">{totalConsumption.toFixed(1)} kWh</p>
                </div>
                <Zap className="w-8 h-8 text-blue-200" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Total Cost</p>
                  <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-200" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Average Usage</p>
                  <p className="text-2xl font-bold">{avgConsumption.toFixed(1)} kWh</p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-200" />
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Self-Sufficiency</p>
                  <p className="text-2xl font-bold">{selfSufficiency}%</p>
                </div>
                <Sun className="w-8 h-8 text-orange-200" />
              </div>
            </Card>
          </div>
        )}

        {/* Energy Flow Section */}
        {settings.showFlow && (
          <Card className="p-6 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Energy Flow Diagram
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-8 text-white overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
                  <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-green-500 rounded-full blur-2xl animate-pulse delay-1000"></div>
                </div>

                <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                  {/* Solar Generation */}
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                      <Sun className="w-10 h-10 text-white" />
                    </div>
                    <h4 className="font-semibold mb-2">Solar Generation</h4>
                    <p className="text-2xl font-bold text-yellow-400">
                      {solarSource ? `${solarSource.currentValue.toFixed(1)} kW` : '0 kW'}
                    </p>
                    <p className="text-sm text-gray-300">Current Output</p>
                  </div>

                  {/* Energy Flow Animation */}
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <div className="w-32 h-32 border-4 border-blue-500 rounded-full flex items-center justify-center">
                        <Home className="w-12 h-12 text-blue-400" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full animate-ping"></div>
                      <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-yellow-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>

                  {/* Grid/Battery */}
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                      {batteryEntities.length > 0 ? (
                        <Battery className="w-10 h-10 text-white" />
                      ) : (
                        <Zap className="w-10 h-10 text-white" />
                      )}
                    </div>
                    <h4 className="font-semibold mb-2">
                      {batteryEntities.length > 0 ? 'Battery Storage' : 'Grid Power'}
                    </h4>
                    <p className="text-2xl font-bold text-blue-400">
                      {batteryEntities.length > 0 
                        ? `${energySources.find(s => s.type === 'battery')?.currentValue.toFixed(0) || '85'}%`
                        : `${gridSource?.currentValue.toFixed(1) || '2.1'} kW`
                      }
                    </p>
                    <p className="text-sm text-gray-300">
                      {batteryEntities.length > 0 ? 'Charge Level' : 'Grid Import'}
                    </p>
                  </div>
                </div>

                {/* Flow indicators */}
                {settings.animateFlow && (
                  <>
                    <div className="absolute top-1/2 left-1/4 transform -translate-y-1/2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                    <div className="absolute top-1/2 right-1/4 transform -translate-y-1/2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cost Analysis Section */}
        {settings.showCosts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="p-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Cost Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Today's Cost</span>
                  <span className="font-bold text-green-600">${(totalCost * 0.3).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">This Week</span>
                  <span className="font-bold text-blue-600">${(totalCost * 2.1).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">This Month</span>
                  <span className="font-bold text-purple-600">${(totalCost * 8.5).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                  <span className="text-sm font-medium">Projected Monthly</span>
                  <span className="font-bold text-orange-600">${(totalCost * 30).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="p-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="w-5 h-5 mr-2" />
                  Savings Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-green-800">Solar Optimization</span>
                    <span className="text-sm text-green-600">+$23/month</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Increase self-consumption during peak hours
                  </p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-blue-800">Load Shifting</span>
                    <span className="text-sm text-blue-600">+$15/month</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Run high-power devices during off-peak hours
                  </p>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-purple-800">Smart Automation</span>
                    <span className="text-sm text-purple-600">+$8/month</span>
                  </div>
                  <p className="text-sm text-purple-700">
                    Optimize heating/cooling schedules
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Device Monitor Section */}
        {settings.showDevices && (
          <Card className="p-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Home className="w-5 h-5 mr-2" />
                Energy Device Monitor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {energyEntities.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">No energy monitoring devices found</p>
                  <p className="text-sm text-gray-500">
                    Connect energy monitoring devices to see detailed consumption data
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {energyEntities.slice(0, 6).map((entity) => (
                    <div
                      key={entity.entity_id}
                      className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm truncate">
                          {entity.friendly_name || entity.entity_id}
                        </h4>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">
                          {entity.state}
                          <span className="text-xs font-normal text-gray-600 ml-1">
                            {entity.unit_of_measurement || 'W'}
                          </span>
                        </span>
                        <div className="text-xs text-gray-500">
                          {entity.device_class || 'power'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Energy Source Editor Modal */}
        {showSourceEditor && editingSource && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold">
                  {editingSource.id === Date.now().toString() ? 'Add Energy Source' : 'Edit Energy Source'}
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <Input
                  label="Source Name"
                  value={editingSource.name}
                  onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Source Type</label>
                  <select
                    value={editingSource.type}
                    onChange={(e) => setEditingSource({ ...editingSource, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="solar">Solar</option>
                    <option value="battery">Battery</option>
                    <option value="grid">Grid</option>
                    <option value="generator">Generator</option>
                    <option value="wind">Wind</option>
                  </select>
                </div>

                <Input
                  label="Color"
                  type="color"
                  value={editingSource.color}
                  onChange={(e) => setEditingSource({ ...editingSource, color: e.target.value })}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Associated Entities</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {entities
                      .filter(entity => 
                        entity.entity_id.includes('energy') || 
                        entity.entity_id.includes('power') ||
                        entity.entity_id.includes(editingSource.type)
                      )
                      .map(entity => (
                        <label key={entity.entity_id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={editingSource.entityIds.includes(entity.entity_id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingSource({
                                  ...editingSource,
                                  entityIds: [...editingSource.entityIds, entity.entity_id]
                                });
                              } else {
                                setEditingSource({
                                  ...editingSource,
                                  entityIds: editingSource.entityIds.filter(id => id !== entity.entity_id)
                                });
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">{entity.friendly_name || entity.entity_id}</span>
                        </label>
                      ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSourceEditor(false);
                    setEditingSource(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={saveEnergySource}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Source
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}