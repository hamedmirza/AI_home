import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Switch } from '../ui/Switch';
import { Trash2, Edit, GripVertical, Lightbulb, Thermometer, Power, TrendingUp } from 'lucide-react';
import { DashboardCard as DashboardCardType, CardType } from '../../services/dashboardService';

interface DashboardCardProps {
  card: DashboardCardType;
  entities: any[];
  onDelete?: () => void;
  onEdit?: () => void;
  onEntityAction?: (entityId: string, action: string, data?: any) => void;
}

export function DashboardCard({ card, entities, onDelete, onEdit, onEntityAction }: DashboardCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const cardEntities = entities.filter(e => card.entity_ids.includes(e.entity_id));

  const renderCardContent = () => {
    switch (card.card_type) {
      case 'entity':
        return <EntityCard entities={cardEntities} onEntityAction={onEntityAction} />;
      case 'entities':
        return <EntitiesCard entities={cardEntities} onEntityAction={onEntityAction} />;
      case 'light':
        return <LightCard entities={cardEntities} onEntityAction={onEntityAction} />;
      case 'gauge':
        return <GaugeCard entities={cardEntities} />;
      case 'sensor':
        return <SensorCard entities={cardEntities} />;
      case 'thermostat':
        return <ThermostatCard entities={cardEntities} onEntityAction={onEntityAction} />;
      case 'button':
        return <ButtonCard card={card} onEntityAction={onEntityAction} />;
      case 'grid':
        return <GridCard entities={cardEntities} onEntityAction={onEntityAction} />;
      default:
        return <PlaceholderCard card={card} />;
    }
  };

  return (
    <Card
      className="relative hover:shadow-lg transition-all duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (onDelete || onEdit) && (
        <div className="absolute top-2 right-2 flex space-x-2 z-10">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
              title="Edit card"
            >
              <Edit className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-2 bg-white rounded-lg shadow-md hover:bg-red-50 transition-colors"
              title="Delete card"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          )}
        </div>
      )}

      <div className="p-4">
        {card.title && (
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{card.title}</h3>
        )}
        {renderCardContent()}
      </div>
    </Card>
  );
}

function EntityCard({ entities, onEntityAction }: any) {
  if (entities.length === 0) return <EmptyState />;
  const entity = entities[0];

  const handleToggle = () => {
    const isOn = entity.state === 'on';
    onEntityAction?.(entity.entity_id, isOn ? 'turn_off' : 'turn_on');
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          entity.state === 'on' ? 'bg-yellow-100' : 'bg-gray-100'
        }`}>
          <Lightbulb className={`w-5 h-5 ${entity.state === 'on' ? 'text-yellow-600' : 'text-gray-400'}`} />
        </div>
        <div>
          <p className="font-medium text-gray-900">{entity.friendly_name || entity.entity_id}</p>
          <p className="text-sm text-gray-500 capitalize">{entity.state}</p>
        </div>
      </div>
      <Switch
        checked={entity.state === 'on'}
        onChange={handleToggle}
      />
    </div>
  );
}

function EntitiesCard({ entities, onEntityAction }: any) {
  if (entities.length === 0) return <EmptyState />;

  return (
    <div className="space-y-3">
      {entities.map((entity: any) => (
        <div key={entity.entity_id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors">
          <div>
            <p className="text-sm font-medium text-gray-900">{entity.friendly_name || entity.entity_id}</p>
            <p className="text-xs text-gray-500">{entity.state} {entity.unit_of_measurement || ''}</p>
          </div>
          {(entity.entity_id.startsWith('light.') || entity.entity_id.startsWith('switch.')) && (
            <Switch
              checked={entity.state === 'on'}
              onChange={() => {
                const isOn = entity.state === 'on';
                onEntityAction?.(entity.entity_id, isOn ? 'turn_off' : 'turn_on');
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function LightCard({ entities, onEntityAction }: any) {
  if (entities.length === 0) return <EmptyState />;
  const light = entities[0];
  const [brightness, setBrightness] = useState(light.attributes?.brightness || 255);

  const handleToggle = () => {
    const isOn = light.state === 'on';
    onEntityAction?.(light.entity_id, isOn ? 'turn_off' : 'turn_on');
  };

  const handleBrightnessChange = (value: number) => {
    setBrightness(value);
    onEntityAction?.(light.entity_id, 'set_brightness', { brightness: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            light.state === 'on' ? 'bg-yellow-100' : 'bg-gray-100'
          }`}>
            <Lightbulb className={`w-6 h-6 ${light.state === 'on' ? 'text-yellow-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{light.friendly_name || light.entity_id}</p>
            <p className="text-sm text-gray-500 capitalize">{light.state}</p>
          </div>
        </div>
        <Switch
          checked={light.state === 'on'}
          onChange={handleToggle}
        />
      </div>

      {light.state === 'on' && (
        <div>
          <label className="block text-sm text-gray-600 mb-2">Brightness: {Math.round((brightness / 255) * 100)}%</label>
          <input
            type="range"
            min="0"
            max="255"
            value={brightness}
            onChange={(e) => handleBrightnessChange(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

function GaugeCard({ entities }: any) {
  if (entities.length === 0) return <EmptyState />;
  const sensor = entities[0];
  const value = parseFloat(sensor.state) || 0;
  const max = sensor.attributes?.max || 100;
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="text-center">
      <div className="relative w-32 h-32 mx-auto mb-3">
        <svg className="transform -rotate-90 w-32 h-32">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 56}`}
            strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
            className="text-blue-600 transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          <span className="text-xs text-gray-500">{sensor.unit_of_measurement || ''}</span>
        </div>
      </div>
      <p className="text-sm text-gray-600">{sensor.friendly_name || sensor.entity_id}</p>
    </div>
  );
}

function SensorCard({ entities }: any) {
  if (entities.length === 0) return <EmptyState />;
  const sensor = entities[0];

  return (
    <div className="text-center py-4">
      <div className="text-4xl font-bold text-gray-900 mb-1">
        {sensor.state}
        <span className="text-lg text-gray-500 ml-2">{sensor.unit_of_measurement || ''}</span>
      </div>
      <p className="text-sm text-gray-600">{sensor.friendly_name || sensor.entity_id}</p>
    </div>
  );
}

function ThermostatCard({ entities, onEntityAction }: any) {
  if (entities.length === 0) return <EmptyState />;
  const climate = entities[0];
  const [temperature, setTemperature] = useState(climate.attributes?.temperature || 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Thermometer className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{climate.friendly_name || climate.entity_id}</p>
            <p className="text-sm text-gray-500">{climate.attributes?.current_temperature || climate.state}°</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-600 mb-2">Target: {temperature}°</label>
        <input
          type="range"
          min="16"
          max="30"
          value={temperature}
          onChange={(e) => {
            const temp = parseInt(e.target.value);
            setTemperature(temp);
            onEntityAction?.(climate.entity_id, 'set_temperature', { temperature: temp });
          }}
          className="w-full"
        />
      </div>
    </div>
  );
}

function ButtonCard({ card, onEntityAction }: any) {
  return (
    <Button
      onClick={() => {
        if (card.entity_ids[0]) {
          onEntityAction?.(card.entity_ids[0], 'press');
        }
      }}
      className="w-full"
    >
      {card.title || 'Press'}
    </Button>
  );
}

function GridCard({ entities, onEntityAction }: any) {
  if (entities.length === 0) return <EmptyState />;

  return (
    <div className="grid grid-cols-2 gap-3">
      {entities.map((entity: any) => (
        <div
          key={entity.entity_id}
          className="p-3 border border-gray-200 rounded-lg hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => {
            if (entity.entity_id.startsWith('light.') || entity.entity_id.startsWith('switch.')) {
              const isOn = entity.state === 'on';
              onEntityAction?.(entity.entity_id, isOn ? 'turn_off' : 'turn_on');
            }
          }}
        >
          <p className="text-xs font-medium text-gray-900 truncate">{entity.friendly_name || entity.entity_id}</p>
          <p className="text-xs text-gray-500 mt-1">{entity.state}</p>
        </div>
      ))}
    </div>
  );
}

function PlaceholderCard({ card }: any) {
  return (
    <div className="text-center py-8 text-gray-500">
      <p className="text-sm">Card type: {card.card_type}</p>
      <p className="text-xs mt-2">This card type is under development</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-gray-400">
      <p className="text-sm">No entities configured</p>
      <p className="text-xs mt-1">Edit card to add entities</p>
    </div>
  );
}
