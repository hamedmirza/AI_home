import React, { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit3, Trash2, Lightbulb, Thermometer, Gauge, BarChart3, Cloud, Zap, Home, Activity, Save, X, Eye, Settings, Pin, PinOff } from 'lucide-react';
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
  type: 'light' | 'switch' | 'sensor' | 'gauge' | 'chart' | 'weather' | 'energy' | 'status';
  title: string;
  entityId?: string;
  entityIds?: string[];
  position: { x: number; y: number; w: number; h: number };
  config: any;
}

const cardTemplates = [
  { 
    type: 'light', 
    icon: Lightbulb, 
    name: 'Light Control', 
    description: 'Control lights with brightness',
    config: { showBrightness: true, color: '#FCD34D' }
  },
  { 
    type: 'switch', 
    icon: Zap, 
    name: 'Switch Control', 
    description: 'Simple on/off switches',
    config: { showPower: true, color: '#10B981' }
  },
  { 
    type: 'sensor', 
    icon: Eye, 
    name: 'Sensor Display', 
    description: 'Show sensor values',
    config: { unit: '°C', precision: 1, color: '#8B5CF6' }
  },
  { 
    type: 'gauge', 
    icon: Gauge, 
    name: 'Gauge Chart', 
    description: 'Circular progress indicators',
    config: { min: 0, max: 100, unit: '%', color: '#F59E0B' }
  },
  { 
    type: 'chart', 
    icon: BarChart3, 
    name: 'Line Chart', 
    description: 'Historical data visualization',
    config: { timeRange: '24h', color: '#EF4444' }
  },
  { 
    type: 'weather', 
    icon: Cloud, 
    name: 'Weather Card', 
    description: 'Weather information',
    config: { showForecast: true }
  },
  { 
    type: 'energy', 
    icon: Activity, 
    name: 'Energy Flow', 
    description: 'Energy consumption flow',
    config: { showFlow: true, animated: true }
  }
];

const dashboardTemplates = [
  {
    name: 'Living Room',
    description: 'Lights, entertainment, and climate control',
    cards: ['light', 'switch', 'sensor']
  },
  {
    name: 'Bedroom',
    description: 'Sleep-focused controls and monitoring',
    cards: ['light', 'sensor']
  },
  {
    name: 'Kitchen',
    description: 'Appliances and environmental monitoring',
    cards: ['switch', 'sensor', 'energy']
  },
  {
    name: 'Energy Management',
    description: 'Solar, battery, and consumption monitoring',
    cards: ['energy', 'chart', 'gauge']
  }
];

export function Dashboards({ entities, onEntityToggle, isConnected }: DashboardsProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<string>('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDashboardTemplates, setShowDashboardTemplates] = useState(false);
  const [editingCard, setEditingCard] = useState<DashboardCard | null>(null);
  const [showCardEditor, setShowCardEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [newDashboardDescription, setNewDashboardDescription] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboards();
  }, []);

  const loadDashboards = async () => {
    setLoading(true);
    try {
      const saved = await dbService.getPreference('dashboards');
      if (saved) {
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
          name: 'Home Overview',
          description: 'Main dashboard with essential controls',
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

  const createDashboard = (template?: any) => {
    const name = template?.name || newDashboardName || 'New Dashboard';
    const description = template?.description || newDashboardDescription || 'Custom dashboard';
    
    const newDashboard: Dashboard = {
      id: Date.now().toString(),
      name,
      description,
      cards: [],
      isPinned: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (template?.cards) {
      template.cards.forEach((cardType: string, index: number) => {
        const cardTemplate = cardTemplates.find(t => t.type === cardType);
        if (cardTemplate) {
          const newCard: DashboardCard = {
            id: `${Date.now()}_${index}`,
            type: cardTemplate.type as any,
            title: cardTemplate.name,
            position: { x: (index % 3) * 4, y: Math.floor(index / 3) * 3, w: 4, h: 3 },
            config: cardTemplate.config
          };
          newDashboard.cards.push(newCard);
        }
      });
    }

    const updated = [...dashboards, newDashboard];
    setDashboards(updated);
    saveDashboards(updated);
    setActiveDashboard(newDashboard.id);
    setShowDashboardTemplates(false);
    setNewDashboardName('');
    setNewDashboardDescription('');
  };

  const addCard = (template: any, entityId?: string) => {
    if (!activeDashboard) return;

    const newCard: DashboardCard = {
      id: Date.now().toString(),
      type: template.type,
      title: template.name,
      entityId: entityId,
      position: { x: 0, y: 0, w: 4, h: 3 },
      config: template.config
    };

    const updated = dashboards.map(dashboard =>
      dashboard.id === activeDashboard
        ? { ...dashboard, cards: [...(dashboard.cards || []), newCard], updatedAt: new Date() }
        : dashboard
    );

    setDashboards(updated);
    saveDashboards(updated);
    setShowTemplates(false);
    setShowCardEditor(false);
    setSelectedTemplate(null);
  };

  const updateCard = (cardId: string, updates: Partial<DashboardCard>) => {
    const updated = dashboards.map(dashboard =>
      dashboard.id === activeDashboard
        ? {
            ...dashboard,
            cards: (dashboard.cards || []).map(card =>
              card.id === cardId ? { ...card, ...updates } : card
            ),
            updatedAt: new Date()
          }
        : dashboard
    );

    setDashboards(updated);
    saveDashboards(updated);
  };

  const deleteCard = (cardId: string) => {
    if (!confirm('Are you sure you want to delete this card?')) return;

    const updated = dashboards.map(dashboard =>
      dashboard.id === activeDashboard
        ? {
            ...dashboard,
            cards: (dashboard.cards || []).filter(card => card.id !== cardId),
            updatedAt: new Date()
          }
        : dashboard
    );

    setDashboards(updated);
    saveDashboards(updated);
  };

  const togglePin = (dashboardId: string) => {
    const updated = dashboards.map(dashboard =>
      dashboard.id === dashboardId
        ? { ...dashboard, isPinned: !dashboard.isPinned }
        : dashboard
    );

    setDashboards(updated);
    saveDashboards(updated);
  };

  const deleteDashboard = (dashboardId: string) => {
    if (!confirm('Are you sure you want to delete this dashboard?')) return;

    const updated = dashboards.filter(d => d.id !== dashboardId);
    setDashboards(updated);
    saveDashboards(updated);

    if (activeDashboard === dashboardId && updated.length > 0) {
      setActiveDashboard(updated[0].id);
    }
  };

  const renderCard = (card: DashboardCard) => {
    const entity = card.entityId ? entities.find(e => e.entity_id === card.entityId) : null;

    const cardContent = () => {
      switch (card.type) {
        case 'light':
          return (
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{card.title}</h3>
                  <p className="text-sm text-gray-600">{entity?.friendly_name || 'No entity selected'}</p>
                </div>
                {entity && (
                  <Switch
                    checked={entity.state === 'on'}
                    onChange={() => onEntityToggle(entity.entity_id)}
                  />
                )}
              </div>
              {entity && entity.attributes.brightness && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Brightness</span>
                    <span>{Math.round((entity.attributes.brightness / 255) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(entity.attributes.brightness / 255) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );

        case 'switch':
          return (
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{card.title}</h3>
                  <p className="text-sm text-gray-600">{entity?.friendly_name || 'No entity selected'}</p>
                </div>
                {entity && (
                  <Switch
                    checked={entity.state === 'on'}
                    onChange={() => onEntityToggle(entity.entity_id)}
                  />
                )}
              </div>
              {entity && entity.attributes.current_power_w && (
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {entity.attributes.current_power_w}W
                  </div>
                  <div className="text-xs text-gray-500">Current Power</div>
                </div>
              )}
            </div>
          );

        case 'sensor':
          return (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <Thermometer className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">{card.title}</h3>
                <p className="text-sm text-gray-600">{entity?.friendly_name || 'No entity selected'}</p>
              </div>
              {entity && (
                <div className="text-2xl font-bold text-gray-900">
                  {entity.state}
                  <span className="text-sm font-normal text-gray-600 ml-1">
                    {entity.unit_of_measurement || card.config.unit || ''}
                  </span>
                </div>
              )}
            </div>
          );

        case 'gauge':
          const value = entity ? parseFloat(entity.state) || 0 : 0;
          const percentage = Math.min(100, Math.max(0, (value / (card.config.max || 100)) * 100));
          return (
            <div className="text-center space-y-3">
              <h3 className="font-semibold">{card.title}</h3>
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#E5E7EB"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke={card.config.color || "#3B82F6"}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${percentage * 2.51} 251`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{Math.round(percentage)}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">{entity?.friendly_name || 'No entity selected'}</p>
            </div>
          );

        case 'energy':
          return (
            <div className="space-y-4">
              <h3 className="font-semibold text-center">{card.title}</h3>
              <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-4 text-white">
                <div className="grid grid-cols-3 gap-4 items-center text-center">
                  <div>
                    <div className="w-12 h-12 mx-auto mb-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-sm font-medium">Solar</div>
                    <div className="text-lg font-bold text-yellow-400">4.2kW</div>
                  </div>
                  <div>
                    <div className="w-16 h-16 mx-auto border-2 border-blue-500 rounded-full flex items-center justify-center">
                      <Home className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>
                  <div>
                    <div className="w-12 h-12 mx-auto mb-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-sm font-medium">Grid</div>
                    <div className="text-lg font-bold text-blue-400">1.8kW</div>
                  </div>
                </div>
              </div>
            </div>
          );

        default:
          return (
            <div className="text-center space-y-3">
              <h3 className="font-semibold">{card.title}</h3>
              <p className="text-sm text-gray-600">Card type: {card.type}</p>
            </div>
          );
      }
    };

    return (
      <Card className="p-4 hover:shadow-lg transition-all duration-200 group relative">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingCard(card);
                setShowCardEditor(true);
              }}
              className="w-8 h-8 p-0"
            >
              <Edit3 className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteCard(card.id)}
              className="w-8 h-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        {cardContent()}
      </Card>
    );
  };

  const currentDashboard = dashboards.find(d => d.id === activeDashboard);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center max-w-md">
          <Home className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Dashboard Unavailable</h3>
          <p className="text-gray-600">
            Please connect to Home Assistant first to create and manage dashboards.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboards</h1>
          <p className="text-gray-600">Create and manage your smart home dashboards</p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowDashboardTemplates(true)}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Dashboard
          </Button>
          <Button
            onClick={() => setShowTemplates(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Card
          </Button>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <div className="flex space-x-2 overflow-x-auto">
        {dashboards.map(dashboard => (
          <button
            key={dashboard.id}
            onClick={() => setActiveDashboard(dashboard.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeDashboard === dashboard.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{dashboard.name}</span>
            {dashboard.isPinned && <Pin className="w-3 h-3" />}
          </button>
        ))}
      </div>

      {/* Dashboard Content */}
      {currentDashboard ? (
        <>
          {/* Dashboard Info */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{currentDashboard.name}</h2>
                <p className="text-sm text-gray-600">{currentDashboard.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => togglePin(currentDashboard.id)}
                >
                  {currentDashboard.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteDashboard(currentDashboard.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Cards Grid */}
          {!currentDashboard.cards || currentDashboard.cards.length === 0 ? (
            <div className="text-center py-12">
              <Home className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No Cards Yet</h3>
              <p className="text-gray-600 mb-4">
                Add your first card to get started with this dashboard
              </p>
              <Button
                onClick={() => setShowTemplates(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Card
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {(currentDashboard.cards || []).map(card => (
                <div key={card.id}>
                  {renderCard(card)}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Home className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">No Dashboard Selected</h3>
          <p className="text-gray-600 mb-4">
            Create your first dashboard to get started
          </p>
          <Button
            onClick={() => setShowDashboardTemplates(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Dashboard
          </Button>
        </div>
      )}

      {/* Dashboard Template Selection Modal */}
      {showDashboardTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Create New Dashboard</h2>
              <p className="text-gray-600">Choose a template or create a custom dashboard</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Custom Dashboard Form */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold mb-4">Custom Dashboard</h3>
                <div className="space-y-4">
                  <Input
                    label="Dashboard Name"
                    value={newDashboardName}
                    onChange={(e) => setNewDashboardName(e.target.value)}
                    placeholder="e.g., Living Room"
                  />
                  <Input
                    label="Description"
                    value={newDashboardDescription}
                    onChange={(e) => setNewDashboardDescription(e.target.value)}
                    placeholder="e.g., Main living area controls"
                  />
                  <Button
                    onClick={() => createDashboard()}
                    disabled={!newDashboardName.trim()}
                    className="w-full"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Create Custom Dashboard
                  </Button>
                </div>
              </div>

              {/* Template Options */}
              <div>
                <h3 className="font-semibold mb-4">Dashboard Templates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dashboardTemplates.map((template, index) => (
                    <button
                      key={index}
                      onClick={() => createDashboard(template)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <Home className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-semibold">{template.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {template.cards.slice(0, 3).map((cardType, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-100 text-xs rounded">
                            {cardType}
                          </span>
                        ))}
                        {template.cards.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 text-xs rounded">
                            +{template.cards.length - 3} more
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDashboardTemplates(false);
                  setNewDashboardName('');
                  setNewDashboardDescription('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Card Template Selection Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Choose a Card Template</h2>
              <p className="text-gray-600">Select a template to add to your dashboard</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cardTemplates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowCardEditor(true);
                      setShowTemplates(false);
                    }}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <template.icon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold">{template.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowTemplates(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Card Editor Modal */}
      {showCardEditor && (selectedTemplate || editingCard) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">
                {editingCard ? 'Edit Card' : 'Configure Card'}
              </h2>
              <p className="text-gray-600">
                {editingCard ? 'Modify card settings' : 'Set up your new card'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <Input
                label="Card Title"
                value={editingCard?.title || selectedTemplate?.name || ''}
                onChange={(e) => {
                  if (editingCard) {
                    updateCard(editingCard.id, { title: e.target.value });
                  }
                }}
                placeholder="Enter card title"
              />

              {/* Entity Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Entity
                </label>
                <select
                  value={editingCard?.entityId || ''}
                  onChange={(e) => {
                    if (editingCard) {
                      updateCard(editingCard.id, { entityId: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an entity...</option>
                  {entities
                    .filter(entity => {
                      const type = selectedTemplate?.type || editingCard?.type;
                      switch (type) {
                        case 'light':
                          return entity.entity_id.startsWith('light.');
                        case 'switch':
                          return entity.entity_id.startsWith('switch.');
                        case 'sensor':
                          return entity.entity_id.startsWith('sensor.');
                        default:
                          return true;
                      }
                    })
                    .map(entity => (
                      <option key={entity.entity_id} value={entity.entity_id}>
                        {entity.friendly_name || entity.entity_id}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCardEditor(false);
                  setEditingCard(null);
                  setSelectedTemplate(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (selectedTemplate && !editingCard) {
                    const entityId = (document.querySelector('select') as HTMLSelectElement)?.value;
                    addCard(selectedTemplate, entityId);
                  }
                  setShowCardEditor(false);
                  setEditingCard(null);
                  setSelectedTemplate(null);
                }}
              >
                <Save className="w-4 h-4 mr-2" />
                {editingCard ? 'Save Changes' : 'Add Card'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}