import { homeAssistantService } from './homeAssistant';
import { dbService } from './database';
import { energyPatternService } from './energyPatternService';

class SyncService {
  private entitySyncInterval: NodeJS.Timeout | null = null;
  private historySyncInterval: NodeJS.Timeout | null = null;
  private monitoredEntities: Set<string> = new Set();
  private lastStates: Map<string, string> = new Map();

  async startEntitySync(intervalMinutes: number = 5): Promise<void> {
    if (this.entitySyncInterval) {
      clearInterval(this.entitySyncInterval);
    }

    await this.syncEntities();

    this.entitySyncInterval = setInterval(() => {
      this.syncEntities();
    }, intervalMinutes * 60 * 1000);

    energyPatternService.startLearning(15);

    console.log(`Entity sync started with ${intervalMinutes} minute interval`);
    console.log('Energy pattern learning started');
  }

  async stopEntitySync(): Promise<void> {
    if (this.entitySyncInterval) {
      clearInterval(this.entitySyncInterval);
      this.entitySyncInterval = null;
      energyPatternService.stopLearning();
      await dbService.updateSyncStatus('entities', 'disabled');
      console.log('Entity sync stopped');
      console.log('Energy pattern learning stopped');
    }
  }

  async syncEntities(): Promise<void> {
    try {
      await dbService.updateSyncStatus('entities', 'running');

      const entities = await homeAssistantService.getEntities();

      const entityRecords = entities.map(e => ({
        entity_id: e.entity_id,
        friendly_name: e.friendly_name || e.entity_id,
        domain: e.entity_id.split('.')[0],
        state: e.state,
        unit_of_measurement: e.attributes?.unit_of_measurement,
        device_class: e.attributes?.device_class,
        attributes: e.attributes || {},
        last_updated: e.last_updated || new Date().toISOString(),
      }));

      await dbService.upsertEntities(entityRecords);

      await dbService.updateSyncStatus('entities', 'idle');
      console.log(`Synced ${entityRecords.length} entities to database`);
    } catch (error) {
      console.error('Error syncing entities:', error);
      await dbService.updateSyncStatus('entities', 'error', String(error));
    }
  }

  async startHistoryTracking(intervalMinutes: number = 1): Promise<void> {
    if (this.historySyncInterval) {
      clearInterval(this.historySyncInterval);
    }

    await this.trackHistory();

    this.historySyncInterval = setInterval(() => {
      this.trackHistory();
    }, intervalMinutes * 60 * 1000);

    console.log(`History tracking started with ${intervalMinutes} minute interval`);
  }

  async stopHistoryTracking(): Promise<void> {
    if (this.historySyncInterval) {
      clearInterval(this.historySyncInterval);
      this.historySyncInterval = null;
      await dbService.updateSyncStatus('history', 'disabled');
      console.log('History tracking stopped');
    }
  }

  addMonitoredEntity(entityId: string): void {
    this.monitoredEntities.add(entityId);
  }

  removeMonitoredEntity(entityId: string): void {
    this.monitoredEntities.delete(entityId);
    this.lastStates.delete(entityId);
  }

  async monitorAllSensors(): Promise<void> {
    const entities = await homeAssistantService.getEntities();
    entities
      .filter(e => e.entity_id.startsWith('sensor.'))
      .forEach(e => this.addMonitoredEntity(e.entity_id));

    console.log(`Monitoring ${this.monitoredEntities.size} sensors for history tracking`);
  }

  private async trackHistory(): Promise<void> {
    try {
      await dbService.updateSyncStatus('history', 'running');

      if (this.monitoredEntities.size === 0) {
        await this.monitorAllSensors();
      }

      const entities = await homeAssistantService.getEntities();
      const updates: Promise<void>[] = [];

      for (const entity of entities) {
        if (!this.monitoredEntities.has(entity.entity_id)) {
          continue;
        }

        const lastState = this.lastStates.get(entity.entity_id);
        if (lastState !== entity.state) {
          this.lastStates.set(entity.entity_id, entity.state);

          updates.push(
            dbService.addEntityHistory(
              entity.entity_id,
              entity.state,
              entity.attributes || {}
            )
          );
        }
      }

      await Promise.all(updates);

      await dbService.updateSyncStatus('history', 'idle');
      if (updates.length > 0) {
        console.log(`Tracked ${updates.length} entity state changes`);
      }
    } catch (error) {
      console.error('Error tracking history:', error);
      await dbService.updateSyncStatus('history', 'error', String(error));
    }
  }

  async getEntityFromCache(entityId: string): Promise<any | null> {
    return await dbService.getEntity(entityId);
  }

  async searchEntitiesInCache(searchTerm: string): Promise<any[]> {
    return await dbService.searchEntities(searchTerm);
  }

  async getEntityHistoryData(
    entityId: string,
    startTime?: Date,
    endTime?: Date,
    limit?: number
  ): Promise<any[]> {
    return await dbService.getEntityHistory(entityId, startTime, endTime, limit);
  }

  async cleanOldHistory(daysToKeep: number = 30): Promise<number> {
    return await dbService.cleanOldHistory(daysToKeep);
  }

  async getSyncStatuses(): Promise<any[]> {
    return await dbService.getAllSyncStatuses();
  }

  async getStats(): Promise<any> {
    return await dbService.getEntityStats();
  }
}

export const syncService = new SyncService();
