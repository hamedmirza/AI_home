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

      {/* Quick Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              <span>Lights</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lightEntities.slice(0, 4).map(entity => (
                <div key={entity.entity_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{entity.friendly_name}</p>
                    <p className="text-sm text-gray-500">
                      {entity.state === 'on' ? 'On' : 'Off'}
                      {entity.attributes.brightness && ` • ${Math.round((entity.attributes.brightness / 255) * 100)}%`}
                    </p>
                  </div>
                  <Switch
                    checked={entity.state === 'on'}
                    onChange={() => onEntityToggle(entity.entity_id)}
                    disabled={false}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Power className="w-5 h-5 text-blue-500" />
              <span>Switches & Outlets</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {switchEntities.slice(0, 4).map(entity => (
                <div key={entity.entity_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{entity.friendly_name}</p>
                    <p className="text-sm text-gray-500">
                      {entity.state === 'on' ? 'On' : 'Off'}
                      {entity.attributes.current_power_w && ` • ${entity.attributes.current_power_w}W`}
                    </p>
                  </div>
                  <Switch
                    checked={entity.state === 'on'}
                    onChange={() => onEntityToggle(entity.entity_id)}
                    disabled={false}
                  />
                </div>
              ))}
            </div>
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