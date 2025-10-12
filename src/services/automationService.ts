import { dbService } from './database';
import { homeAssistantService } from './homeAssistant';

export interface Automation {
  id: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  created_by: 'user' | 'ai';
  created_at: string;
  updated_at: string;
}

export interface AutomationTrigger {
  type: 'state' | 'time' | 'numeric_state' | 'event' | 'sun';
  entity_id?: string;
  from?: string;
  to?: string;
  at?: string;
  above?: number;
  below?: number;
  event?: string;
}

export interface AutomationCondition {
  type: 'state' | 'numeric_state' | 'time' | 'template';
  entity_id?: string;
  state?: string;
  above?: number;
  below?: number;
  before?: string;
  after?: string;
}

export interface AutomationAction {
  type: 'call_service' | 'delay' | 'wait' | 'repeat';
  service?: string;
  entity_id?: string;
  data?: any;
  delay?: string;
}

class AutomationService {
  async listAutomations(): Promise<Automation[]> {
    const supabase = dbService.getClient();
    const { data, error } = await supabase
      .from('user_automations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getAutomation(id: string): Promise<Automation | null> {
    const supabase = dbService.getClient();
    const { data, error } = await supabase
      .from('user_automations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createAutomation(automation: Partial<Automation>): Promise<Automation> {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('user_automations')
      .insert({
        user_id: user?.id || null,
        name: automation.name || 'New Automation',
        description: automation.description,
        trigger: automation.trigger || {},
        conditions: automation.conditions || [],
        actions: automation.actions || [],
        enabled: automation.enabled ?? true,
        created_by: automation.created_by || 'user'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateAutomation(id: string, updates: Partial<Automation>): Promise<void> {
    const supabase = dbService.getClient();
    const { error } = await supabase
      .from('user_automations')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteAutomation(id: string): Promise<void> {
    const supabase = dbService.getClient();
    const { error } = await supabase
      .from('user_automations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async toggleAutomation(id: string, enabled: boolean): Promise<void> {
    await this.updateAutomation(id, { enabled });
  }

  parseAIAutomationRequest(request: string): Partial<Automation> {
    const lowerRequest = request.toLowerCase();

    const trigger: AutomationTrigger = { type: 'state' };
    const actions: AutomationAction[] = [];
    let name = 'AI Automation';
    let description = request;

    if (lowerRequest.includes('when') || lowerRequest.includes('if')) {
      if (lowerRequest.includes('motion')) {
        trigger.type = 'state';
        trigger.to = 'on';
        name = 'Motion Detection Automation';
      } else if (lowerRequest.includes('sunset') || lowerRequest.includes('sunrise')) {
        trigger.type = 'sun';
        name = 'Sun-based Automation';
      } else if (lowerRequest.includes('time') || /\d{1,2}:\d{2}/.test(lowerRequest)) {
        trigger.type = 'time';
        const timeMatch = request.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          trigger.at = timeMatch[0];
        }
        name = 'Time-based Automation';
      }
    }

    if (lowerRequest.includes('turn on')) {
      actions.push({
        type: 'call_service',
        service: 'homeassistant.turn_on'
      });
    } else if (lowerRequest.includes('turn off')) {
      actions.push({
        type: 'call_service',
        service: 'homeassistant.turn_off'
      });
    } else if (lowerRequest.includes('notify') || lowerRequest.includes('notification')) {
      actions.push({
        type: 'call_service',
        service: 'notify.notify',
        data: { message: 'Automation triggered' }
      });
    }

    return {
      name,
      description,
      trigger,
      conditions: [],
      actions,
      enabled: true,
      created_by: 'ai'
    };
  }

  async executeAutomation(automation: Automation): Promise<void> {
    for (const action of automation.actions) {
      if (action.type === 'call_service' && action.service && action.entity_id) {
        const [domain, service] = action.service.split('.');
        await homeAssistantService.callService(domain, service, action.entity_id, action.data);
      }
    }
  }
}

export const automationService = new AutomationService();
