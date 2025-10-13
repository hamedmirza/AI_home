import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { Entity } from '../types/homeAssistant';
import { homeAssistantService } from '../services/homeAssistant';
import { AISuggestions } from './AISuggestions';
import {
  Home,
  Lightbulb,
  Power,
  Thermometer,
  Zap,
  TrendingUp,
  Wifi,
  AlertCircle
} from 'lucide-react';

interface OverviewProps {
  entities: Entity[];
  onEntityToggle: (entityId: string) => void;
  isConnected: boolean;
}

export const Overview: React.FC<OverviewProps> = ({ entities, onEntityToggle, isConnected }) => {
  const [energyData, setEnergyData] = useState<any[]>([]);
  const [systemStatus, setSystemStatus] = useState({
    connected: isConnected,
    entitiesOnline: entities.length,
    lastUpdate: new Date().toLocaleTimeString()
  });

  useEffect(() => {
    setSystemStatus(prev => ({ ...prev, connected: isConnected }));
    if (isConnected) {
      loadEnergyData();
    } else {
      setEnergyData([]);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        lastUpdate: new Date().toLocaleTimeString(),
        entitiesOnline: entities.length
      }));
      loadEnergyData();
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, entities.length]);

  const loadEnergyData = async () => {
    if (!isConnected) {
      return;
    }

    const data = await homeAssistantService.getEnergyData();
    setEnergyData(data);
  };

  const lightEntities = entities.filter(e => e.entity_id.startsWith('light.'));
  const switchEntities = entities.filter(e => e.entity_id.startsWith('switch.'));
  const sensorEntities = entities.filter(e => e.entity_id.startsWith('sensor.'));

  const totalEnergyConsumption = sensorEntities
    .find(e => e.entity_id === 'sensor.energy_consumption')?.state || '0';
  
  const temperature = sensorEntities
    .find(e => e.device_class === 'temperature')?.state || '--';

  const activeDevices = [...lightEntities, ...switchEntities].filter(e => e.state === 'on').length;

  const currentHour = new Date().getHours();
  const todaysConsumption = energyData
    .filter(d => new Date(d.timestamp).getHours() <= currentHour)
    .reduce((sum, d) => sum + d.consumption, 0);

  return (
    <div className="space-y-6">
      {/* System Status Bar */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Wifi className={`w-4 h-4 ${systemStatus.connected ? 'text-green-500' : 'text-red-500'}`} />
                <span className="text-sm font-medium">
                  {systemStatus.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {systemStatus.entitiesOnline} entities online
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Last update: {systemStatus.lastUpdate}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Devices</p>
                <p className="text-2xl font-bold text-gray-900">{activeDevices}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Power className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Temperature</p>
                <p className="text-2xl font-bold text-gray-900">{temperature}°C</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Thermometer className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Energy Today</p>
                <p className="text-2xl font-bold text-gray-900">{todaysConsumption.toFixed(1)} kWh</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Entities</p>
                <p className="text-2xl font-bold text-gray-900">{entities.length}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Home className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card Types Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gauge Card - Battery Level */}
        <Card>
          <CardHeader>
            <CardTitle>Battery Level (Gauge)</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const batteryEntity = sensorEntities.find(e => e.device_class === 'battery') || sensorEntities[0];
              if (!batteryEntity) return <div className="text-center text-gray-400 py-8">No sensor available</div>;
              const value = parseFloat(batteryEntity.state) || 75;
              const max = 100;
              const percentage = Math.min((value / max) * 100, 100);

              return (
                <div className="text-center">
                  <div className="relative w-32 h-32 mx-auto mb-3">
                    <svg className="transform -rotate-90 w-32 h-32">
                      <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200" />
                      <circle
                        cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="none"
                        strokeDasharray={`${2 * Math.PI * 56}`}
                        strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
                        className="text-blue-600 transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900">{value.toFixed(0)}</span>
                      <span className="text-xs text-gray-500">{batteryEntity.unit_of_measurement || '%'}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{batteryEntity.friendly_name || 'Battery'}</p>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Sensor Card - Energy Consumption */}
        <Card>
          <CardHeader>
            <CardTitle>Energy Usage (Sensor)</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const energyEntity = sensorEntities.find(e => e.device_class === 'energy' || e.entity_id.includes('energy')) || sensorEntities[1];
              if (!energyEntity) return <div className="text-center text-gray-400 py-8">No sensor available</div>;

              return (
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-gray-900 mb-1">
                    {energyEntity.state}
                    <span className="text-lg text-gray-500 ml-2">{energyEntity.unit_of_measurement || 'kWh'}</span>
                  </div>
                  <p className="text-sm text-gray-600">{energyEntity.friendly_name || 'Energy Consumption'}</p>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Light Card with Brightness */}
        <Card>
          <CardHeader>
            <CardTitle>Smart Light Control</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const lightEntity = lightEntities[0];
              if (!lightEntity) return <div className="text-center text-gray-400 py-8">No light available</div>;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        lightEntity.state === 'on' ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        <Lightbulb className={`w-6 h-6 ${lightEntity.state === 'on' ? 'text-yellow-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{lightEntity.friendly_name}</p>
                        <p className="text-sm text-gray-500 capitalize">{lightEntity.state}</p>
                      </div>
                    </div>
                    <Switch
                      checked={lightEntity.state === 'on'}
                      onChange={() => onEntityToggle(lightEntity.entity_id)}
                    />
                  </div>
                  {lightEntity.state === 'on' && lightEntity.attributes.brightness && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-2">
                        Brightness: {Math.round((lightEntity.attributes.brightness / 255) * 100)}%
                      </label>
                      <input type="range" min="0" max="255" value={lightEntity.attributes.brightness} className="w-full" disabled />
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* More Card Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Thermostat Card */}
        <Card>
          <CardHeader>
            <CardTitle>Climate Control (Thermostat)</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const climateEntity = entities.find(e => e.entity_id.startsWith('climate.')) ||
                sensorEntities.find(e => e.device_class === 'temperature');

              if (!climateEntity) return <div className="text-center text-gray-400 py-8">No climate device available</div>;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <Thermometer className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{climateEntity.friendly_name || 'Temperature'}</p>
                        <p className="text-sm text-gray-500">{climateEntity.state}°</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Target Temperature</label>
                    <input type="range" min="16" max="30" defaultValue="21" className="w-full" />
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Grid Card - Multiple Entities */}
        <Card>
          <CardHeader>
            <CardTitle>Device Grid</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const gridEntities = [...lightEntities, ...switchEntities].slice(0, 4);
              if (gridEntities.length === 0) return <div className="text-center text-gray-400 py-8">No devices available</div>;

              return (
                <div className="grid grid-cols-2 gap-3">
                  {gridEntities.map(entity => (
                    <div
                      key={entity.entity_id}
                      className="p-3 border border-gray-200 rounded-lg hover:border-blue-400 transition-colors cursor-pointer"
                      onClick={() => onEntityToggle(entity.entity_id)}
                    >
                      <p className="text-xs font-medium text-gray-900 truncate">{entity.friendly_name}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{entity.state}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Energy Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span>Energy Usage (Last 24 Hours)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end space-x-1">
            {energyData.slice(-24).map((data, index) => (
              <div
                key={index}
                className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm min-h-[4px] transition-all duration-300 hover:opacity-80"
                style={{ height: `${(data.consumption / 5) * 100}%` }}
                title={`${new Date(data.timestamp).getHours()}:00 - ${data.consumption.toFixed(1)} kWh`}
              />
            ))}
          </div>
          <div className="mt-4 flex justify-between text-xs text-gray-500">
            <span>24h ago</span>
            <span>Now</span>
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions Section */}
      <AISuggestions entities={entities} />
    </div>
  );
};