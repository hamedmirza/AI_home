import type { DashboardConfig } from '../types/cards';

export const defaultDashboard: DashboardConfig = {
  title: 'AI Energy Dashboard',
  cards: [
    {
      id: 'flow',
      type: 'energy-flow',
      title: 'Energy Flow',
      cols: 2,
      rows: 2,
      entities: {
        pv: 'sensor.pv_power',
        grid: 'sensor.grid_power',
        battery: 'sensor.battery_power',
        house: 'sensor.house_load'
      }
    },
    {
      id: 'pvts',
      type: 'timeseries',
      title: 'Solar Production (24h)',
      entity: 'sensor.pv_power',
      cols: 2,
      rows: 2,
      windowHours: 24
    },
    {
      id: 'ask',
      type: 'llm-ask',
      title: 'Ask Energy AI',
      cols: 2,
      rows: 2,
      persona: 'HA Energy Expert'
    },
    {
      id: 'entities',
      type: 'entity-table',
      title: 'Energy Entities',
      cols: 2,
      rows: 2,
      entities: [
        'sensor.pv_power',
        'sensor.grid_power',
        'sensor.battery_power',
        'sensor.house_load',
        'sensor.battery_soc'
      ]
    }
  ]
};
