import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { Input } from './ui/Input';
import { Entity } from '../types/homeAssistant';
import { homeAssistantService } from '../services/homeAssistant';
import { Search, Filter, Settings, Lightbulb, Power, Thermometer, MoreHorizontal, Zap, Home, Eye, CreditCard as Edit3, X, Grid3x3, List } from 'lucide-react';

interface EntityManagerProps {
  entities: Entity[];
  onEntityToggle: (entityId: string) => void;
  onEntitiesUpdate: () => void;
  isConnected: boolean;
}

export const EntityManager: React.FC<EntityManagerProps> = ({ entities, onEntityToggle, onEntitiesUpdate, isConnected }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'state'>('name');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntityId, setNewEntityId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [helpers, setHelpers] = useState<any[]>([]);
  const [showHelpers, setShowHelpers] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  useEffect(() => {
    if (isConnected) {
      loadHelpers();
    }
  }, [isConnected]);

  const loadHelpers = async () => {
    if (!isConnected) return;

    try {
      const helpersData = await homeAssistantService.getHelpers();
      setHelpers(helpersData);
    } catch (error) {
      setHelpers([]);
    }
  };

  const handleEditEntity = (entity: Entity) => {
    setEditingEntity(entity);
    setEditValue(entity.state);
  };

  const handleSaveEdit = async () => {
    if (!editingEntity || !isConnected) return;

    try {
      await homeAssistantService.setEntityValue(editingEntity.entity_id, editValue);
      onEntitiesUpdate();
      setEditingEntity(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to update entity value:', error);
      alert(`Failed to update entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const canEditEntity = (entity: Entity) => {
    return entity.entity_id.startsWith('input_number.') ||
           entity.entity_id.startsWith('input_text.') ||
           entity.entity_id.startsWith('input_select.') ||
           (entity.entity_id.startsWith('light.') && entity.attributes.brightness !== undefined);
  };
  const handleDisableEntity = async (entityId: string) => {
    if (!isConnected) {
      alert('Not connected to Home Assistant');
      return;
    }

    if (!confirm(`Are you sure you want to disable ${entityId}?`)) {
      return;
    }

    try {
      await homeAssistantService.disableEntity(entityId);
      onEntitiesUpdate(); // Refresh the entities list
      alert(`Entity ${entityId} has been disabled`);
    } catch (error) {
      console.error('Failed to disable entity:', error);
      alert(`Failed to disable entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteEntity = async (entityId: string) => {
    if (!isConnected) {
      alert('Not connected to Home Assistant');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete ${entityId}? This action cannot be undone.`)) {
      return;
    }

    try {
      await homeAssistantService.deleteEntity(entityId);
      onEntitiesUpdate(); // Refresh the entities list
      alert(`Entity ${entityId} has been deleted`);
    } catch (error) {
      console.error('Failed to delete entity:', error);
      alert(`Failed to delete entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const filteredEntities = entities
    .filter(entity => {
      const matchesSearch = entity.friendly_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entity.entity_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || entity.entity_id.startsWith(filterType);
      
      const matchesDevice = deviceFilter === 'all' || 
        entity.attributes.device_id === deviceFilter ||
        (entity.attributes.friendly_name && entity.attributes.friendly_name.toLowerCase().includes(deviceFilter.toLowerCase())) ||
        entity.entity_id.toLowerCase().includes(deviceFilter.toLowerCase());
      
      return matchesSearch && matchesType && matchesDevice;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.friendly_name || a.entity_id).localeCompare(b.friendly_name || b.entity_id);
        case 'type':
          return a.entity_id.split('.')[0].localeCompare(b.entity_id.split('.')[0]);
        case 'state':
          return a.state.localeCompare(b.state);
        default:
          return 0;
      }
    });

  // Get unique devices for filtering
  const devices = Array.from(new Set(
    entities
      .map(entity => {
        // Try to extract device name from entity_id or friendly_name
        const deviceName = entity.attributes.device_id || 
          entity.friendly_name?.split(' ')[0] || 
          entity.entity_id.split('.')[1]?.split('_')[0];
        return deviceName;
      })
      .filter(Boolean)
  )).sort();

  const getEntityIcon = (entityId: string, deviceClass?: string) => {
    if (entityId.startsWith('light.')) {
      return <Lightbulb className="w-5 h-5 text-yellow-500" />;
    } else if (entityId.startsWith('switch.')) {
      return <Power className="w-5 h-5 text-blue-500" />;
    } else if (entityId.startsWith('sensor.')) {
      if (deviceClass === 'temperature') {
        return <Thermometer className="w-5 h-5 text-orange-500" />;
      } else if (deviceClass === 'energy') {
        return <Zap className="w-5 h-5 text-green-500" />;
      }
      return <Eye className="w-5 h-5 text-purple-500" />;
    }
    return <Home className="w-5 h-5 text-gray-500" />;
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'on':
        return 'text-green-600 bg-green-100';
      case 'off':
        return 'text-red-600 bg-red-100';
      case 'unavailable':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const entityTypes = [
    { value: 'all', label: 'All Entities', count: entities.length },
    { value: 'light', label: 'Lights', count: entities.filter(e => e.entity_id.startsWith('light.')).length },
    { value: 'switch', label: 'Switches', count: entities.filter(e => e.entity_id.startsWith('switch.')).length },
    { value: 'sensor', label: 'Sensors', count: entities.filter(e => e.entity_id.startsWith('sensor.')).length },
    { value: 'input_number', label: 'Input Numbers', count: entities.filter(e => e.entity_id.startsWith('input_number.')).length },
    { value: 'input_text', label: 'Input Text', count: entities.filter(e => e.entity_id.startsWith('input_text.')).length },
    { value: 'input_select', label: 'Input Select', count: entities.filter(e => e.entity_id.startsWith('input_select.')).length }
  ];

  const handleAddEntity = async () => {
    if (!newEntityId.trim()) return;

    if (!isConnected) {
      alert('Please connect to Home Assistant first');
      return;
    }

    setIsAdding(true);
    try {
      await homeAssistantService.addEntity(newEntityId.trim());
      setNewEntityId('');
      setShowAddModal(false);
      onEntitiesUpdate(); // Refresh entities list
      alert('Entity verified and available!');
    } catch (error) {
      console.error('Failed to add entity:', error);
      alert(`Failed to add entity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAdding(false);
    }
  };

  const renderEntityValue = (entity: Entity) => {
    if (editingEntity?.entity_id === entity.entity_id) {
      if (entity.entity_id.startsWith('input_select.') && entity.attributes.options) {
        return (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            {entity.attributes.options.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      } else {
        return (
          <input
            type={entity.entity_id.startsWith('input_number.') ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm w-20"
            min={entity.attributes.min}
            max={entity.attributes.max}
            step={entity.attributes.step}
          />
        );
      }
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStateColor(entity.state)}`}>
        {entity.state}
        {entity.attributes.unit_of_measurement && ` ${entity.attributes.unit_of_measurement}`}
      </span>
    );
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entity Manager</h1>
          <p className="text-gray-600">Manage and control all your smart home devices</p>
        </div>
        <Button variant="primary" className="flex items-center space-x-2">
          <Settings className="w-4 h-4" />
          <span>Add Entity</span>
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search entities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
            
            <div className="flex gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {entityTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label} ({type.count})
                  </option>
                ))}
              </select>

              <select
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Devices ({entities.length})</option>
                {devices.map(device => {
                  const deviceEntities = entities.filter(e => 
                    e.attributes.device_id === device ||
                    e.friendly_name?.toLowerCase().includes(device.toLowerCase()) ||
                    e.entity_id.toLowerCase().includes(device.toLowerCase())
                  );
                  return (
                    <option key={device} value={device}>
                      {device} ({deviceEntities.length})
                    </option>
                  );
                })}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'type' | 'state')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="name">Sort by Name</option>
                <option value="type">Sort by Type</option>
                <option value="state">Sort by State</option>
              </select>

              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-none border-0"
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none border-0 border-l border-gray-300"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entity Grid/List View */}
      {viewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEntities.map(entity => (
            <Card key={entity.entity_id} className="hover:shadow-lg transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedEntities.has(entity.entity_id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedEntities);
                        if (e.target.checked) {
                          newSelected.add(entity.entity_id);
                        } else {
                          newSelected.delete(entity.entity_id);
                        }
                        setSelectedEntities(newSelected);
                        setShowBulkActions(newSelected.size > 0);
                      }}
                      className="rounded border-gray-300"
                    />
                    {getEntityIcon(entity.entity_id, entity.device_class)}
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate">
                        {entity.friendly_name || entity.entity_id}
                      </h3>
                      <p className="text-sm text-gray-500">{entity.entity_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {canEditEntity(entity) && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditEntity(entity)}
                        title="Edit value"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDisableEntity(entity.entity_id)}
                      title="Disable entity"
                    >
                      <Power className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteEntity(entity.entity_id)}
                      title="Delete entity"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Status</span>
                    {renderEntityValue(entity)}
                  </div>

                  {entity.attributes.unit_of_measurement && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Value</span>
                      <span className="text-sm text-gray-900">
                        {entity.state} {entity.attributes.unit_of_measurement}
                      </span>
                    </div>
                  )}

                  {entity.attributes.brightness && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Brightness</span>
                      <span className="text-sm text-gray-900">
                        {Math.round((entity.attributes.brightness / 255) * 100)}%
                      </span>
                    </div>
                  )}

                  {entity.attributes.current_power_w && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-600">Power</span>
                      <span className="text-sm text-gray-900">
                        {entity.attributes.current_power_w}W
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Control</span>
                    <div className="flex items-center space-x-2">
                      {(entity.entity_id.startsWith('light.') || 
                        entity.entity_id.startsWith('switch.') || 
                        entity.entity_id.startsWith('input_boolean.')) && (
                        <Switch
                          checked={entity.state === 'on'}
                          onChange={() => onEntityToggle(entity.entity_id)}
                        />
                      )}
                      {editingEntity?.entity_id === entity.entity_id && (
                        <div className="flex space-x-1">
                          <Button size="sm" variant="primary" onClick={handleSaveEdit}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingEntity(null)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Last updated: {new Date(entity.last_updated).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedEntities.size === filteredEntities.length && filteredEntities.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEntities(new Set(filteredEntities.map(e => e.entity_id)));
                            setShowBulkActions(true);
                          } else {
                            setSelectedEntities(new Set());
                            setShowBulkActions(false);
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      State
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Control
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEntities.map(entity => (
                    <tr key={entity.entity_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedEntities.has(entity.entity_id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedEntities);
                            if (e.target.checked) {
                              newSelected.add(entity.entity_id);
                            } else {
                              newSelected.delete(entity.entity_id);
                            }
                            setSelectedEntities(newSelected);
                            setShowBulkActions(newSelected.size > 0);
                          }}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getEntityIcon(entity.entity_id, entity.device_class)}
                          <div>
                            <div className="text-xs font-medium text-gray-900">
                              {entity.friendly_name || entity.entity_id}
                            </div>
                            <div className="text-xs text-gray-500">{entity.entity_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          {entity.entity_id.split('.')[0]}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {renderEntityValue(entity)}
                        {editingEntity?.entity_id === entity.entity_id && (
                          <div className="flex space-x-1 mt-2">
                            <Button size="sm" variant="primary" onClick={handleSaveEdit}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingEntity(null)}>
                              Cancel
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {(entity.entity_id.startsWith('light.') ||
                          entity.entity_id.startsWith('switch.') ||
                          entity.entity_id.startsWith('input_boolean.')) && (
                          <Switch
                            checked={entity.state === 'on'}
                            onChange={() => onEntityToggle(entity.entity_id)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {canEditEntity(entity) && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditEntity(entity)}
                              title="Edit value"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDisableEntity(entity.entity_id)}
                            title="Disable entity"
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteEntity(entity.entity_id)}
                            title="Delete entity"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredEntities.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No entities found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search terms or filters.' : 'No entities match the current filter.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add Entity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add Entity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  label="Entity ID"
                  value={newEntityId}
                  onChange={(e) => setNewEntityId(e.target.value)}
                  placeholder="e.g., light.living_room"
                  disabled={isAdding}
                />
                <p className="text-sm text-gray-600 mt-1">
                  Enter the exact entity ID from your Home Assistant
                </p>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewEntityId('');
                  }}
                  disabled={isAdding}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleAddEntity}
                  disabled={!newEntityId.trim() || isAdding}
                >
                  {isAdding ? 'Verifying...' : 'Add Entity'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};