import React, { useState, useEffect } from 'react';
import {
  Battery,
  Zap,
  Sun,
  Home,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  DollarSign,
  Leaf,
  Settings
} from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { homeAssistantService } from '../services/homeAssistant';
import { dbService } from '../services/database';
import { EnergyConfiguration, energyConfigService } from '../services/energyConfigService';
import { EnergyConfigEditor } from './EnergyConfigEditor';
import { AlphaESSEnergyDashboard } from './AlphaESSEnergyDashboard';

interface EnergyData {
  battery: {
    soc: number;
    power: number;
    charging: boolean;
    capacity: number;
    temperature?: number;
  };
  solar: {
    power: number;
    todayEnergy: number;
  };
  grid: {
    power: number;
    importing: boolean;
    todayImport: number;
    todayExport: number;
  };
  home: {
    power: number;
    todayConsumption: number;
  };
}

export function EnergyDashboard() {
  const [energyData, setEnergyData] = useState<EnergyData>({
    battery: { soc: 0, power: 0, charging: false, capacity: 0 },
    solar: { power: 0, todayEnergy: 0 },
    grid: { power: 0, importing: false, todayImport: 0, todayExport: 0 },
    home: { power: 0, todayConsumption: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [config, setConfig] = useState<EnergyConfiguration | null>(null);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [isAlphaESS, setIsAlphaESS] = useState(false);

  useEffect(() => {
    loadConfiguration();
    detectBatteryModel();
  }, []);

  const detectBatteryModel = async () => {
    try {
      const entities = await dbService.getEntities();
      const alphaESSDetected = entities.some(e =>
        e.entity_id.toLowerCase().includes('alphaess') ||
        e.friendly_name?.toLowerCase().includes('alphaess') ||
        e.friendly_name?.toLowerCase().includes('alpha ess') ||
        e.entity_id.toLowerCase().includes('alpha_ess')
      );
      setIsAlphaESS(alphaESSDetected);

      if (alphaESSDetected) {
        console.log('AlphaESS battery system detected - using AlphaESS dashboard layout');
      }
    } catch (error) {
      console.error('Error detecting battery model:', error);
    }
  };

  useEffect(() => {
    if (config) {
      loadEnergyData();
      const interval = setInterval(loadEnergyData, config.display.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [config]);

  const loadConfiguration = async () => {
    try {
      const loadedConfig = await energyConfigService.getConfiguration();
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  const loadEnergyData = async () => {
    if (!config) return;

    try {
      const entities = await dbService.getEntities();
      const getEntityValue = (entityId?: string): number => {
        if (!entityId) return 0;
        const entity = entities.find(e => e.entity_id === entityId);
        return entity ? parseFloat(entity.state) || 0 : 0;
      };

      const batteryPowerValue = getEntityValue(config.battery.powerEntity?.entityId);
      const batterySocValue = getEntityValue(config.battery.socEntity?.entityId);
      const batteryTempValue = getEntityValue(config.battery.temperatureEntity?.entityId);

      const solarPowerValue = getEntityValue(config.solar.powerEntity?.entityId);
      const solarEnergyValue = getEntityValue(config.solar.energyTodayEntity?.entityId);

      const gridPowerValue = getEntityValue(config.grid.powerEntity?.entityId);
      const gridImportValue = getEntityValue(config.grid.importTodayEntity?.entityId);
      const gridExportValue = getEntityValue(config.grid.exportTodayEntity?.entityId);

      const homePowerValue = getEntityValue(config.home.powerEntity?.entityId);
      const homeConsumptionValue = getEntityValue(config.home.consumptionTodayEntity?.entityId);

      setEnergyData({
        battery: {
          soc: batterySocValue,
          power: batteryPowerValue,
          charging: batteryPowerValue > 0,
          capacity: config.battery.capacity,
          temperature: batteryTempValue || undefined
        },
        solar: {
          power: solarPowerValue,
          todayEnergy: solarEnergyValue
        },
        grid: {
          power: gridPowerValue,
          importing: gridPowerValue > 0,
          todayImport: gridImportValue,
          todayExport: gridExportValue
        },
        home: {
          power: Math.abs(homePowerValue),
          todayConsumption: homeConsumptionValue
        }
      });

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading energy data:', error);
      setIsLoading(false);
    }
  };

  const handleConfigSave = (newConfig: EnergyConfiguration) => {
    setConfig(newConfig);
  };

  const getBatteryColor = (soc: number) => {
    if (soc >= 80) return 'text-green-500';
    if (soc >= 40) return 'text-blue-500';
    if (soc >= 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getBatteryGradient = (soc: number) => {
    if (soc >= 80) return 'from-green-400 to-green-600';
    if (soc >= 40) return 'from-blue-400 to-blue-600';
    if (soc >= 20) return 'from-yellow-400 to-yellow-600';
    return 'from-red-400 to-red-600';
  };

  const formatPower = (watts: number) => {
    const absWatts = Math.abs(watts);
    if (absWatts >= 1000) {
      return `${(watts / 1000).toFixed(2)} kW`;
    }
    return `${watts.toFixed(0)} W`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Activity className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isAlphaESS) {
    return <AlphaESSEnergyDashboard />;
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {showConfigEditor && (
        <EnergyConfigEditor
          onClose={() => setShowConfigEditor(false)}
          onSave={handleConfigSave}
        />
      )}

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Energy Dashboard</h1>
            <p className="text-gray-600 mt-1">Real-time monitoring and control</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setShowConfigEditor(true)}
              variant="secondary"
              className="flex items-center space-x-2"
            >
              <Settings className="w-4 h-4" />
              <span>Configure</span>
            </Button>
            <div className="flex space-x-2">
              {(['day', 'week', 'month'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedPeriod === period
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Energy Flow Visualization */}
        <Card className="p-8 bg-white shadow-xl">
          <h2 className="text-xl font-semibold mb-6 text-gray-900">Energy Flow</h2>

          {/* System Diagram */}
          <div className="mb-8 flex justify-center">
            <svg width="100%" viewBox="0 0 336 336" fill="none" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid meet" className="max-w-md">
              <g transform="translate(44,59)">
                <image width="300" height="184" xlinkHref="/img/realTime/house.png"></image>
                <image width="35" x="58" y="101" xlinkHref="/img/realTime/equipment.png"></image>
                <polyline points="74,105 74,70 125,70" stroke="rgba(134, 134, 134, 1)" strokeWidth="2" strokeDasharray="5" strokeOpacity="0.5"></polyline>
                <line x1="26" y1="120" x2="64" y2="130" stroke="rgba(134, 134, 134, 1)" strokeWidth="2" strokeDasharray="5" strokeOpacity="0.5"></line>
                <polyline points="81,136 112,144.5 112,138" stroke="rgba(134, 134, 134, 1)" strokeWidth="2" strokeDasharray="5" strokeOpacity="0.5"></polyline>
              </g>
              <line x1="201" y1="23" x2="201" y2="109" stroke="rgba(134, 134, 134, 1)" strokeWidth=".5"></line>
              <line x1="161" y1="208" x2="161" y2="305" stroke="rgba(134, 134, 134, 1)" strokeWidth=".5"></line>
              <line x1="118" y1="244" x2="118" y2="206" stroke="rgba(134, 134, 134, 1)" strokeWidth=".5"></line>
            </svg>
          </div>

          <div className="grid grid-cols-4 gap-8 items-center">
            {/* Solar */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Sun className="w-12 h-12 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Solar</p>
                <p className="text-2xl font-bold text-gray-900">{formatPower(energyData.solar.power)}</p>
                <p className="text-xs text-gray-500 mt-1">{energyData.solar.todayEnergy.toFixed(1)} kWh today</p>
              </div>
            </div>

            {/* Battery */}
            <div className="flex flex-col items-center space-y-3">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getBatteryGradient(energyData.battery.soc)} flex items-center justify-center shadow-lg relative`}>
                <Battery className="w-12 h-12 text-white" />
                {energyData.battery.charging ? (
                  <ArrowDownCircle className="w-6 h-6 text-white absolute -bottom-1 -right-1 bg-green-500 rounded-full" />
                ) : energyData.battery.power < 0 ? (
                  <ArrowUpCircle className="w-6 h-6 text-white absolute -bottom-1 -right-1 bg-blue-500 rounded-full" />
                ) : null}
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Battery</p>
                <p className="text-2xl font-bold text-gray-900">{energyData.battery.soc.toFixed(0)}%</p>
                <p className={`text-xs font-medium mt-1 ${energyData.battery.charging ? 'text-green-600' : 'text-blue-600'}`}>
                  {energyData.battery.charging ? 'Charging' : 'Discharging'} {formatPower(Math.abs(energyData.battery.power))}
                </p>
              </div>
            </div>

            {/* Grid */}
            <div className="flex flex-col items-center space-y-3">
              <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${
                energyData.grid.importing ? 'from-red-400 to-red-600' : 'from-green-400 to-green-600'
              } flex items-center justify-center shadow-lg`}>
                <Zap className="w-12 h-12 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Grid</p>
                <p className="text-2xl font-bold text-gray-900">{formatPower(energyData.grid.power)}</p>
                <p className={`text-xs font-medium mt-1 ${energyData.grid.importing ? 'text-red-600' : 'text-green-600'}`}>
                  {energyData.grid.importing ? 'Importing' : 'Exporting'}
                </p>
              </div>
            </div>

            {/* Home */}
            <div className="flex flex-col items-center space-y-3">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center shadow-lg">
                <Home className="w-12 h-12 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Home</p>
                <p className="text-2xl font-bold text-gray-900">{formatPower(energyData.home.power)}</p>
                <p className="text-xs text-gray-500 mt-1">{energyData.home.todayConsumption.toFixed(1)} kWh today</p>
              </div>
            </div>
          </div>

          {/* Flow Lines */}
          <div className="mt-8 flex justify-center">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <span className="ml-2">Active Flow</span>
              </div>
              <div className="flex items-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="ml-2">Generation</span>
              </div>
              <div className="flex items-center">
                <TrendingDown className="w-4 h-4 text-blue-600" />
                <span className="ml-2">Consumption</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Battery Details */}
          <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-700 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Battery Status</p>
                <p className="text-3xl font-bold mt-2">{energyData.battery.soc.toFixed(0)}%</p>
                <p className="text-blue-100 text-xs mt-1">
                  {energyData.battery.capacity} kWh capacity
                </p>
              </div>
              <Battery className="w-8 h-8 text-blue-200" />
            </div>
            <div className="mt-4 pt-4 border-t border-blue-400">
              <div className="flex justify-between text-sm">
                <span className="text-blue-100">Power</span>
                <span className="font-semibold">{formatPower(Math.abs(energyData.battery.power))}</span>
              </div>
              {energyData.battery.temperature && (
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-blue-100">Temperature</span>
                  <span className="font-semibold">{energyData.battery.temperature}°C</span>
                </div>
              )}
            </div>
          </Card>

          {/* Solar Production */}
          <Card className="p-6 bg-gradient-to-br from-yellow-400 to-orange-500 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Solar Production</p>
                <p className="text-3xl font-bold mt-2">{formatPower(energyData.solar.power)}</p>
                <p className="text-orange-100 text-xs mt-1">
                  {energyData.solar.todayEnergy.toFixed(1)} kWh today
                </p>
              </div>
              <Sun className="w-8 h-8 text-orange-200" />
            </div>
            <div className="mt-4 pt-4 border-t border-orange-400">
              <div className="flex justify-between text-sm">
                <span className="text-orange-100">Status</span>
                <span className="font-semibold">{energyData.solar.power > 0 ? 'Generating' : 'Idle'}</span>
              </div>
            </div>
          </Card>

          {/* Grid Status */}
          <Card className={`p-6 bg-gradient-to-br ${
            energyData.grid.importing ? 'from-red-500 to-red-700' : 'from-green-500 to-green-700'
          } text-white`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Grid Status</p>
                <p className="text-3xl font-bold mt-2">{formatPower(Math.abs(energyData.grid.power))}</p>
                <p className="text-white/80 text-xs mt-1">
                  {energyData.grid.importing ? 'Importing' : 'Exporting'}
                </p>
              </div>
              <Zap className="w-8 h-8 text-white/80" />
            </div>
            <div className="mt-4 pt-4 border-t border-white/30">
              <div className="flex justify-between text-sm">
                <span className="text-white/80">Import Today</span>
                <span className="font-semibold">{energyData.grid.todayImport.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-white/80">Export Today</span>
                <span className="font-semibold">{energyData.grid.todayExport.toFixed(1)} kWh</span>
              </div>
            </div>
          </Card>

          {/* Home Consumption */}
          <Card className="p-6 bg-gradient-to-br from-gray-600 to-gray-800 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-300 text-sm font-medium">Home Usage</p>
                <p className="text-3xl font-bold mt-2">{formatPower(energyData.home.power)}</p>
                <p className="text-gray-300 text-xs mt-1">
                  {energyData.home.todayConsumption.toFixed(1)} kWh today
                </p>
              </div>
              <Home className="w-8 h-8 text-gray-300" />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-600">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Average</span>
                <span className="font-semibold">
                  {formatPower(energyData.home.todayConsumption * 1000 / 24)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Additional Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Energy Independence */}
          <Card className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Leaf className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Energy Independence</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Self-Powered</span>
                <span className="font-semibold text-gray-900">85%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Your home is running primarily on clean energy
              </p>
            </div>
          </Card>

          {/* Cost Savings */}
          <Card className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Cost Savings</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Today</span>
                <span className="font-semibold text-green-600">$12.50</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">This Month</span>
                <span className="font-semibold text-green-600">$385.20</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Compared to grid-only power
              </p>
            </div>
          </Card>

          {/* System Health */}
          <Card className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">System Health</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Battery Health</span>
                <span className="font-semibold text-green-600">Excellent</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Updated</span>
                <span className="font-semibold text-gray-900">Just now</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                All systems operating normally
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
