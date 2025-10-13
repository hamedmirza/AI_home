import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Lightbulb, Thermometer, Gauge, BarChart3, Zap, Activity, Save, X, Grid, LayoutGrid } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Switch } from './ui/Switch';
import { Input } from './ui/Input';
import { Entity } from '../types/homeAssistant';
import { dbService } from '../services/database';

interface DashboardsProps {
  entities: Entity[];
  onEntityToggle: (entityId: string) => void;
  isConnected: boolean;
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  cards: DashboardCard[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DashboardCard {
  id: string;
  type: 'entity' | 'entities-group' | 'sensor' | 'gauge';
  title: string;
  entityId?: string;
  entityIds?: string[];
  config: any;
}

export function Dashboards({ entities, onEntityToggle, isConnected }: DashboardsProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [loading, setLoading] = useState(true);

  // New card form state
  const [newCardType, setNewCardType] = useState<'entity' | 'entities-group' | 'sensor' | 'gauge'>('entity');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardEntityId, setNewCardEntityId] = useState('');
  const [newCardEntityIds, setNewCardEntityIds] = useState<string[]>([]);

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    setLoading(true);
    try {
      const saved = await dbService.getPreference('dashboards');
      if (saved && Array.isArray(saved)) {
        const dashboardsWithDates = saved.map((d: any) => ({
          ...d,
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
          cards: d.cards || []
        }));
        setDashboards(dashboardsWithDates);
        if (dashboardsWithDates.length > 0 && !activeDashboard) {
          setActiveDashboard(dashboardsWithDates[0].id);
        }
      } else {
        const defaultDashboard: Dashboard = {
          id: 'default',
          name: 'Home',
          description: 'Main dashboard',
          cards: [],
          isPinned: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setDashboards([defaultDashboard]);
        setActiveDashboard('default');
        await saveDashboards([defaultDashboard]);
      }
    } catch (error) {
      console.error('Failed to load dashboards:', error);
      setDashboards([]);
    } finally {
      setLoading(false);
    }
  };

  const saveDashboards = async (dashboardsToSave: Dashboard[]) => {
    try {
      await dbService.setPreference('dashboards', dashboardsToSave);
    } catch (error) {
      console.error('Failed to save dashboards:', error);
    }
  };

  const createDashboard = async () => {
    if (!newDashboardName.trim()) return;

    const newDashboard: Dashboard = {
      id: Date.now().toString(),
      name: newDashboardName,
      description: '',
      cards: [],
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updated = [...dashboards, newDashboard];
    setDashboards(updated);
    setActiveDashboard(newDashboard.id);
    await saveDashboards(updated);

    setShowNewDashboard(false);
    setNewDashboardName('');
  };

  const deleteDashboard = async (dashboardId: string) => {
    if (!confirm('Delete this dashboard?')) return;

    const updated = dashboards.filter(d => d.id !== dashboardId);
    setDashboards(updated);

    if (activeDashboard === dashboardId && updated.length > 0) {
      setActiveDashboard(updated[0].id);
    }

    await saveDashboards(updated);
  };

  const addCard = async () => {
    if (!newCardTitle.trim()) {
      alert('Please enter a card title');
      return;
    }

    if (newCardType === 'entity' && !newCardEntityId) {
      alert('Please select an entity');
      return;
    }

    if (newCardType === 'entities-group' && newCardEntityIds.length === 0) {
      alert('Please select at least one entity');
      return;
    }

    const dashboard = dashboards.find(d => d.id === activeDashboard);
    if (!dashboard) return;

    const newCard: DashboardCard = {
      id: Date.now().toString(),
      type: newCardType,
      title: newCardTitle,
      entityId: newCardType === 'entity' ? newCardEntityId : undefined,
      entityIds: newCardType === 'entities-group' ? newCardEntityIds : undefined,
      config: {}
    };

    dashboard.cards.push(newCard);
    dashboard.updatedAt = new Date();

    const updated = dashboards.map(d => d.id === dashboard.id ? dashboard : d);
    setDashboards(updated);
    await saveDashboards(updated);

    setShowAddCard(false);
    setNewCardTitle('');
    setNewCardEntityId('');
    setNewCardEntityIds([]);
  };

  const removeCard = async (cardId: string) => {
    const dashboard = dashboards.find(d => d.id === activeDashboard);
    if (!dashboard) return;

    dashboard.cards = dashboard.cards.filter(c => c.id !== cardId);
    dashboard.updatedAt = new Date();

    const updated = dashboards.map(d => d.id === dashboard.id ? dashboard : d);
    setDashboards(updated);
    await saveDashboards(updated);
  };

  const toggleEntitySelection = (entityId: string) => {
    if (newCardEntityIds.includes(entityId)) {
      setNewCardEntityIds(newCardEntityIds.filter(id => id !== entityId));
    } else {
      setNewCardEntityIds([...newCardEntityIds, entityId]);
    }
  };

  const renderCard = (card: DashboardCard) => {
    if (card.type === 'entity' && card.entityId) {
      const entity = entities.find(e => e.entity_id === card.entityId);
      if (!entity) return null;

      const isControllable = entity.entity_id.startsWith('light.') ||
                            entity.entity_id.startsWith('switch.');

      return (
        <Card key={card.id} className="relative">
          {editMode && (
            <button
              onClick={() => removeCard(card.id)}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded hover:bg-red-600 z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {entity.entity_id.startsWith('light.') && <Lightbulb className="w-5 h-5 text-yellow-500" />}
                {entity.entity_id.startsWith('switch.') && <Zap className="w-5 h-5 text-green-500" />}
                {entity.entity_id.startsWith('sensor.') && <Thermometer className="w-5 h-5 text-blue-500" />}
                <h3 className="font-semibold text-gray-900 dark:text-white">{card.title}</h3>
              </div>
              {isControllable && (
                <Switch
                  checked={entity.state === 'on'}
                  onChange={() => onEntityToggle(entity.entity_id)}
                />
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">State:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {entity.state}
                  {entity.unit_of_measurement && ` ${entity.unit_of_measurement}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Entity:</span>
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                  {entity.entity_id}
                </span>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    if (card.type === 'entities-group' && card.entityIds) {
      const groupEntities = entities.filter(e => card.entityIds?.includes(e.entity_id));

      return (
        <Card key={card.id} className="relative">
          {editMode && (
            <button
              onClick={() => removeCard(card.id)}
              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded hover:bg-red-600 z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-purple-500" />
              {card.title}
            </h3>
            <div className="space-y-3">
              {groupEntities.map(entity => {
                const isControllable = entity.entity_id.startsWith('light.') ||
                                      entity.entity_id.startsWith('switch.');
                return (
                  <div key={entity.entity_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      {entity.entity_id.startsWith('light.') && <Lightbulb className="w-4 h-4 text-yellow-500" />}
                      {entity.entity_id.startsWith('switch.') && <Zap className="w-4 h-4 text-green-500" />}
                      {entity.entity_id.startsWith('sensor.') && <Thermometer className="w-4 h-4 text-blue-500" />}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {entity.friendly_name || entity.entity_id}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {entity.state}{entity.unit_of_measurement ? ` ${entity.unit_of_measurement}` : ''}
                        </div>
                      </div>
                    </div>
                    {isControllable && (
                      <Switch
                        checked={entity.state === 'on'}
                        onChange={() => onEntityToggle(entity.entity_id)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      );
    }

    return null;
  };

  const currentDashboard = dashboards.find(d => d.id === activeDashboard);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading dashboards...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboards</h1>
        <div className="flex gap-3">
          <Button
            onClick={() => setEditMode(!editMode)}
            variant={editMode ? 'primary' : 'secondary'}
          >
            <Edit3 className="w-4 h-4 mr-2" />
            {editMode ? 'Done' : 'Edit'}
          </Button>
          <Button onClick={() => setShowNewDashboard(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Dashboard
          </Button>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dashboards.map(dashboard => (
          <div key={dashboard.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveDashboard(dashboard.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeDashboard === dashboard.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {dashboard.name}
            </button>
            {editMode && dashboard.id !== 'default' && (
              <button
                onClick={() => deleteDashboard(dashboard.id)}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Cards Grid */}
      {currentDashboard && (
        <div>
          {currentDashboard.cards.length === 0 ? (
            <Card>
              <div className="p-12 text-center">
                <Grid className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No cards yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Add cards to display your devices and sensors
                </p>
                <Button onClick={() => setShowAddCard(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Card
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentDashboard.cards.map(renderCard)}
              </div>
              <div className="mt-6">
                <Button onClick={() => setShowAddCard(true)} variant="secondary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Card
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* New Dashboard Modal */}
      {showNewDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Create Dashboard
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dashboard Name
                  </label>
                  <Input
                    value={newDashboardName}
                    onChange={(e) => setNewDashboardName(e.target.value)}
                    placeholder="e.g., Living Room, Bedroom"
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={createDashboard} className="flex-1">Create</Button>
                  <Button onClick={() => setShowNewDashboard(false)} variant="secondary">Cancel</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl my-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Add Card
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Card Type
                  </label>
                  <select
                    value={newCardType}
                    onChange={(e) => setNewCardType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="entity">Single Entity</option>
                    <option value="entities-group">Multiple Entities</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Card Title
                  </label>
                  <Input
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    placeholder="e.g., Living Room Lights"
                  />
                </div>

                {newCardType === 'entity' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Entity
                    </label>
                    <select
                      value={newCardEntityId}
                      onChange={(e) => setNewCardEntityId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="">Choose an entity...</option>
                      {entities.map(entity => (
                        <option key={entity.entity_id} value={entity.entity_id}>
                          {entity.friendly_name || entity.entity_id} ({entity.state})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {newCardType === 'entities-group' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Entities ({newCardEntityIds.length} selected)
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-2">
                      {entities.map(entity => (
                        <label
                          key={entity.entity_id}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={newCardEntityIds.includes(entity.entity_id)}
                            onChange={() => toggleEntitySelection(entity.entity_id)}
                            className="w-4 h-4"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {entity.friendly_name || entity.entity_id}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {entity.entity_id} - {entity.state}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button onClick={addCard} className="flex-1">Add Card</Button>
                  <Button onClick={() => setShowAddCard(false)} variant="secondary">Cancel</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
