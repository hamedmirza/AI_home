export interface CardBase {
  id: string;
  type: string;
  title?: string;
  cols?: number;
  rows?: number;
  refreshSeconds?: number;
}

export interface EnergyFlowCard extends CardBase {
  type: 'energy-flow';
  entities: {
    pv: string;
    grid: string;
    battery?: string;
    house: string;
  };
}

export interface TimeseriesCard extends CardBase {
  type: 'timeseries';
  entity: string;
  windowHours?: number;
}

export interface EntityTableCard extends CardBase {
  type: 'entity-table';
  entities: string[];
}

export interface CostHeatmapCard extends CardBase {
  type: 'cost-heatmap';
  entity: string;
  days?: number;
}

export interface SuggestionsCard extends CardBase {
  type: 'suggestions';
  limit?: number;
}

export interface LLMAskCard extends CardBase {
  type: 'llm-ask';
  persona?: string;
}

export interface ForecastCard extends CardBase {
  type: 'forecast';
  what?: 'pv' | 'load' | 'net';
  hours?: number;
}

export interface DeviceStatusCard extends CardBase {
  type: 'device-status';
  area?: string;
}

export interface GaugeCard extends CardBase {
  type: 'gauge';
  entity: string;
  min?: number;
  max?: number;
  unit?: string;
}

export interface WeatherCard extends CardBase {
  type: 'weather';
  entity: string;
}

export type AnyCard =
  | EnergyFlowCard
  | TimeseriesCard
  | EntityTableCard
  | CostHeatmapCard
  | SuggestionsCard
  | LLMAskCard
  | ForecastCard
  | DeviceStatusCard
  | GaugeCard
  | WeatherCard;

export interface DashboardConfig {
  title: string;
  cards: AnyCard[];
}
