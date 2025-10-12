import React, { useState, useEffect } from 'react';
import { X, Search, Check, Zap, Save, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { dbService } from '../services/database';
import { EnergyConfiguration, energyConfigService } from '../services/energyConfigService';

interface EnergyConfigEditorProps {
  onClose: () => void;
  onSave: (config: EnergyConfiguration) => void;
}

export function EnergyConfigEditor({ onClose, onSave }: EnergyConfigEditorProps) {
  const [config, setConfig] = useState<EnergyConfiguration | null>(null);
  const [entities, setEntities] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<string>('');
  const [activeField, setActiveField] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedConfig, loadedEntities] = await Promise.all([
        energyConfigService.getConfiguration(),
        dbService.getEntities()
      ]);
      setConfig(loadedConfig);
      setEntities(loadedEntities);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoConfiguration = async () => {
    try {
      const autoConfig = await energyConfigService.autoConfigureFromEntities(entities);
      setConfig(autoConfig);
    } catch (error) {
      console.error('Error auto-configuring:', error);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      await energyConfigService.saveConfiguration(config);
      onSave(config);
      onClose();
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration');
    }
  };

  const handleReset = async () => {
    if (confirm('Reset to default configuration? This cannot be undone.')) {
      try {
        await energyConfigService.resetConfiguration();
        const defaultConfig = await energyConfigService.getConfiguration();
        setConfig(defaultConfig);
      } catch (error) {
        console.error('Error resetting configuration:', error);
      }
    }
  };

  const openEntitySelector = (section: string, field: string) => {
    setActiveSection(section);
    setActiveField(field);
    setSearchTerm('');
  };

  const selectEntity = (entity: any) => {
    if (!config) return;

    const newConfig = { ...config };
    const entityConfig = {
      entityId: entity.entity_id,
      displayName: entity.friendly_name,
    };

    if (activeSection === 'battery') {
      newConfig.battery = { ...newConfig.battery, [activeField]: entityConfig };
    } else if (activeSection === 'solar') {
      newConfig.solar = { ...newConfig.solar, [activeField]: entityConfig };
    } else if (activeSection === 'grid') {
      newConfig.grid = { ...newConfig.grid, [activeField]: entityConfig };
    } else if (activeSection === 'home') {
      newConfig.home = { ...newConfig.home, [activeField]: entityConfig };
    }

    setConfig(newConfig);
    setActiveSection('');
    setActiveField('');
  };

  const filteredEntities = entities.filter(e =>
    e.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.friendly_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading || !config) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <Card className="p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </Card>
      </div>
    );
  }

  if (activeSection && activeField) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Select Entity</h3>
              <button
                onClick={() => {
                  setActiveSection('');
                  setActiveField('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search entities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-2">
              {filteredEntities.map(entity => (
                <button
                  key={entity.entity_id}
                  onClick={() => selectEntity(entity)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="font-medium text-gray-900">{entity.friendly_name || entity.entity_id}</div>
                  <div className="text-sm text-gray-500">{entity.entity_id}</div>
                  <div className="text-sm text-gray-600 mt-1">Current: {entity.state} {entity.unit_of_measurement || ''}</div>
                </button>
              ))}
              {filteredEntities.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No entities found matching "{searchTerm}"
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Energy Dashboard Configuration</h2>
              <p className="text-gray-600 mt-1">Configure entity mappings and display settings</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex space-x-3">
            <Button onClick={handleAutoConfiguration} className="flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Auto-Configure</span>
            </Button>
            <Button onClick={handleReset} variant="secondary" className="flex items-center space-x-2">
              <RotateCcw className="w-4 h-4" />
              <span>Reset to Default</span>
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Battery Configuration</h3>
              <div className="space-y-3">
                <ConfigRow
                  label="State of Charge (SOC)"
                  entity={config.battery.socEntity}
                  onSelect={() => openEntitySelector('battery', 'socEntity')}
                />
                <ConfigRow
                  label="Battery Power"
                  entity={config.battery.powerEntity}
                  onSelect={() => openEntitySelector('battery', 'powerEntity')}
                />
                <ConfigRow
                  label="Temperature"
                  entity={config.battery.temperatureEntity}
                  onSelect={() => openEntitySelector('battery', 'temperatureEntity')}
                />
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700 w-48">Battery Capacity (kWh)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.battery.capacity}
                    onChange={(e) => setConfig({
                      ...config,
                      battery: { ...config.battery, capacity: parseFloat(e.target.value) }
                    })}
                    className="w-32"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Solar Configuration</h3>
              <div className="space-y-3">
                <ConfigRow
                  label="Solar Power"
                  entity={config.solar.powerEntity}
                  onSelect={() => openEntitySelector('solar', 'powerEntity')}
                />
                <ConfigRow
                  label="Today's Energy"
                  entity={config.solar.energyTodayEntity}
                  onSelect={() => openEntitySelector('solar', 'energyTodayEntity')}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Grid Configuration</h3>
              <div className="space-y-3">
                <ConfigRow
                  label="Grid Power"
                  entity={config.grid.powerEntity}
                  onSelect={() => openEntitySelector('grid', 'powerEntity')}
                />
                <ConfigRow
                  label="Import Today"
                  entity={config.grid.importTodayEntity}
                  onSelect={() => openEntitySelector('grid', 'importTodayEntity')}
                />
                <ConfigRow
                  label="Export Today"
                  entity={config.grid.exportTodayEntity}
                  onSelect={() => openEntitySelector('grid', 'exportTodayEntity')}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Home Configuration</h3>
              <div className="space-y-3">
                <ConfigRow
                  label="Home Power"
                  entity={config.home.powerEntity}
                  onSelect={() => openEntitySelector('home', 'powerEntity')}
                />
                <ConfigRow
                  label="Today's Consumption"
                  entity={config.home.consumptionTodayEntity}
                  onSelect={() => openEntitySelector('home', 'consumptionTodayEntity')}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Display Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700 w-48">Refresh Interval (ms)</label>
                  <Input
                    type="number"
                    step="1000"
                    value={config.display.refreshInterval}
                    onChange={(e) => setConfig({
                      ...config,
                      display: { ...config.display, refreshInterval: parseInt(e.target.value) }
                    })}
                    className="w-32"
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700 w-48">Cost per kWh ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.display.costPerKwh}
                    onChange={(e) => setConfig({
                      ...config,
                      display: { ...config.display, costPerKwh: parseFloat(e.target.value) }
                    })}
                    className="w-32"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex items-center space-x-2">
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ConfigRow({ label, entity, onSelect }: {
  label: string;
  entity?: { entityId: string; displayName?: string };
  onSelect: () => void;
}) {
  return (
    <div className="flex items-center space-x-4">
      <label className="text-sm font-medium text-gray-700 w-48">{label}</label>
      <button
        onClick={onSelect}
        className="flex-1 text-left p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
      >
        {entity ? (
          <div>
            <div className="font-medium text-gray-900 flex items-center">
              <Check className="w-4 h-4 text-green-600 mr-2" />
              {entity.displayName || entity.entityId}
            </div>
            <div className="text-xs text-gray-500">{entity.entityId}</div>
          </div>
        ) : (
          <div className="text-gray-400">Click to select entity...</div>
        )}
      </button>
    </div>
  );
}
