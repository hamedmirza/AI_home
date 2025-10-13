import React from 'react';
import { Sun, Home, Battery, Zap, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';

interface PowerFlowProps {
  solar: number;        // kW
  battery: number;      // kW (positive = charging, negative = discharging)
  grid: number;         // kW (positive = importing, negative = exporting)
  home: number;         // kW
  batterySoc?: number;  // %
}

export function PowerFlowDiagram({ solar, battery, grid, home, batterySoc }: PowerFlowProps) {
  // Calculate flows
  const solarToHome = Math.min(solar, home);
  const solarToBattery = battery > 0 ? Math.min(battery, solar - solarToHome) : 0;
  const solarToGrid = Math.max(0, solar - solarToHome - solarToBattery);
  const batteryToHome = battery < 0 ? Math.min(Math.abs(battery), home - solarToHome) : 0;
  const gridToHome = Math.max(0, home - solarToHome - batteryToHome);

  const formatPower = (kw: number) => {
    if (Math.abs(kw) >= 1) return `${kw.toFixed(2)} kW`;
    return `${(kw * 1000).toFixed(0)} W`;
  };

  const FlowArrow = ({ value, direction = 'right' }: { value: number; direction?: 'right' | 'down' | 'up' }) => {
    if (value === 0) return null;

    const Arrow = direction === 'down' ? ArrowDown : direction === 'up' ? ArrowUp : ArrowRight;

    return (
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full animate-pulse">
          <Arrow className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">{formatPower(value)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full p-6">
      {/* Mobile/Tablet: Vertical Flow */}
      <div className="lg:hidden flex flex-col items-center justify-center space-y-6">
        {/* Solar */}
        <div className="flex flex-col items-center">
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-2xl shadow-xl">
            <Sun className="w-12 h-12 text-white" />
          </div>
          <div className="mt-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{formatPower(solar)}</div>
            <div className="text-sm text-gray-600">Solar</div>
          </div>
        </div>

        <FlowArrow value={solar} direction="down" />

        {/* Distribution Row */}
        <div className="grid grid-cols-3 gap-8 w-full max-w-2xl">
          {/* Home */}
          <div className="flex flex-col items-center">
            <div className="bg-gradient-to-br from-orange-400 to-red-500 p-5 rounded-2xl shadow-xl">
              <Home className="w-10 h-10 text-white" />
            </div>
            <div className="mt-2 text-center">
              <div className="text-xl font-bold text-gray-900">{formatPower(home)}</div>
              <div className="text-xs text-gray-600">Home</div>
            </div>
          </div>

          {/* Battery */}
          <div className="flex flex-col items-center">
            <div className={`p-5 rounded-2xl shadow-xl ${
              battery > 0 ? 'bg-gradient-to-br from-green-400 to-emerald-600' :
              battery < 0 ? 'bg-gradient-to-br from-blue-400 to-indigo-600' :
              'bg-gradient-to-br from-gray-400 to-gray-600'
            }`}>
              <Battery className="w-10 h-10 text-white" />
            </div>
            <div className="mt-2 text-center">
              <div className="text-xl font-bold text-gray-900">{formatPower(Math.abs(battery))}</div>
              <div className="text-xs text-gray-600">
                Battery {batterySoc !== undefined && `(${batterySoc}%)`}
              </div>
              <div className="text-xs font-medium text-gray-700">
                {battery > 0 ? 'Charging' : battery < 0 ? 'Discharging' : 'Idle'}
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className="flex flex-col items-center">
            <div className={`p-5 rounded-2xl shadow-xl ${
              grid > 0 ? 'bg-gradient-to-br from-red-400 to-pink-600' :
              grid < 0 ? 'bg-gradient-to-br from-blue-400 to-cyan-600' :
              'bg-gradient-to-br from-gray-400 to-gray-600'
            }`}>
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div className="mt-2 text-center">
              <div className="text-xl font-bold text-gray-900">{formatPower(Math.abs(grid))}</div>
              <div className="text-xs text-gray-600">Grid</div>
              <div className="text-xs font-medium text-gray-700">
                {grid > 0 ? 'Importing' : grid < 0 ? 'Exporting' : 'Idle'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Horizontal Flow */}
      <div className="hidden lg:flex items-center justify-center h-full">
        <div className="grid grid-cols-5 gap-8 items-center w-full max-w-6xl">
          {/* Solar */}
          <div className="flex flex-col items-center justify-center">
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-8 rounded-3xl shadow-2xl">
              <Sun className="w-16 h-16 text-white" />
            </div>
            <div className="mt-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{formatPower(solar)}</div>
              <div className="text-sm text-gray-600 font-medium">Solar Production</div>
            </div>
          </div>

          {/* Solar -> Home/Battery/Grid */}
          <div className="flex flex-col space-y-4">
            {solarToHome > 0 && <FlowArrow value={solarToHome} />}
            {solarToBattery > 0 && <FlowArrow value={solarToBattery} />}
            {solarToGrid > 0 && <FlowArrow value={solarToGrid} />}
            {gridToHome > 0 && (
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full">
                  <ArrowRight className="w-4 h-4 text-red-600 rotate-180" />
                  <span className="text-sm font-semibold text-red-900">{formatPower(gridToHome)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Home */}
          <div className="flex flex-col items-center justify-center">
            <div className="bg-gradient-to-br from-orange-400 to-red-500 p-8 rounded-3xl shadow-2xl">
              <Home className="w-16 h-16 text-white" />
            </div>
            <div className="mt-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{formatPower(home)}</div>
              <div className="text-sm text-gray-600 font-medium">Home Consumption</div>
            </div>
          </div>

          {/* Middle Column - Battery & Grid */}
          <div className="flex flex-col space-y-8">
            {/* Battery */}
            <div className="flex flex-col items-center">
              <div className={`p-6 rounded-3xl shadow-2xl ${
                battery > 0 ? 'bg-gradient-to-br from-green-400 to-emerald-600' :
                battery < 0 ? 'bg-gradient-to-br from-blue-400 to-indigo-600' :
                'bg-gradient-to-br from-gray-400 to-gray-600'
              }`}>
                <Battery className="w-12 h-12 text-white" />
              </div>
              <div className="mt-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{formatPower(Math.abs(battery))}</div>
                <div className="text-sm text-gray-600 font-medium">
                  Battery {batterySoc !== undefined && `(${batterySoc}%)`}
                </div>
                <div className="text-xs font-semibold mt-1 px-2 py-0.5 rounded-full inline-block" style={{
                  backgroundColor: battery > 0 ? '#dcfce7' : battery < 0 ? '#dbeafe' : '#f3f4f6',
                  color: battery > 0 ? '#065f46' : battery < 0 ? '#1e40af' : '#374151'
                }}>
                  {battery > 0 ? 'Charging' : battery < 0 ? 'Discharging' : 'Idle'}
                </div>
              </div>
            </div>

            {/* Grid */}
            <div className="flex flex-col items-center">
              <div className={`p-6 rounded-3xl shadow-2xl ${
                grid > 0 ? 'bg-gradient-to-br from-red-400 to-pink-600' :
                grid < 0 ? 'bg-gradient-to-br from-blue-400 to-cyan-600' :
                'bg-gradient-to-br from-gray-400 to-gray-600'
              }`}>
                <Zap className="w-12 h-12 text-white" />
              </div>
              <div className="mt-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{formatPower(Math.abs(grid))}</div>
                <div className="text-sm text-gray-600 font-medium">Grid</div>
                <div className="text-xs font-semibold mt-1 px-2 py-0.5 rounded-full inline-block" style={{
                  backgroundColor: grid > 0 ? '#fee2e2' : grid < 0 ? '#dbeafe' : '#f3f4f6',
                  color: grid > 0 ? '#991b1b' : grid < 0 ? '#1e40af' : '#374151'
                }}>
                  {grid > 0 ? 'Importing' : grid < 0 ? 'Exporting' : 'Idle'}
                </div>
              </div>
            </div>
          </div>

          {/* Energy Balance Summary */}
          <div className="flex flex-col space-y-4 bg-gray-50 p-6 rounded-2xl border-2 border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Energy Balance</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Solar → Home:</span>
                <span className="font-semibold text-gray-900">{formatPower(solarToHome)}</span>
              </div>
              {solarToBattery > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Solar → Battery:</span>
                  <span className="font-semibold text-green-700">{formatPower(solarToBattery)}</span>
                </div>
              )}
              {solarToGrid > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Solar → Grid:</span>
                  <span className="font-semibold text-blue-700">{formatPower(solarToGrid)}</span>
                </div>
              )}
              {gridToHome > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Grid → Home:</span>
                  <span className="font-semibold text-red-700">{formatPower(gridToHome)}</span>
                </div>
              )}
              {batteryToHome > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Battery → Home:</span>
                  <span className="font-semibold text-indigo-700">{formatPower(batteryToHome)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
