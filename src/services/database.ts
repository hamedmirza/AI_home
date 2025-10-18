import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Entity {
  entity_id: string;
  friendly_name: string;
  domain: string;
  state: string;
  unit_of_measurement?: string;
  device_class?: string;
  attributes: Record<string, any>;
  last_updated: string;
  last_synced: string;
  created_at: string;
}

export interface EntityHistory {
  id: string;
  entity_id: string;
  state: string;
  state_numeric?: number;
  attributes: Record<string, any>;
  recorded_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface UserPreference {
  id: string;
  key: string;
  value: any;
  updated_at: string;
  created_at: string;
}

export interface SyncStatus {
  id: string;
  sync_type: string;
  last_sync_at?: string;
  next_sync_at?: string;
  status: 'idle' | 'running' | 'error' | 'disabled';
  error_message?: string;
  metadata: Record<string, any>;
  updated_at: string;
}

export class DatabaseService {
  private client: SupabaseClient;
  private syncIntervals: Map<string, number> = new Map();

  constructor() {
    this.client = supabase;
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async upsertEntity(entity: Omit<Entity, 'created_at' | 'last_synced'>): Promise<void> {
    const { error } = await this.client
      .from('entities')
      .upsert({
        ...entity,
        last_synced: new Date().toISOString(),
      }, {
        onConflict: 'entity_id'
      });

    if (error) {
      console.error('Error upserting entity:', error);
      throw error;
    }
  }

  async upsertEntities(entities: Omit<Entity, 'created_at' | 'last_synced'>[]): Promise<void> {
    const now = new Date().toISOString();
    const entitiesWithSync = entities.map(e => ({
      ...e,
      last_synced: now,
    }));

    const { error } = await this.client
      .from('entities')
      .upsert(entitiesWithSync, {
        onConflict: 'entity_id'
      });

    if (error) {
      console.error('Error upserting entities:', error);
      throw error;
    }
  }

  async getEntity(entityId: string): Promise<Entity | null> {
    const { data, error } = await this.client
      .from('entities')
      .select('*')
      .eq('entity_id', entityId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching entity:', error);
      throw error;
    }

    return data;
  }

  async getEntities(domain?: string): Promise<Entity[]> {
    let query = this.client.from('entities').select('*');

    if (domain) {
      query = query.eq('domain', domain);
    }

    const { data, error } = await query.order('friendly_name');

    if (error) {
      console.error('Error fetching entities:', error);
      throw error;
    }

    return data || [];
  }

  async searchEntities(searchTerm: string): Promise<Entity[]> {
    const { data, error } = await this.client
      .from('entities')
      .select('*')
      .or(`entity_id.ilike.%${searchTerm}%,friendly_name.ilike.%${searchTerm}%`)
      .order('friendly_name')
      .limit(20);

    if (error) {
      console.error('Error searching entities:', error);
      throw error;
    }

    return data || [];
  }

  async addEntityHistory(
    entityId: string,
    state: string,
    attributes: Record<string, any> = {}
  ): Promise<void> {
    const stateNumeric = !isNaN(Number(state)) ? Number(state) : null;

    const { error } = await this.client
      .from('entity_history')
      .insert({
        entity_id: entityId,
        state,
        state_numeric: stateNumeric,
        attributes,
        recorded_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error adding entity history:', error);
      throw error;
    }
  }

  async getEntityHistory(
    entityId: string,
    startTime?: Date,
    endTime?: Date,
    limit: number = 1000
  ): Promise<EntityHistory[]> {
    let query = this.client
      .from('entity_history')
      .select('*')
      .eq('entity_id', entityId);

    if (startTime) {
      query = query.gte('recorded_at', startTime.toISOString());
    }

    if (endTime) {
      query = query.lte('recorded_at', endTime.toISOString());
    }

    const { data, error } = await query
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching entity history:', error);
      throw error;
    }

    return data || [];
  }

  async addChatMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<ChatMessage> {
    const { data, error } = await this.client
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role,
        content,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding chat message:', error);
      throw error;
    }

    return data;
  }

  async getChatHistory(sessionId: string, limit: number = 100): Promise<ChatMessage[]> {
    const { data, error } = await this.client
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }

    return data || [];
  }

  async clearChatHistory(sessionId: string): Promise<void> {
    const { error } = await this.client
      .from('chat_messages')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error clearing chat history:', error);
      throw error;
    }
  }

  async updateChatMessageFeedback(messageId: string, feedback: 'up' | 'down'): Promise<void> {
    const { data: currentMsg, error: fetchError } = await this.client
      .from('chat_messages')
      .select('metadata')
      .eq('id', messageId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching message:', fetchError);
      throw fetchError;
    }

    const currentMetadata = currentMsg?.metadata || {};

    const { error: updateError } = await this.client
      .from('chat_messages')
      .update({
        metadata: {
          ...currentMetadata,
          feedback,
          feedback_timestamp: new Date().toISOString()
        }
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message feedback:', updateError);
      throw updateError;
    }
  }

  async setPreference(key: string, value: any): Promise<void> {
    const { error } = await this.client
      .from('user_preferences')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key'
      });

    if (error) {
      console.error('Error setting preference:', error);
      throw error;
    }
  }

  async getPreference(key: string): Promise<any | null> {
    const { data, error } = await this.client
      .from('user_preferences')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      console.error('Error fetching preference:', error);
      throw error;
    }

    return data?.value || null;
  }

  async updateSyncStatus(
    syncType: string,
    status: 'idle' | 'running' | 'error' | 'disabled',
    errorMessage?: string
  ): Promise<void> {
    const updates: any = {
      sync_type: syncType,
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'running') {
      updates.last_sync_at = new Date().toISOString();
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    const { error } = await this.client
      .from('sync_status')
      .upsert(updates, {
        onConflict: 'sync_type'
      });

    if (error) {
      console.error('Error updating sync status:', error);
      throw error;
    }
  }

  async getSyncStatus(syncType: string): Promise<SyncStatus | null> {
    const { data, error } = await this.client
      .from('sync_status')
      .select('*')
      .eq('sync_type', syncType)
      .maybeSingle();

    if (error) {
      console.error('Error fetching sync status:', error);
      throw error;
    }

    return data;
  }

  async getAllSyncStatuses(): Promise<SyncStatus[]> {
    const { data, error } = await this.client
      .from('sync_status')
      .select('*')
      .order('sync_type');

    if (error) {
      console.error('Error fetching sync statuses:', error);
      throw error;
    }

    return data || [];
  }

  async getEntityStats(): Promise<{
    total: number;
    byDomain: Record<string, number>;
    lastSync: string | null;
  }> {
    const entities = await this.getEntities();
    const byDomain: Record<string, number> = {};

    entities.forEach(e => {
      byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
    });

    const lastSync = entities.length > 0
      ? entities.reduce((latest, e) =>
          e.last_synced > latest ? e.last_synced : latest,
          entities[0].last_synced
        )
      : null;

    return {
      total: entities.length,
      byDomain,
      lastSync,
    };
  }

  async cleanOldHistory(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { error, count } = await this.client
      .from('entity_history')
      .delete()
      .lt('recorded_at', cutoffDate.toISOString());

    if (error) {
      console.error('Error cleaning old history:', error);
      throw error;
    }

    return count || 0;
  }
}

export const dbService = new DatabaseService();
