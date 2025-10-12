import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { Entity } from '../types/homeAssistant';
import { homeAssistantService } from '../services/homeAssistant';
import { dbService } from '../services/database';
import { Zap, Plus, CreditCard as Edit3, Trash2, Play, Pause, Clock, Sun, Moon, Thermometer, Power, Lightbulb, Settings, Calendar, Timer, Activity } from 'lucide-react';

interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  lastTriggered?: Date;
  triggerCount: number;
}

interface AutomationTrigger {
  type: 'time' | 'state' | 'numeric_state' | 'sun' | 'device';
  entityId?: string;
  time?: string;
  state?: string;
  above?: number;
  below?: number;
  event?: string;
}

interface AutomationCondition {
  type: 'state' | 'numeric_state' | 'time' | 'sun';
  entityId?: string;
  state?: string;
  above?: number;
  below?: number;
  after?: string;
  before?: string;
}

interface AutomationAction {
  type: 'service' | 'delay' | 'wait';
  service?: string;
  entityId?: string;
  data?: any;
  delay?: number;
}

interface AutomationsProps {
  entities: Entity[];
  isConnected: boolean;
}

export const Automations: React.FC<AutomationsProps> = ({ entities, isConnected }) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [newAutomation, setNewAutomation] = useState<Partial<Automation>>({
    name: '',
    description: '',
    enabled: true,
    trigger: { type: 'time', time: '18:00' },
    conditions: [],
    actions: [],
    triggerCount: 0
  });

  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    try {
      const saved = await dbService.getPreference('automations');
      if (saved) {
        setAutomations(saved.map((a: any) => ({
          ...a,
          lastTriggered: a.lastTriggered ? new Date(a.lastTriggered) : undefined
        })));
      } else {
        const sampleAutomations = createSampleAutomations();
        setAutomations(sampleAutomations);
        await saveAutomations(sampleAutomations);
      }
    } catch (error) {
      console.error('Failed to load automations:', error);
    }
  };

  const saveAutomations = async (automationsToSave: Automation[]) => {
    try {
      await dbService.setPreference('automations', automationsToSave);
    } catch (error) {
      console.error('Failed to save automations:', error);
    }
  };

  const createSampleAutomations = (): Automation[] => {
    return [
      {
        id: '1',
        name: 'Evening Lights',
        description: 'Turn on living room lights at sunset',
        enabled: true,
        trigger: { type: 'sun', event: 'sunset' },
        conditions: [],
        actions: [
          {
            type: 'service',
            service: 'light.turn_on',
            entityId: 'light.living_room',
            data: { brightness: 180 }
          }
        ],
        triggerCount: 15,
        lastTriggered: new Date(Date.now() - 24 * 60 * 60 * 1000)
      },
      {
        id: '2',
        name: 'Good Night',
        description: 'Turn off all lights at 11 PM',
        enabled: true,
        trigger: { type: 'time', time: '23:00' },
        conditions: [],
        actions: [
          {
            type: 'service',
            service: 'light.turn_off',
            entityId: 'all',
            data: {}
          }
        ],
        triggerCount: 8,
        lastTriggered: new Date(Date.now() - 12 * 60 * 60 * 1000)
      },
      {
        id: '3',
        name: 'Temperature Alert',
        description: 'Turn on fan when temperature is above 25°C',
        enabled: false,
        trigger: { type: 'numeric_state', entityId: 'sensor.temperature', above: 25 },
        conditions: [],
        actions: [
          {
            type: 'service',
            service: 'switch.turn_on',
            entityId: 'switch.fan',
            data: {}
          }
        ],
        triggerCount: 3
      }
    ];
  };

  const toggleAutomation = (id: string) => {
    const updated = automations.map(automation =>
      automation.id === id
        ? { ...automation, enabled: !automation.enabled }
        : automation
    );
    setAutomations(updated);
    saveAutomations(updated);
  };

  const deleteAutomation = (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    
    const updated = automations.filter(a => a.id !== id);
    setAutomations(updated);
    saveAutomations(updated);
  };

  const createAutomation = () => {
    if (!newAutomation.name?.trim()) return;

    const automation: Automation = {
      id: Date.now().toString(),
      name: newAutomation.name,
      description: newAutomation.description || '',
      enabled: newAutomation.enabled || true,
      trigger: newAutomation.trigger || { type: 'time', time: '18:00' },
      conditions: newAutomation.conditions || [],
      actions: newAutomation.actions || [],
      triggerCount: 0
    };

    const updated = [...automations, automation];
    setAutomations(updated);
    saveAutomations(updated);
    setShowCreateModal(false);
    setNewAutomation({
      name: '',
      description: '',
      enabled: true,
      trigger: { type: 'time', time: '18:00' },
      conditions: [],
      actions: [],
      triggerCount: 0
    });
  };

  const getTriggerIcon = (trigger: AutomationTrigger) => {
    switch (trigger.type) {
      case 'time':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'sun':
        return trigger.event === 'sunrise' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-indigo-500" />;
      case 'state':
        return <Power className="w-4 h-4 text-green-500" />;
      case 'numeric_state':
        return <Thermometer className="w-4 h-4 text-orange-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTriggerDescription = (trigger: AutomationTrigger) => {
    switch (trigger.type) {
      case 'time':
        return `At ${trigger.time}`;
      case 'sun':
        return `At ${trigger.event}`;
      case 'state':
        return `When ${trigger.entityId} turns ${trigger.state}`;
      case 'numeric_state':
        return `When ${trigger.entityId} ${trigger.above ? `> ${trigger.above}` : `< ${trigger.below}`}`;
      default:
        return 'Unknown trigger';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
          <p className="text-gray-600">Create and manage smart home automations</p>
        </div>
        
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Automation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{automations.length}</p>
              </div>
              <Zap className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{automations.filter(a => a.enabled).length}</p>
              </div>
              <Play className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Disabled</p>
                <p className="text-2xl font-bold text-gray-600">{automations.filter(a => !a.enabled).length}</p>
              </div>
              <Pause className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Triggers Today</p>
                <p className="text-2xl font-bold text-purple-600">
                  {automations.reduce((sum, a) => sum + (a.lastTriggered && 
                    a.lastTriggered.toDateString() === new Date().toDateString() ? 1 : 0), 0)}
                </p>
              </div>
              <Timer className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automations List */}
      <div className="space-y-4">
        {automations.map(automation => (
          <Card key={automation.id} className={`transition-all duration-200 ${automation.enabled ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getTriggerIcon(automation.trigger)}
                    <h3 className="text-lg font-semibold text-gray-900">{automation.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      automation.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {automation.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-3">{automation.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="font-medium text-gray-700">Trigger:</span>
                      <span className="text-gray-600">{getTriggerDescription(automation.trigger)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="font-medium text-gray-700">Actions:</span>
                      <span className="text-gray-600">{automation.actions.length} action(s)</span>
                    </div>
                    
                    {automation.lastTriggered && (
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="font-medium text-gray-700">Last triggered:</span>
                        <span className="text-gray-600">{automation.lastTriggered.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2 text-sm">
                      <span className="font-medium text-gray-700">Total triggers:</span>
                      <span className="text-gray-600">{automation.triggerCount}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={automation.enabled}
                    onChange={() => toggleAutomation(automation.id)}
                  />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingAutomation(automation)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAutomation(automation.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {automations.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Automations</h3>
            <p className="text-gray-600 mb-6">Create your first automation to get started</p>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Automation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Automation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create New Automation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Name"
                  value={newAutomation.name || ''}
                  onChange={(e) => setNewAutomation(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Evening Lights"
                />
                <Input
                  label="Description"
                  value={newAutomation.description || ''}
                  onChange={(e) => setNewAutomation(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Type</label>
                <select
                  value={newAutomation.trigger?.type || 'time'}
                  onChange={(e) => setNewAutomation(prev => ({
                    ...prev,
                    trigger: { type: e.target.value as any, time: '18:00' }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="time">Time</option>
                  <option value="sun">Sun Event</option>
                  <option value="state">Device State</option>
                  <option value="numeric_state">Numeric State</option>
                </select>
              </div>

              {newAutomation.trigger?.type === 'time' && (
                <Input
                  label="Time"
                  type="time"
                  value={newAutomation.trigger.time || '18:00'}
                  onChange={(e) => setNewAutomation(prev => ({
                    ...prev,
                    trigger: { ...prev.trigger!, time: e.target.value }
                  }))}
                />
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Note</h4>
                <p className="text-sm text-blue-800">
                  This is a demo automation system. In a real implementation, automations would be created 
                  and managed through Home Assistant's automation engine.
                </p>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewAutomation({
                      name: '',
                      description: '',
                      enabled: true,
                      trigger: { type: 'time', time: '18:00' },
                      conditions: [],
                      actions: [],
                      triggerCount: 0
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={createAutomation}
                  disabled={!newAutomation.name?.trim()}
                >
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};