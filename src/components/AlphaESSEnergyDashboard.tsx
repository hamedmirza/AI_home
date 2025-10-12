import React, { useState, useEffect } from 'react';
import {
  Battery,
  Zap,
  Sun,
  Home,
  Settings,
  Power,
  Car
} from 'lucide-react';
import { dbService } from '../services/database';
import { EnergyConfiguration, energyConfigService } from '../services/energyConfigService';
import { EnergyConfigEditor } from './EnergyConfigEditor';

interface PowerFlowData {
  solar: number;
  battery: number;
  grid: number;
  load: number;
  batterySoc: number;
  batteryStatus: 'charging' | 'discharging' | 'idle';
}

interface DailyStats {
  solarGeneration: number;
  solarConsumption: number;
  batteryCharge: number;
  batteryDischarge: number;
  gridImport: number;
  gridConsumption: number;
}

interface PowerHistoryPoint {
  timestamp: number;
  solar: number;
  battery: number;
  grid: number;
  load: number;
}

export function AlphaESSEnergyDashboard() {
  const [powerFlow, setPowerFlow] = useState<PowerFlowData>({
    solar: 0,
    battery: 0,
    grid: 0,
    load: 0,
    batterySoc: 0,
    batteryStatus: 'idle'
  });
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    solarGeneration: 0,
    solarConsumption: 0,
    batteryCharge: 0,
    batteryDischarge: 0,
    gridImport: 0,
    gridConsumption: 0
  });
  const [config, setConfig] = useState<EnergyConfiguration | null>(null);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [powerHistory, setPowerHistory] = useState<PowerHistoryPoint[]>([]);

  useEffect(() => {
    loadConfiguration();
  }, []);

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

      const solarPower = getEntityValue(config.solar.powerEntity?.entityId);
      const batteryPower = getEntityValue(config.battery.powerEntity?.entityId);
      const batterySoc = getEntityValue(config.battery.socEntity?.entityId);
      const gridPower = getEntityValue(config.grid.powerEntity?.entityId);
      const loadPower = getEntityValue(config.home.powerEntity?.entityId);

      const solarEnergy = getEntityValue(config.solar.energyTodayEntity?.entityId);
      const gridImport = getEntityValue(config.grid.importTodayEntity?.entityId);
      const consumption = getEntityValue(config.home.consumptionTodayEntity?.entityId);

      setPowerFlow({
        solar: Math.abs(solarPower),
        battery: Math.abs(batteryPower),
        grid: Math.abs(gridPower),
        load: Math.abs(loadPower),
        batterySoc: batterySoc,
        batteryStatus: batteryPower > 0 ? 'charging' : batteryPower < 0 ? 'discharging' : 'idle'
      });

      setDailyStats({
        solarGeneration: solarEnergy,
        solarConsumption: Math.abs(loadPower),
        batteryCharge: batteryPower > 0 ? Math.abs(batteryPower) : 0,
        batteryDischarge: batteryPower < 0 ? Math.abs(batteryPower) : 0,
        gridImport: gridImport,
        gridConsumption: consumption
      });

      // Update power history (keep last 30 points = 5 minutes at 10s intervals)
      setPowerHistory(prev => {
        const newPoint: PowerHistoryPoint = {
          timestamp: Date.now(),
          solar: Math.abs(solarPower),
          battery: Math.abs(batteryPower),
          grid: Math.abs(gridPower),
          load: Math.abs(loadPower)
        };
        const updated = [...prev, newPoint];
        return updated.slice(-30);
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

  const formatPower = (watts: number) => {
    if (watts >= 1000) {
      return (watts / 1000).toFixed(2);
    }
    return watts.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      {showConfigEditor && (
        <EnergyConfigEditor
          onClose={() => setShowConfigEditor(false)}
          onSave={handleConfigSave}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Energy Management</h1>
            <button
              onClick={() => setShowConfigEditor(true)}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Today Statistics */}
        <div className="px-6 py-6 bg-gray-50 border-b border-gray-200">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-900">Today</h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {/* Home & Solar */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex flex-col items-center mb-4">
                <div className="w-12 h-12 flex items-center justify-center mb-2">
                  <Home className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-sm font-medium text-blue-500">Home & Solar</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Consumed</span>
                  <span className="text-base font-semibold text-gray-900">
                    {dailyStats.solarConsumption.toFixed(2)} <span className="text-xs font-normal">kWh</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Generation</span>
                  <span className="text-base font-semibold text-gray-900">
                    {dailyStats.solarGeneration.toFixed(2)} <span className="text-xs font-normal">kWh</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Battery */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex flex-col items-center mb-4">
                <div className="w-12 h-12 flex items-center justify-center mb-2">
                  <Battery className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-sm font-medium text-green-500">Battery</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Charged</span>
                  <span className="text-base font-semibold text-gray-900">
                    {dailyStats.batteryCharge.toFixed(2)} <span className="text-xs font-normal">kWh</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Discharge</span>
                  <span className="text-base font-semibold text-gray-900">
                    {dailyStats.batteryDischarge.toFixed(2)} <span className="text-xs font-normal">kWh</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex flex-col items-center mb-4">
                <div className="w-12 h-12 flex items-center justify-center mb-2">
                  <Zap className="w-10 h-10 text-orange-500" />
                </div>
                <h3 className="text-sm font-medium text-orange-500">Grid</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Feed-in</span>
                  <span className="text-base font-semibold text-gray-900">
                    {dailyStats.gridImport.toFixed(2)} <span className="text-xs font-normal">kWh</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Consumed</span>
                  <span className="text-base font-semibold text-gray-900">
                    {dailyStats.gridConsumption.toFixed(2)} <span className="text-xs font-normal">kWh</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Real-time Power Graph */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Real-time Power Flow</h2>
                  <p className="text-xs text-gray-500 mt-1">Live data updated every 10 seconds</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-medium text-gray-700">Live</span>
                  </div>
                </div>
              </div>

              {/* Power values display */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border border-yellow-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Sun className="w-4 h-4 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-900">Solar</span>
                  </div>
                  <p className="text-lg font-bold text-yellow-900">{formatPower(powerFlow.solar)}</p>
                  <p className="text-xs text-yellow-700">kW</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Battery className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-medium text-green-900">Battery</span>
                  </div>
                  <p className="text-lg font-bold text-green-900">{formatPower(powerFlow.battery)}</p>
                  <p className="text-xs text-green-700">kW • {powerFlow.batterySoc.toFixed(0)}%</p>
                </div>

                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Zap className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-medium text-orange-900">Grid</span>
                  </div>
                  <p className="text-lg font-bold text-orange-900">{formatPower(powerFlow.grid)}</p>
                  <p className="text-xs text-orange-700">kW</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Home className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-900">Load</span>
                  </div>
                  <p className="text-lg font-bold text-blue-900">{formatPower(powerFlow.load)}</p>
                  <p className="text-xs text-blue-700">kW</p>
                </div>
              </div>

              {/* Graph */}
              <div className="relative bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg p-4 border border-gray-200" style={{ height: '280px' }}>
                <svg viewBox="0 0 600 240" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    {/* Gradients for each line */}
                    <linearGradient id="solarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.05"/>
                    </linearGradient>
                    <linearGradient id="batteryGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.05"/>
                    </linearGradient>
                    <linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#F97316" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="#F97316" stopOpacity="0.05"/>
                    </linearGradient>
                    <linearGradient id="loadGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05"/>
                    </linearGradient>
                  </defs>

                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map(i => (
                    <line
                      key={i}
                      x1="0"
                      y1={i * 60}
                      x2="600"
                      y2={i * 60}
                      stroke="#E5E7EB"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                  ))}

                  {/* Draw chart lines with filled areas */}
                  {powerHistory.length >= 2 && (() => {
                    const maxPower = Math.max(
                      ...powerHistory.map(p => Math.max(p.solar, p.battery, p.grid, p.load)),
                      1000
                    );
                    const xStep = 600 / (powerHistory.length - 1);

                    const createPath = (values: number[]) => {
                      const points = values.map((value, i) => {
                        const x = i * xStep;
                        const y = 240 - (value / maxPower) * 220;
                        return `${x},${y}`;
                      });
                      return points.join(' L ');
                    };

                    const createAreaPath = (values: number[]) => {
                      const points = values.map((value, i) => {
                        const x = i * xStep;
                        const y = 240 - (value / maxPower) * 220;
                        return `${x},${y}`;
                      });
                      return `M ${points.join(' L ')} L ${(values.length - 1) * xStep},240 L 0,240 Z`;
                    };

                    const solarValues = powerHistory.map(p => p.solar);
                    const batteryValues = powerHistory.map(p => p.battery);
                    const gridValues = powerHistory.map(p => p.grid);
                    const loadValues = powerHistory.map(p => p.load);

                    return (
                      <>
                        {/* Filled areas */}
                        <path d={createAreaPath(solarValues)} fill="url(#solarGradient)" />
                        <path d={createAreaPath(batteryValues)} fill="url(#batteryGradient)" />
                        <path d={createAreaPath(gridValues)} fill="url(#gridGradient)" />
                        <path d={createAreaPath(loadValues)} fill="url(#loadGradient)" />

                        {/* Lines */}
                        <path
                          d={`M ${createPath(solarValues)}`}
                          fill="none"
                          stroke="#FBBF24"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={`M ${createPath(batteryValues)}`}
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={`M ${createPath(gridValues)}`}
                          fill="none"
                          stroke="#F97316"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={`M ${createPath(loadValues)}`}
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Current value dots */}
                        {[
                          { value: solarValues[solarValues.length - 1], color: '#FBBF24' },
                          { value: batteryValues[batteryValues.length - 1], color: '#10B981' },
                          { value: gridValues[gridValues.length - 1], color: '#F97316' },
                          { value: loadValues[loadValues.length - 1], color: '#3B82F6' }
                        ].map((item, idx) => {
                          const x = (powerHistory.length - 1) * xStep;
                          const y = 240 - (item.value / maxPower) * 220;
                          return (
                            <g key={idx}>
                              <circle cx={x} cy={y} r="5" fill="white" stroke={item.color} strokeWidth="2.5" />
                              <circle cx={x} cy={y} r="2.5" fill={item.color} />
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 pr-2">
                  {powerHistory.length > 0 && (() => {
                    const maxPower = Math.max(
                      ...powerHistory.map(p => Math.max(p.solar, p.battery, p.grid, p.load)),
                      1000
                    );
                    return [4, 3, 2, 1, 0].map(i => (
                      <span key={i}>{((maxPower / 4) * i / 1000).toFixed(1)}</span>
                    ));
                  })()}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <span className="text-xs font-medium text-gray-700">Solar</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-xs font-medium text-gray-700">Battery</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-xs font-medium text-gray-700">Grid</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-medium text-gray-700">Load</span>
                </div>
              </div>
            </div>

            {/* Energy Diagram */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-4">
                <h2 className="text-base font-medium text-gray-900">Energy Diagram</h2>
                <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1">
                  <input type="date" className="border border-gray-300 rounded px-2 py-1" defaultValue="2025-10-10" />
                  <span>-</span>
                  <input type="date" className="border border-gray-300 rounded px-2 py-1" defaultValue="2025-10-10" />
                </div>
              </div>

              {/* Energy Flow Diagram */}
              <div className="relative" style={{ height: '350px' }}>
                <svg viewBox="0 0 600 400" className="w-full h-full">
                  {/* Solar Panel (Top Left) */}
                  <g>
                    <rect x="50" y="30" width="80" height="80" rx="8" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="2"/>
                    <path d="M 70 50 L 90 40 L 110 40 L 110 70 L 90 80 L 70 70 Z" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1"/>
                    <line x1="90" y1="40" x2="90" y2="80" stroke="#F59E0B" strokeWidth="1"/>
                    <line x1="70" y1="60" x2="110" y2="60" stroke="#F59E0B" strokeWidth="1"/>
                    <text x="90" y="100" textAnchor="middle" fill="#6B7280" fontSize="11">Solar</text>
                    <text x="90" y="125" textAnchor="middle" fill="#111827" fontSize="13" fontWeight="600">
                      {dailyStats.solarGeneration.toFixed(2)}kWh
                    </text>
                  </g>

                  {/* Feed-in (Top Right) */}
                  <g>
                    <rect x="470" y="30" width="80" height="80" rx="8" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="2"/>
                    <circle cx="510" cy="70" r="25" fill="none" stroke="#F59E0B" strokeWidth="2"/>
                    <line x1="498" y1="70" x2="522" y2="70" stroke="#F59E0B" strokeWidth="2"/>
                    <line x1="510" y1="58" x2="510" y2="82" stroke="#F59E0B" strokeWidth="2"/>
                    <text x="510" y="100" textAnchor="middle" fill="#6B7280" fontSize="11">Feed-in</text>
                    <text x="510" y="125" textAnchor="middle" fill="#111827" fontSize="13" fontWeight="600">
                      {dailyStats.gridImport.toFixed(2)}kWh
                    </text>
                  </g>

                  {/* Battery (Center) */}
                  <g>
                    <circle cx="300" cy="200" r="45" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="3"/>
                    <rect x="285" y="185" width="30" height="20" rx="2" fill="#F59E0B"/>
                    <rect x="280" y="190" width="40" height="25" rx="3" fill="none" stroke="#F59E0B" strokeWidth="2"/>
                    <text x="300" y="240" textAnchor="middle" fill="#111827" fontSize="13" fontWeight="600">
                      {powerFlow.batterySoc.toFixed(0)}%
                    </text>
                  </g>

                  {/* Load (Bottom) */}
                  <g>
                    <rect x="260" y="320" width="80" height="60" rx="8" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="2"/>
                    <circle cx="300" cy="345" r="15" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="2"/>
                    <path d="M 295 340 L 300 350 L 305 340 M 300 350 L 300 355" stroke="#F59E0B" strokeWidth="2" fill="none"/>
                    <text x="300" y="370" textAnchor="middle" fill="#111827" fontSize="13" fontWeight="600">
                      {dailyStats.gridConsumption.toFixed(2)}kWh
                    </text>
                  </g>

                  {/* Flow arrows and values */}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF"/>
                    </marker>
                  </defs>

                  {/* Solar to Battery */}
                  <path d="M 130 70 L 260 180" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" fill="none" markerEnd="url(#arrowhead)"/>
                  <text x="180" y="110" fill="#6B7280" fontSize="11">{(dailyStats.solarGeneration * 0.4).toFixed(2)}kWh</text>

                  {/* Grid to Battery */}
                  <path d="M 470 70 L 345 180" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" fill="none" markerEnd="url(#arrowhead)"/>
                  <text x="390" y="110" fill="#6B7280" fontSize="11">{(dailyStats.gridImport * 0.1).toFixed(2)}kWh</text>

                  {/* Battery to Load */}
                  <path d="M 300 245 L 300 315" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" fill="none" markerEnd="url(#arrowhead)"/>
                  <text x="310" y="280" fill="#6B7280" fontSize="11">{dailyStats.batteryDischarge.toFixed(2)}kWh</text>

                  {/* Solar direct to Load */}
                  <path d="M 90 130 L 280 315" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" fill="none" markerEnd="url(#arrowhead)"/>
                  <text x="160" y="240" fill="#6B7280" fontSize="11">{(dailyStats.solarGeneration * 0.6).toFixed(2)}kWh</text>

                  {/* Grid to Load */}
                  <path d="M 510 130 L 340 315" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="5,5" fill="none" markerEnd="url(#arrowhead)"/>
                  <text x="400" y="240" fill="#6B7280" fontSize="11">{(dailyStats.gridConsumption * 0.3).toFixed(2)}kWh</text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info Section */}
        <div className="px-6 pb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {/* Battery Status Bar */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">State of Charge</span>
                <span className="text-base font-semibold text-gray-900">{powerFlow.batterySoc.toFixed(1)}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all duration-500"
                  style={{ width: `${powerFlow.batterySoc}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>Battery: {powerFlow.batteryStatus === 'charging' ? 'Charging' :
                                powerFlow.batteryStatus === 'discharging' ? 'Discharging' : 'Standby'}</span>
                <span>Feed-in: {formatPower(powerFlow.grid)}W</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
