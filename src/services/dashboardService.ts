import { dbService } from './database';

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  icon: string;
  layout: any[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardCard {
  id: string;
  dashboard_id: string;
  card_type: string;
  title?: string;
  entity_ids: string[];
  config: any;
  position: { x: number; y: number; w: number; h: number };
  created_at: string;
  updated_at: string;
}

export type CardType =
  | 'entity'
  | 'entities'
  | 'gauge'
  | 'history-graph'
  | 'sensor'
  | 'thermostat'
  | 'weather'
  | 'light'
  | 'media-control'
  | 'energy'
  | 'markdown'
  | 'button'
  | 'picture'
  | 'grid';

class DashboardService {
  async listDashboards(): Promise<Dashboard[]> {
    const supabase = dbService.getClient();
    const { data, error } = await supabase
      .from('user_dashboards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getDashboard(id: string): Promise<Dashboard | null> {
    const supabase = dbService.getClient();
    const { data, error } = await supabase
      .from('user_dashboards')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createDashboard(dashboard: Partial<Dashboard>): Promise<Dashboard> {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('user_dashboards')
      .insert({
        user_id: user?.id || null,
        name: dashboard.name || 'New Dashboard',
        description: dashboard.description,
        icon: dashboard.icon || 'layout-dashboard',
        layout: dashboard.layout || [],
        is_default: dashboard.is_default || false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateDashboard(id: string, updates: Partial<Dashboard>): Promise<void> {
    const supabase = dbService.getClient();
    const { error } = await supabase
      .from('user_dashboards')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteDashboard(id: string): Promise<void> {
    const supabase = dbService.getClient();
    const { error } = await supabase
      .from('user_dashboards')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getDashboardCards(dashboardId: string): Promise<DashboardCard[]> {
    const supabase = dbService.getClient();
    const { data, error } = await supabase
      .from('dashboard_cards')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createCard(card: Partial<DashboardCard>): Promise<DashboardCard> {
    const supabase = dbService.getClient();
    const { data, error } = await supabase
      .from('dashboard_cards')
      .insert({
        dashboard_id: card.dashboard_id,
        card_type: card.card_type || 'entity',
        title: card.title,
        entity_ids: card.entity_ids || [],
        config: card.config || {},
        position: card.position || { x: 0, y: 0, w: 1, h: 1 }
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCard(id: string, updates: Partial<DashboardCard>): Promise<void> {
    const supabase = dbService.getClient();
    const { error } = await supabase
      .from('dashboard_cards')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteCard(id: string): Promise<void> {
    const supabase = dbService.getClient();
    const { error } = await supabase
      .from('dashboard_cards')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  getCardTypeInfo(cardType: CardType): { name: string; description: string; icon: string } {
    const cardTypes: Record<CardType, { name: string; description: string; icon: string }> = {
      entity: { name: 'Entity', description: 'Single entity control', icon: 'toggle-left' },
      entities: { name: 'Entities', description: 'Multiple entities list', icon: 'list' },
      gauge: { name: 'Gauge', description: 'Visual gauge for sensors', icon: 'gauge' },
      'history-graph': { name: 'History Graph', description: 'Entity history chart', icon: 'trending-up' },
      sensor: { name: 'Sensor', description: 'Sensor value display', icon: 'activity' },
      thermostat: { name: 'Thermostat', description: 'Climate control', icon: 'thermometer' },
      weather: { name: 'Weather', description: 'Weather forecast', icon: 'cloud' },
      light: { name: 'Light', description: 'Light control with brightness', icon: 'lightbulb' },
      'media-control': { name: 'Media', description: 'Media player control', icon: 'play' },
      energy: { name: 'Energy', description: 'Energy monitoring', icon: 'zap' },
      markdown: { name: 'Markdown', description: 'Custom text content', icon: 'file-text' },
      button: { name: 'Button', description: 'Action button', icon: 'square' },
      picture: { name: 'Picture', description: 'Image display', icon: 'image' },
      grid: { name: 'Grid', description: 'Entity grid layout', icon: 'grid' }
    };

    return cardTypes[cardType] || { name: cardType, description: '', icon: 'box' };
  }
}

export const dashboardService = new DashboardService();
