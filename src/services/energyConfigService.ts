import { dbService } from './database';

export interface EnergyEntityConfig {
  entityId: string;
  displayName?: string;
  color?: string;
}

export interface EnergyConfiguration {
  battery: {
    socEntity?: EnergyEntityConfig;
    powerEntity?: EnergyEntityConfig;
    capacityEntity?: EnergyEntityConfig;
    temperatureEntity?: EnergyEntityConfig;
    capacity: number;
  };
  solar: {
    powerEntity?: EnergyEntityConfig;
    energyTodayEntity?: EnergyEntityConfig;
  };
  grid: {
    powerEntity?: EnergyEntityConfig;
    importTodayEntity?: EnergyEntityConfig;
    exportTodayEntity?: EnergyEntityConfig;
  };
  home: {
    powerEntity?: EnergyEntityConfig;
    consumptionTodayEntity?: EnergyEntityConfig;
  };
  display: {
    refreshInterval: number;
    showTemperature: boolean;
    showCostSavings: boolean;
    showIndependence: boolean;
    costPerKwh: number;
  };
}

const DEFAULT_CONFIG: EnergyConfiguration = {
  battery: {
    capacity: 13.5,
  },
  solar: {},
  grid: {},
  home: {},
  display: {
    refreshInterval: 5000,
    showTemperature: true,
    showCostSavings: true,
    showIndependence: true,
    costPerKwh: 0.15,
  },
};

const CONFIG_KEY = 'energy_dashboard_config';

class EnergyConfigService {
  async getConfiguration(): Promise<EnergyConfiguration> {
    try {
      const config = await dbService.getPreference(CONFIG_KEY);
      if (config) {
        return { ...DEFAULT_CONFIG, ...config };
      }
    } catch (error) {
      console.error('Error loading energy configuration:', error);
    }
    return DEFAULT_CONFIG;
  }

  async saveConfiguration(config: EnergyConfiguration): Promise<void> {
    try {
      await dbService.setPreference(CONFIG_KEY, config);
    } catch (error) {
      console.error('Error saving energy configuration:', error);
      throw error;
    }
  }

  async autoConfigureFromEntities(entities: any[]): Promise<EnergyConfiguration> {
    const config: EnergyConfiguration = { ...DEFAULT_CONFIG };

    const batteryEntities = entities.filter(e =>
      e.entity_id.includes('battery') ||
      e.friendly_name?.toLowerCase().includes('battery')
    );

    const solarEntities = entities.filter(e =>
      e.entity_id.includes('solar') ||
      e.entity_id.includes('pv') ||
      e.friendly_name?.toLowerCase().includes('solar')
    );

    const gridEntities = entities.filter(e =>
      e.entity_id.includes('grid') ||
      e.friendly_name?.toLowerCase().includes('grid')
    );

    const consumptionEntities = entities.filter(e =>
      e.entity_id.includes('consumption') ||
      e.entity_id.includes('load') ||
      e.friendly_name?.toLowerCase().includes('consumption') ||
      e.friendly_name?.toLowerCase().includes('house')
    );

    const findEntity = (list: any[], keywords: string[]) => {
      for (const keyword of keywords) {
        const found = list.find(e =>
          e.entity_id.toLowerCase().includes(keyword) ||
          e.friendly_name?.toLowerCase().includes(keyword)
        );
        if (found) return found;
      }
      return null;
    };

    const batterySoc = findEntity(batteryEntities, ['soc', 'charge', 'level']);
    if (batterySoc) {
      config.battery.socEntity = {
        entityId: batterySoc.entity_id,
        displayName: batterySoc.friendly_name,
      };
    }

    const batteryPower = findEntity(batteryEntities, ['power', 'i_o', 'io']);
    if (batteryPower) {
      config.battery.powerEntity = {
        entityId: batteryPower.entity_id,
        displayName: batteryPower.friendly_name,
      };
    }

    const batteryTemp = findEntity(batteryEntities, ['temp', 'temperature']);
    if (batteryTemp) {
      config.battery.temperatureEntity = {
        entityId: batteryTemp.entity_id,
        displayName: batteryTemp.friendly_name,
      };
    }

    const solarPower = findEntity(solarEntities, ['power', 'generation']);
    if (solarPower) {
      config.solar.powerEntity = {
        entityId: solarPower.entity_id,
        displayName: solarPower.friendly_name,
      };
    }

    const solarEnergy = findEntity(solarEntities, ['energy', 'today', 'daily']);
    if (solarEnergy) {
      config.solar.energyTodayEntity = {
        entityId: solarEnergy.entity_id,
        displayName: solarEnergy.friendly_name,
      };
    }

    const gridPower = findEntity(gridEntities, ['power']);
    if (gridPower) {
      config.grid.powerEntity = {
        entityId: gridPower.entity_id,
        displayName: gridPower.friendly_name,
      };
    }

    const gridImport = findEntity(gridEntities, ['import']);
    if (gridImport) {
      config.grid.importTodayEntity = {
        entityId: gridImport.entity_id,
        displayName: gridImport.friendly_name,
      };
    }

    const gridExport = findEntity(gridEntities, ['export']);
    if (gridExport) {
      config.grid.exportTodayEntity = {
        entityId: gridExport.entity_id,
        displayName: gridExport.friendly_name,
      };
    }

    const homePower = findEntity(consumptionEntities, ['power', 'load']);
    if (homePower) {
      config.home.powerEntity = {
        entityId: homePower.entity_id,
        displayName: homePower.friendly_name,
      };
    }

    const homeEnergy = findEntity(consumptionEntities, ['energy', 'consumption', 'today']);
    if (homeEnergy) {
      config.home.consumptionTodayEntity = {
        entityId: homeEnergy.entity_id,
        displayName: homeEnergy.friendly_name,
      };
    }

    return config;
  }

  async resetConfiguration(): Promise<void> {
    await this.saveConfiguration(DEFAULT_CONFIG);
  }
}

export const energyConfigService = new EnergyConfigService();
