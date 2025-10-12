export interface Entity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
  friendly_name?: string;
  device_class?: string;
  unit_of_measurement?: string;
}

export interface Room {
  id: string;
  name: string;
  icon: string;
  entities: string[];
}

export interface EnergyData {
  entity_id: string;
  consumption: number;
  cost: number;
  timestamp: string;
}

export interface EnergyMapping {
  solar: string[];
  battery: string[];
  homeLoad: string[];
  grid: string[];
  devices: { [key: string]: string[] };
}

export interface RealTimeEnergyData {
  solar: number;
  battery: number;
  batteryLevel: number;
  homeLoad: number;
  gridImport: number;
  gridExport: number;
  timestamp: Date;
}

export interface AIMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'assistant';
  action?: string;
}

export interface HomeAssistantConfig {
  url: string;
  token: string;
  connected: boolean;
  connectionType?: 'direct' | 'cloudflare';
}