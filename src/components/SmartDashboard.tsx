import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, LayoutDashboard, Grid, Lightbulb, Zap, Activity, TrendingUp, X, Save, Gauge, Thermometer, Power } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { dbService } from '../services/database';
import { homeAssistantService } from '../services/homeAssistant';
import { Entity } from '../types/homeAssistant';

interface SmartDashboardConfig {
  id: string;
  name: string;
  description: string;
  cards: SmartCard[];
  created_at: Date;
  updated_at: Date;
}

interface SmartCard {
  id: string;
  type: 'entity' | 'energy-flow' | 'timeseries' | 'gauge' | 'stats' | 'history-graph' | 'sensor' | 'button';
  title: string;
  entityId?: string;
  entityIds?: string[];
  config: any;
  displayMode?: 'compact' | 'detailed' | 'minimal';
}

export function SmartDashboard() {
  const [dashboards, setDashboards] = useState<SmartDashboardConfig[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string>('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');

  // New card form
  const [newCardType, setNewCardType] = useState<SmartCard['type']>('entity');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardEntityId, setNewCardEntityId] = useState('');
  const [newCardEntityIds, setNewCardEntityIds] = useState<string[]>([]);
  const [newCardDisplayMode, setNewCardDisplayMode] = useState<'compact' | 'detailed' | 'minimal'>('detailed');

  // Edit card state
  const [editingCard, setEditingCard] = useState<SmartCard | null>(null);
  const [showEditCard, setShowEditCard] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load entities
      if (homeAssistantService.isConnected()) {
        const entitiesData = await homeAssistantService.getEntities();
        setEntities(entitiesData);
      }

      // Load dashboards
      const saved = await dbService.getPreference('smart_dashboards');
      if (saved && Array.isArray(saved)) {
        const dashboardsWithDates = saved.map((d: any) => ({
          ...d,
          created_at: new Date(d.created_at),
          updated_at: new Date(d.updated_at),
          cards: d.cards || []
        }));
        setDashboards(dashboardsWithDates);
        if (dashboardsWithDates.length > 0 && !activeDashboardId) {
          setActiveDashboardId(dashboardsWithDates[0].id);
        }
      } else {
        const defaultDashboard: SmartDashboardConfig = {
          id: 'default',
          name: 'Main Dashboard',
          description: 'Smart card-based dashboard',
          cards: [],
          created_at: new Date(),
          updated_at: new Date()
        };
        setDashboards([defaultDashboard]);
        setActiveDashboardId('default');
        await saveDashboards([defaultDashboard]);
      }
    } catch (error) {
      console.error('Failed to load smart dashboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveDashboards = async (dashboardsToSave: SmartDashboardConfig[]) => {
    try {
      await dbService.setPreference('smart_dashboards', dashboardsToSave);
    } catch (error) {
      console.error('Failed to save smart dashboards:', error);
    }
  };

  const createDashboard = async () => {
    if (!newDashboardName.trim()) return;

    const newDashboard: SmartDashboardConfig = {
      id: Date.now().toString(),
      name: newDashboardName,
      description: '',
      cards: [],
      created_at: new Date(),
      updated_at: new Date()
    };

    const updated = [...dashboards, newDashboard];
    setDashboards(updated);
    setActiveDashboardId(newDashboard.id);
    await saveDashboards(updated);

    setShowNewDashboard(false);
    setNewDashboardName('');
  };

  const deleteDashboard = async (dashboardId: string) => {
    if (!confirm('Delete this dashboard?')) return;

    const updated = dashboards.filter(d => d.id !== dashboardId);
    setDashboards(updated);

    if (activeDashboardId === dashboardId && updated.length > 0) {
      setActiveDashboardId(updated[0].id);
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

    const dashboard = dashboards.find(d => d.id === activeDashboardId);
    if (!dashboard) return;

    const newCard: SmartCard = {
      id: Date.now().toString(),
      type: newCardType,
      title: newCardTitle,
      entityId: newCardType === 'entity' ? newCardEntityId : undefined,
      entityIds: newCardType === 'energy-flow' ? newCardEntityIds : undefined,
      config: {},
      displayMode: newCardDisplayMode
    };

    dashboard.cards.push(newCard);
    dashboard.updated_at = new Date();

    const updated = dashboards.map(d => d.id === dashboard.id ? dashboard : d);
    setDashboards(updated);
    await saveDashboards(updated);

    setShowAddCard(false);
    setNewCardTitle('');
    setNewCardEntityId('');
    setNewCardEntityIds([]);
  };

  const startEditCard = (card: SmartCard) => {
    setEditingCard(card);
    setNewCardType(card.type);
    setNewCardTitle(card.title);
    setNewCardEntityId(card.entityId || '');
    setNewCardEntityIds(card.entityIds || []);
    setNewCardDisplayMode(card.displayMode || 'detailed');
    setShowEditCard(true);
  };

  const saveEditCard = async () => {
    if (!editingCard || !newCardTitle.trim()) {
      alert('Please enter a card title');
      return;
    }

    const dashboard = dashboards.find(d => d.id === activeDashboardId);
    if (!dashboard) return;

    const updatedCard: SmartCard = {
      ...editingCard,
      type: newCardType,
      title: newCardTitle,
      entityId: ['entity', 'gauge', 'history-graph', 'sensor', 'button'].includes(newCardType) ? newCardEntityId : undefined,
      entityIds: newCardType === 'energy-flow' ? newCardEntityIds : undefined,
      displayMode: newCardDisplayMode
    };

    dashboard.cards = dashboard.cards.map(c => c.id === editingCard.id ? updatedCard : c);
    dashboard.updated_at = new Date();

    const updated = dashboards.map(d => d.id === dashboard.id ? dashboard : d);
    setDashboards(updated);
    await saveDashboards(updated);

    setShowEditCard(false);
    setEditingCard(null);
    setNewCardTitle('');
    setNewCardEntityId('');
    setNewCardEntityIds([]);
  };

  const removeCard = async (cardId: string) => {
    const dashboard = dashboards.find(d => d.id === activeDashboardId);
    if (!dashboard) return;

    dashboard.cards = dashboard.cards.filter(c => c.id !== cardId);
    dashboard.updated_at = new Date();

    const updated = dashboards.map(d => d.id === dashboard.id ? dashboard : d);
    setDashboards(updated);
    await saveDashboards(updated);
  };

  const handleEntityToggle = async (entityId: string) => {
    try {
      await homeAssistantService.toggleEntity(entityId);
      // Refresh entities
      if (homeAssistantService.isConnected()) {
        const entitiesData = await homeAssistantService.getEntities();
        setEntities(entitiesData);
      }
    } catch (error) {
      console.error('Failed to toggle entity:', error);
    }
  };

  const toggleEntitySelection = (entityId: string) => {
    if (newCardEntityIds.includes(entityId)) {
      setNewCardEntityIds(newCardEntityIds.filter(id => id !== entityId));
    } else {
      setNewCardEntityIds([...newCardEntityIds, entityId]);
    }
  };

  const renderCard = (card: SmartCard) => {
    if (card.type === 'entity' && card.entityId) {
      const entity = entities.find(e => e.entity_id === card.entityId);
      if (!entity) return null;

      const isControllable = entity.entity_id.startsWith('light.') || entity.entity_id.startsWith('switch.');

      return (
        <Card key={card.id} className="relative">
          {editMode && (
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={() => startEditCard(card)}
                className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => removeCard(card.id)}
                className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {entity.entity_id.startsWith('light.') && <Lightbulb className="w-5 h-5 text-yellow-500" />}
                {entity.entity_id.startsWith('switch.') && <Zap className="w-5 h-5 text-green-500" />}
                {entity.entity_id.startsWith('sensor.') && <Activity className="w-5 h-5 text-blue-500" />}
                <h3 className="font-semibold text-gray-900 dark:text-white">{card.title}</h3>
              </div>
              {isControllable && (
                <Switch
                  checked={entity.state === 'on'}
                  onChange={() => handleEntityToggle(entity.entity_id)}
                />
              )}
            </div>
            {(card.displayMode === 'detailed' || !card.displayMode) && (
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
            )}
            {card.displayMode === 'compact' && (
              <div className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white">
                  {entity.state}
                  {entity.unit_of_measurement && ` ${entity.unit_of_measurement}`}
                </span>
              </div>
            )}
          </div>
        </Card>
      );
    }

    if (card.type === 'energy-flow' && card.entityIds) {
      const energyEntities = entities.filter(e => card.entityIds?.includes(e.entity_id));

      return (
        <Card key={card.id} className="relative col-span-2">
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
              <TrendingUp className="w-5 h-5 text-blue-500" />
              {card.title}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {energyEntities.map(entity => (
                <div key={entity.entity_id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {entity.friendly_name || entity.entity_id}
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {entity.state} {entity.unit_of_measurement}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      );
    }

    if (card.type === 'stats') {
      const lightsOn = entities.filter(e => e.entity_id.startsWith('light.') && e.state === 'on').length;
      const switchesOn = entities.filter(e => e.entity_id.startsWith('switch.') && e.state === 'on').length;
      const totalDevices = entities.filter(e => e.entity_id.startsWith('light.') || e.entity_id.startsWith('switch.')).length;

      return (
        <Card key={card.id} className="relative">
          {editMode && (
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={() => startEditCard(card)}
                className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => removeCard(card.id)}
                className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">{card.title}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Lights On</span>
                <span className="text-2xl font-bold text-yellow-500">{lightsOn}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Switches On</span>
                <span className="text-2xl font-bold text-green-500">{switchesOn}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Total Devices</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">{totalDevices}</span>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    if (card.type === 'gauge' && card.entityId) {
      const entity = entities.find(e => e.entity_id === card.entityId);
      if (!entity) return null;

      const value = parseFloat(entity.state) || 0;
      const maxValue = card.config?.max || 100;
      const percentage = Math.min((value / maxValue) * 100, 100);

      return (
        <Card key={card.id} className="relative">
          {editMode && (
            <button onClick={() => removeCard(card.id)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded hover:bg-red-600 z-10">
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-500" />
              {card.title}
            </h3>
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                  <circle cx="64" cy="64" r="56" stroke="#3b82f6" strokeWidth="8" fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{value.toFixed(1)}</span>
                  <span className="text-xs text-gray-500">{entity.unit_of_measurement || ''}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      );
    }

    if (card.type === 'history-graph' && card.entityId) {
      const entity = entities.find(e => e.entity_id === card.entityId);
      if (!entity) return null;

      return (
        <Card key={card.id} className="relative col-span-2">
          {editMode && (
            <button onClick={() => removeCard(card.id)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded hover:bg-red-600 z-10">
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              {card.title}
            </h3>
            <div className="h-48 flex items-end justify-around gap-1">
              {Array.from({ length: 24 }).map((_, i) => {
                const height = Math.random() * 100;
                return (
                  <div key={i} className="flex-1 bg-green-500 rounded-t" style={{ height: `${height}%` }} title={`${i}:00`} />
                );
              })}
            </div>
            <div className="mt-2 text-xs text-gray-500 flex justify-between">
              <span>24h ago</span>
              <span>Current: {entity.state} {entity.unit_of_measurement}</span>
              <span>Now</span>
            </div>
          </div>
        </Card>
      );
    }

    if (card.type === 'sensor' && card.entityId) {
      const entity = entities.find(e => e.entity_id === card.entityId);
      if (!entity) return null;

      return (
        <Card key={card.id} className="relative">
          {editMode && (
            <button onClick={() => removeCard(card.id)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded hover:bg-red-600 z-10">
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-500" />
              {card.title}
            </h3>
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {entity.state}
              </div>
              <div className="text-sm text-gray-500 mt-1">{entity.unit_of_measurement}</div>
            </div>
          </div>
        </Card>
      );
    }

    if (card.type === 'button' && card.entityId) {
      return (
        <Card key={card.id} className="relative">
          {editMode && (
            <button onClick={() => removeCard(card.id)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded hover:bg-red-600 z-10">
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="p-6 flex items-center justify-center">
            <Button onClick={() => handleEntityToggle(card.entityId!)} className="w-full py-8">
              {card.title}
            </Button>
          </div>
        </Card>
      );
    }

    return null;
  };

  const currentDashboard = dashboards.find(d => d.id === activeDashboardId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">Loading dashboards...</p>
        </div>
      </div>
    );
  }

  if (!currentDashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600">No dashboard found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-blue-600" />
          Smart Dashboards
        </h1>
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
              onClick={() => setActiveDashboardId(dashboard.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeDashboardId === dashboard.id
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
                  Add smart cards to visualize your home data
                </p>
                {editMode && (
                  <Button onClick={() => setShowAddCard(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Card
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentDashboard.cards.map(renderCard)}
              </div>
              {editMode && (
                <div className="mt-6">
                  <Button onClick={() => setShowAddCard(true)} variant="secondary">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Card
                  </Button>
                </div>
              )}
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
                Create Smart Dashboard
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dashboard Name
                  </label>
                  <Input
                    value={newDashboardName}
                    onChange={(e) => setNewDashboardName(e.target.value)}
                    placeholder="e.g., Energy Monitoring"
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
                Add Smart Card
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
                    <option value="entity">Entity Card - Single device control</option>
                    <option value="energy-flow">Energy Flow - Power distribution</option>
                    <option value="gauge">Gauge - Visual meter</option>
                    <option value="history-graph">History Graph - Time-series</option>
                    <option value="sensor">Sensor - Large display</option>
                    <option value="stats">Device Statistics - Summary</option>
                    <option value="button">Button - Quick action</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Display Mode
                  </label>
                  <select
                    value={newCardDisplayMode}
                    onChange={(e) => setNewCardDisplayMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="detailed">Detailed (Show all entity info)</option>
                    <option value="compact">Compact (Show state only)</option>
                    <option value="minimal">Minimal (Control only)</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Choose how much information to display on the card
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Card Title
                  </label>
                  <Input
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    placeholder="e.g., Living Room Light"
                  />
                </div>

                {(newCardType === 'entity' || newCardType === 'gauge' || newCardType === 'history-graph' || newCardType === 'sensor' || newCardType === 'button') && (
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

                {newCardType === 'energy-flow' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Energy Entities ({newCardEntityIds.length} selected)
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-2">
                      {entities.filter(e =>
                        e.entity_id.includes('power') ||
                        e.entity_id.includes('energy') ||
                        e.device_class === 'power' ||
                        e.device_class === 'energy'
                      ).map(entity => (
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
                              {entity.state} {entity.unit_of_measurement}
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

      {/* Edit Card Modal */}
      {showEditCard && editingCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl my-8">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Edit Smart Card
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
                    <option value="entity">Entity Card - Single device control</option>
                    <option value="energy-flow">Energy Flow - Power distribution</option>
                    <option value="gauge">Gauge - Visual meter</option>
                    <option value="history-graph">History Graph - Time-series</option>
                    <option value="sensor">Sensor - Large display</option>
                    <option value="stats">Device Statistics - Summary</option>
                    <option value="button">Button - Quick action</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Display Mode
                  </label>
                  <select
                    value={newCardDisplayMode}
                    onChange={(e) => setNewCardDisplayMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="detailed">Detailed (Show all entity info)</option>
                    <option value="compact">Compact (Show state only)</option>
                    <option value="minimal">Minimal (Control only)</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Choose how much information to display on the card
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Card Title
                  </label>
                  <Input
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    placeholder="e.g., Living Room Light"
                  />
                </div>

                {(newCardType === 'entity' || newCardType === 'gauge' || newCardType === 'history-graph' || newCardType === 'sensor' || newCardType === 'button') && (
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

                {newCardType === 'energy-flow' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Energy Entities ({newCardEntityIds.length} selected)
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-2">
                      {entities.filter(e =>
                        e.entity_id.includes('power') ||
                        e.entity_id.includes('energy') ||
                        e.device_class === 'power' ||
                        e.device_class === 'energy'
                      ).map(entity => (
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
                              {entity.state} {entity.unit_of_measurement}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button onClick={saveEditCard} className="flex-1">Save Changes</Button>
                  <Button onClick={() => { setShowEditCard(false); setEditingCard(null); }} variant="secondary">Cancel</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
