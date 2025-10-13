import { supabase } from './database';

export interface ActionLog {
  id?: string;
  user_id?: string;
  action_type: 'service_call' | 'automation_trigger' | 'manual_toggle';
  entity_id: string;
  service?: string;
  data?: Record<string, any>;
  reason?: string;
  source: 'ai_assistant' | 'user_manual' | 'automation' | 'voice';
  before_state?: string;
  after_state?: string;
  success: boolean;
  error_message?: string;
  duration_ms?: number;
  created_at?: string;
}

export interface AISuggestion {
  id?: string;
  user_id?: string;
  suggestion_type: 'automation' | 'optimization' | 'cost_saving' | 'pattern';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  category: 'energy' | 'comfort' | 'security' | 'convenience' | 'maintenance';
  data?: Record<string, any>;
  entities_involved: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'implemented' | 'expired';
  implemented_at?: string;
  created_at?: string;
  expires_at?: string;
}

export interface RollbackPoint {
  id?: string;
  user_id?: string;
  action_log_id: string;
  entity_states: Record<string, any>;
  description: string;
  can_rollback: boolean;
  created_at?: string;
}

class AuditService {
  async logAction(action: ActionLog): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('action_logs')
        .insert({
          ...action,
          user_id: user.id
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  async getActionLogs(limit: number = 50, offset: number = 0): Promise<ActionLog[]> {
    try {
      const { data, error } = await supabase
        .from('action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch action logs:', error);
      return [];
    }
  }

  async getEntityHistory(entityId: string, limit: number = 20): Promise<ActionLog[]> {
    try {
      const { data, error } = await supabase
        .from('action_logs')
        .select('*')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch entity history:', error);
      return [];
    }
  }

  async getActionStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
    successRate: number;
    avgDuration: number;
  }> {
    try {
      const { data: logs } = await supabase
        .from('action_logs')
        .select('source, success, duration_ms');

      if (!logs || logs.length === 0) {
        return { total: 0, bySource: {}, successRate: 100, avgDuration: 0 };
      }

      const bySource: Record<string, number> = {};
      let successCount = 0;
      let totalDuration = 0;
      let durationCount = 0;

      logs.forEach((log: any) => {
        bySource[log.source] = (bySource[log.source] || 0) + 1;
        if (log.success) successCount++;
        if (log.duration_ms) {
          totalDuration += log.duration_ms;
          durationCount++;
        }
      });

      return {
        total: logs.length,
        bySource,
        successRate: (successCount / logs.length) * 100,
        avgDuration: durationCount > 0 ? totalDuration / durationCount : 0
      };
    } catch (error) {
      console.error('Failed to fetch action stats:', error);
      return { total: 0, bySource: {}, successRate: 100, avgDuration: 0 };
    }
  }

  async createSuggestion(suggestion: AISuggestion): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('ai_suggestions')
        .insert({
          ...suggestion,
          user_id: user.id
        })
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Failed to create suggestion:', error);
      return null;
    }
  }

  async getSuggestions(status?: string): Promise<AISuggestion[]> {
    try {
      console.log('[AuditService] Fetching suggestions with status:', status);

      let query = supabase
        .from('ai_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[AuditService] Error fetching suggestions:', error);
        throw error;
      }

      console.log('[AuditService] Fetched suggestions:', data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error('[AuditService] Failed to fetch suggestions:', error);
      return [];
    }
  }

  async updateSuggestionStatus(id: string, status: AISuggestion['status']): Promise<boolean> {
    try {
      const updates: any = { status };
      if (status === 'implemented') {
        updates.implemented_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('ai_suggestions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to update suggestion status:', error);
      return false;
    }
  }

  async createRollbackPoint(
    actionLogId: string,
    entityStates: Record<string, any>,
    description: string
  ): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('rollback_points')
        .insert({
          user_id: user.id,
          action_log_id: actionLogId,
          entity_states: entityStates,
          description,
          can_rollback: true
        })
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Failed to create rollback point:', error);
      return null;
    }
  }

  async getRollbackPoints(limit: number = 10): Promise<RollbackPoint[]> {
    try {
      const { data, error } = await supabase
        .from('rollback_points')
        .select('*')
        .eq('can_rollback', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch rollback points:', error);
      return [];
    }
  }

  async generateSmartSuggestions(
    entities: any[],
    actionLogs: ActionLog[]
  ): Promise<AISuggestion[]> {
    const suggestions: AISuggestion[] = [];

    // Analyze energy patterns
    const energyEntities = entities.filter(e =>
      e.entity_id.includes('power') ||
      e.entity_id.includes('energy') ||
      e.device_class === 'power' ||
      e.device_class === 'energy'
    );

    if (energyEntities.length > 0) {
      const highPowerDevices = energyEntities.filter(e => {
        const power = parseFloat(e.state);
        return !isNaN(power) && power > 1000;
      });

      if (highPowerDevices.length > 0) {
        suggestions.push({
          suggestion_type: 'cost_saving',
          title: 'High Power Consumption Detected',
          description: `${highPowerDevices.length} device(s) are consuming over 1kW. Consider scheduling usage during off-peak hours to reduce costs.`,
          confidence: 0.85,
          impact: 'high',
          category: 'energy',
          entities_involved: highPowerDevices.map(d => d.entity_id),
          status: 'pending',
          data: {
            total_power: highPowerDevices.reduce((sum, d) => sum + parseFloat(d.state || 0), 0),
            potential_savings: 'Up to 30% on energy bills'
          }
        });
      }
    }

    // Analyze automation opportunities from action logs
    const recentLogs = actionLogs.slice(0, 50);
    const entityActionCount: Record<string, number> = {};

    recentLogs.forEach(log => {
      if (log.source === 'user_manual') {
        entityActionCount[log.entity_id] = (entityActionCount[log.entity_id] || 0) + 1;
      }
    });

    Object.entries(entityActionCount).forEach(([entityId, count]) => {
      if (count >= 5) {
        suggestions.push({
          suggestion_type: 'automation',
          title: 'Frequent Manual Control Detected',
          description: `You've manually controlled ${entityId} ${count} times recently. Consider creating an automation to simplify this.`,
          confidence: 0.75,
          impact: 'medium',
          category: 'convenience',
          entities_involved: [entityId],
          status: 'pending',
          data: {
            action_count: count,
            suggestion: 'Create a time-based or sensor-triggered automation'
          }
        });
      }
    });

    // Security suggestions - lights left on
    const lightsOn = entities.filter(e =>
      e.entity_id.startsWith('light.') && e.state === 'on'
    );

    if (lightsOn.length > 5) {
      suggestions.push({
        suggestion_type: 'optimization',
        title: 'Multiple Lights On',
        description: `${lightsOn.length} lights are currently on. Consider turning off unused lights to save energy.`,
        confidence: 0.70,
        impact: 'medium',
        category: 'energy',
        entities_involved: lightsOn.map(l => l.entity_id),
        status: 'pending',
        data: {
          count: lightsOn.length,
          estimated_power: lightsOn.length * 10
        }
      });
    }

    return suggestions;
  }
}

export const auditService = new AuditService();
