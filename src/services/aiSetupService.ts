import { Entity } from '../types/homeAssistant';
import { homeAssistantService } from './homeAssistant';

interface UserPreferences {
  homeType: string;
  residents: number;
  lifestyle: string;
  priorities: string[];
  wakeTime: string;
  sleepTime: string;
  workFromHome: boolean;
}

interface Room {
  id: string;
  name: string;
  icon: string;
  entities: string[];
  type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'office' | 'utility' | 'outdoor' | 'other';
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  layout: DashboardWidget[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DashboardWidget {
  id: string;
  type: 'entity-card' | 'gauge' | 'chart' | 'grid' | 'stats';
  entityIds: string[];
  position: { x: number; y: number; w: number; h: number };
  config: any;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: any;
  conditions: any[];
  actions: any[];
  triggerCount: number;
}

class AISetupService {
  private getAIProvider() {
    try {
      const preferences = localStorage.getItem('appPreferences');
      if (preferences) {
        const parsed = JSON.parse(preferences);
        const provider = parsed.aiProvider || 'homeassistant';

        let apiKey = '';
        switch (provider) {
          case 'openai':
            apiKey = parsed.openaiApiKey || '';
            break;
          case 'claude':
            apiKey = parsed.claudeApiKey || '';
            break;
          case 'gemini':
            apiKey = parsed.geminiApiKey || '';
            break;
          case 'grok':
            apiKey = parsed.grokApiKey || '';
            break;
          case 'lmstudio':
            apiKey = 'local';
            break;
          default:
            apiKey = '';
        }

        return {
          provider,
          apiKey,
          lmstudioUrl: parsed.lmstudioUrl || 'http://localhost:1234'
        };
      }
    } catch (error) {
      console.error('Failed to get AI provider:', error);
    }
    return { provider: 'homeassistant', apiKey: '', lmstudioUrl: 'http://localhost:1234' };
  }

  private async callAI(prompt: string, context: any = {}): Promise<any> {
    const { provider, apiKey, lmstudioUrl } = this.getAIProvider();

    if (provider === 'homeassistant') {
      // Use built-in logic for setup
      return this.processWithBuiltinLogic(prompt, context);
    }

    try {
      let response;
      const systemPrompt = `You are a smart home setup assistant. Analyze the provided home data and generate appropriate configurations. Always respond with valid JSON only, no additional text.`;

      switch (provider) {
        case 'openai':
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `${prompt}\n\nContext: ${JSON.stringify(context)}` }
              ],
              temperature: 0.7,
              max_tokens: 2000
            })
          });
          break;

        case 'claude':
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-sonnet-20240229',
              max_tokens: 2000,
              messages: [
                { role: 'user', content: `${systemPrompt}\n\n${prompt}\n\nContext: ${JSON.stringify(context)}` }
              ]
            })
          });
          break;

        case 'gemini':
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `${systemPrompt}\n\n${prompt}\n\nContext: ${JSON.stringify(context)}`
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000
              }
            })
          });
          break;

        case 'grok':
          response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'grok-3',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `${prompt}\n\nContext: ${JSON.stringify(context)}` }
              ],
              temperature: 0.7,
              max_tokens: 2000
            })
          });
          break;

        case 'lmstudio':
          response = await fetch(`${lmstudioUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `${prompt}\n\nContext: ${JSON.stringify(context)}` }
              ],
              temperature: 0.7,
              max_tokens: 2000
            })
          });
          break;

        default:
          throw new Error(`Unsupported AI provider: ${provider}`);
      }

      if (!response?.ok) {
        throw new Error(`AI API error: ${response?.status}`);
      }

      const data = await response.json();
      let content = '';

      switch (provider) {
        case 'openai':
        case 'grok':
        case 'lmstudio':
          content = data.choices[0]?.message?.content || '';
          break;
        case 'claude':
          content = data.content[0]?.text || '';
          break;
        case 'gemini':
          content = data.candidates[0]?.content?.parts[0]?.text || '';
          break;
      }

      // Try to parse JSON response
      try {
        return JSON.parse(content);
      } catch {
        // If not JSON, use built-in logic as fallback
        return this.processWithBuiltinLogic(prompt, context);
      }

    } catch (error) {
      console.error('AI API call failed:', error);
      // Fallback to built-in logic
      return this.processWithBuiltinLogic(prompt, context);
    }
  }

  private processWithBuiltinLogic(prompt: string, context: any): any {
    // Built-in logic as fallback when AI APIs are not available
    if (prompt.includes('analyze home')) {
      return this.analyzeHomeBuiltin(context.entities, context.preferences);
    } else if (prompt.includes('create rooms')) {
      return this.createRoomsBuiltin(context.entities);
    } else if (prompt.includes('create dashboards')) {
      return this.createDashboardsBuiltin(context.entities, context.rooms);
    } else if (prompt.includes('create automations')) {
      return this.createAutomationsBuiltin(context.entities, context.preferences);
    } else if (prompt.includes('configure energy')) {
      return this.configureEnergyBuiltin(context.entities);
    }
    return {};
  }

  async analyzeHome(entities: Entity[], preferences: UserPreferences) {
    const prompt = `Analyze this smart home setup and provide insights about the home layout, device types, and recommendations for setup based on user preferences.`;
    
    const context = { entities, preferences };
    
    try {
      const result = await this.callAI(prompt, context);
      return result || this.analyzeHomeBuiltin(entities, preferences);
    } catch (error) {
      return this.analyzeHomeBuiltin(entities, preferences);
    }
  }

  private analyzeHomeBuiltin(entities: Entity[], preferences: UserPreferences) {
    const deviceTypes = {
      lights: entities.filter(e => e.entity_id.startsWith('light.')).length,
      switches: entities.filter(e => e.entity_id.startsWith('switch.')).length,
      sensors: entities.filter(e => e.entity_id.startsWith('sensor.')).length,
      climate: entities.filter(e => e.entity_id.startsWith('climate.')).length,
      media: entities.filter(e => e.entity_id.startsWith('media_player.')).length
    };

    return {
      totalDevices: entities.length,
      deviceTypes,
      estimatedRooms: Math.max(3, Math.ceil(deviceTypes.lights / 3)),
      homeProfile: {
        size: deviceTypes.lights > 15 ? 'large' : deviceTypes.lights > 8 ? 'medium' : 'small',
        techLevel: entities.length > 50 ? 'advanced' : entities.length > 20 ? 'intermediate' : 'basic',
        energyDevices: entities.filter(e => 
          e.attributes.device_class === 'energy' || 
          e.attributes.unit_of_measurement === 'kWh' ||
          e.entity_id.includes('solar') ||
          e.entity_id.includes('battery')
        ).length
      },
      recommendations: [
        'Create room-based dashboards for better organization',
        'Set up energy monitoring for cost savings',
        'Configure security automations for peace of mind',
        'Add convenience automations based on daily routines'
      ]
    };
  }

  async createRooms(entities: Entity[], analysis: any) {
    const prompt = `Based on the home analysis and device list, create logical room groupings. Group similar devices and consider typical home layouts.`;
    
    const context = { entities, analysis };
    
    try {
      const result = await this.callAI(prompt, context);
      if (result.rooms) {
        this.saveRooms(result.rooms);
        return result;
      }
    } catch (error) {
      console.error('AI room creation failed:', error);
    }
    
    return this.createRoomsBuiltin(entities);
  }

  private createRoomsBuiltin(entities: Entity[]): { rooms: Room[] } {
    const rooms: Room[] = [];
    
    // Common room keywords for entity matching
    const roomKeywords = {
      living: ['living', 'lounge', 'family', 'main'],
      bedroom: ['bedroom', 'bed', 'master', 'guest'],
      kitchen: ['kitchen', 'dining'],
      bathroom: ['bathroom', 'bath', 'toilet', 'washroom'],
      office: ['office', 'study', 'work', 'desk'],
      utility: ['utility', 'laundry', 'garage', 'basement'],
      outdoor: ['outdoor', 'garden', 'patio', 'deck', 'yard']
    };

    // Group entities by detected room names
    const roomGroups: { [key: string]: Entity[] } = {};
    const unassigned: Entity[] = [];

    entities.forEach(entity => {
      const name = (entity.friendly_name || entity.entity_id).toLowerCase();
      let assigned = false;

      for (const [roomType, keywords] of Object.entries(roomKeywords)) {
        if (keywords.some(keyword => name.includes(keyword))) {
          const roomName = this.extractRoomName(name, keywords) || roomType;
          if (!roomGroups[roomName]) {
            roomGroups[roomName] = [];
          }
          roomGroups[roomName].push(entity);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        unassigned.push(entity);
      }
    });

    // Create room objects
    Object.entries(roomGroups).forEach(([roomName, roomEntities], index) => {
      const roomType = this.determineRoomType(roomName);
      rooms.push({
        id: `room_${index + 1}`,
        name: this.capitalizeRoomName(roomName),
        icon: this.getRoomIcon(roomType),
        entities: roomEntities.map(e => e.entity_id),
        type: roomType
      });
    });

    // Create a general room for unassigned entities if any
    if (unassigned.length > 0) {
      rooms.push({
        id: 'room_general',
        name: 'General',
        icon: 'home',
        entities: unassigned.map(e => e.entity_id),
        type: 'other'
      });
    }

    // Ensure we have at least basic rooms
    if (rooms.length === 0) {
      const lightEntities = entities.filter(e => e.entity_id.startsWith('light.'));
      const switchEntities = entities.filter(e => e.entity_id.startsWith('switch.'));
      
      rooms.push({
        id: 'room_main',
        name: 'Main Area',
        icon: 'home',
        entities: [...lightEntities.slice(0, 5), ...switchEntities.slice(0, 3)].map(e => e.entity_id),
        type: 'living'
      });
    }

    this.saveRooms(rooms);
    return { rooms };
  }

  private extractRoomName(name: string, keywords: string[]): string | null {
    for (const keyword of keywords) {
      const index = name.indexOf(keyword);
      if (index !== -1) {
        // Try to extract the full room name
        const parts = name.split(/[\s_-]+/);
        const keywordIndex = parts.findIndex(part => part.includes(keyword));
        if (keywordIndex !== -1) {
          return parts[keywordIndex];
        }
      }
    }
    return null;
  }

  private determineRoomType(roomName: string): Room['type'] {
    const name = roomName.toLowerCase();
    if (name.includes('living') || name.includes('lounge')) return 'living';
    if (name.includes('bedroom') || name.includes('bed')) return 'bedroom';
    if (name.includes('kitchen') || name.includes('dining')) return 'kitchen';
    if (name.includes('bathroom') || name.includes('bath')) return 'bathroom';
    if (name.includes('office') || name.includes('study')) return 'office';
    if (name.includes('utility') || name.includes('laundry')) return 'utility';
    if (name.includes('outdoor') || name.includes('garden')) return 'outdoor';
    return 'other';
  }

  private capitalizeRoomName(name: string): string {
    return name.split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getRoomIcon(roomType: Room['type']): string {
    const icons = {
      living: 'sofa',
      bedroom: 'bed',
      kitchen: 'chef-hat',
      bathroom: 'droplets',
      office: 'briefcase',
      utility: 'wrench',
      outdoor: 'trees',
      other: 'home'
    };
    return icons[roomType] || 'home';
  }

  private saveRooms(rooms: Room[]) {
    try {
      localStorage.setItem('rooms', JSON.stringify(rooms));
    } catch (error) {
      console.error('Failed to save rooms:', error);
    }
  }

  async createDashboards(entities: Entity[], rooms: Room[]) {
    const prompt = `Create multiple dashboards for different use cases: overview, room-specific, energy monitoring, and security. Make them user-friendly with appropriate widgets.`;
    
    const context = { entities, rooms };
    
    try {
      const result = await this.callAI(prompt, context);
      if (result.dashboards) {
        this.saveDashboards(result.dashboards);
        return result;
      }
    } catch (error) {
      console.error('AI dashboard creation failed:', error);
    }
    
    return this.createDashboardsBuiltin(entities, rooms);
  }

  private createDashboardsBuiltin(entities: Entity[], rooms: Room[]): { dashboards: Dashboard[] } {
    const dashboards: Dashboard[] = [];
    const now = new Date();

    // Main Overview Dashboard
    dashboards.push({
      id: 'overview',
      name: 'Home Overview',
      description: 'Main dashboard with essential controls and status',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      layout: [
        {
          id: 'quick-lights',
          type: 'grid',
          entityIds: entities.filter(e => e.entity_id.startsWith('light.')).slice(0, 6).map(e => e.entity_id),
          position: { x: 0, y: 0, w: 6, h: 4 },
          config: { title: 'Quick Lights', showState: true }
        },
        {
          id: 'switches',
          type: 'grid',
          entityIds: entities.filter(e => e.entity_id.startsWith('switch.')).slice(0, 4).map(e => e.entity_id),
          position: { x: 6, y: 0, w: 6, h: 4 },
          config: { title: 'Switches', showState: true }
        },
        {
          id: 'temperature',
          type: 'gauge',
          entityIds: entities.filter(e => e.device_class === 'temperature').slice(0, 1).map(e => e.entity_id),
          position: { x: 0, y: 4, w: 4, h: 3 },
          config: { title: 'Temperature', min: 0, max: 40, unit: '°C' }
        },
        {
          id: 'energy-overview',
          type: 'stats',
          entityIds: entities.filter(e => e.device_class === 'energy').slice(0, 3).map(e => e.entity_id),
          position: { x: 4, y: 4, w: 8, h: 3 },
          config: { title: 'Energy Usage' }
        }
      ]
    });

    // Room-specific dashboards
    rooms.forEach((room, index) => {
      if (room.entities.length > 0) {
        dashboards.push({
          id: `room_${room.id}`,
          name: `${room.name} Dashboard`,
          description: `Controls and monitoring for ${room.name}`,
          isDefault: false,
          createdAt: now,
          updatedAt: now,
          layout: [
            {
              id: `${room.id}_controls`,
              type: 'grid',
              entityIds: room.entities.slice(0, 8),
              position: { x: 0, y: 0, w: 12, h: 6 },
              config: { title: `${room.name} Controls`, showState: true }
            }
          ]
        });
      }
    });

    // Energy Dashboard (if energy entities exist)
    const energyEntities = entities.filter(e => 
      e.device_class === 'energy' || 
      e.attributes.unit_of_measurement === 'kWh' ||
      e.entity_id.includes('solar') ||
      e.entity_id.includes('battery')
    );

    if (energyEntities.length > 0) {
      dashboards.push({
        id: 'energy',
        name: 'Energy Monitoring',
        description: 'Solar, battery, and consumption monitoring',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        layout: [
          {
            id: 'energy_stats',
            type: 'stats',
            entityIds: energyEntities.slice(0, 4).map(e => e.entity_id),
            position: { x: 0, y: 0, w: 12, h: 4 },
            config: { title: 'Energy Statistics' }
          },
          {
            id: 'energy_chart',
            type: 'chart',
            entityIds: energyEntities.slice(0, 3).map(e => e.entity_id),
            position: { x: 0, y: 4, w: 12, h: 6 },
            config: { title: 'Energy Usage Chart', timeRange: '24h' }
          }
        ]
      });
    }

    // Security Dashboard (if security entities exist)
    const securityEntities = entities.filter(e => 
      e.entity_id.includes('door') ||
      e.entity_id.includes('window') ||
      e.entity_id.includes('motion') ||
      e.entity_id.includes('security') ||
      e.device_class === 'door' ||
      e.device_class === 'window' ||
      e.device_class === 'motion'
    );

    if (securityEntities.length > 0) {
      dashboards.push({
        id: 'security',
        name: 'Security & Safety',
        description: 'Door, window, and motion sensors',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
        layout: [
          {
            id: 'security_status',
            type: 'grid',
            entityIds: securityEntities.slice(0, 8).map(e => e.entity_id),
            position: { x: 0, y: 0, w: 12, h: 6 },
            config: { title: 'Security Status', showState: true }
          }
        ]
      });
    }

    this.saveDashboards(dashboards);
    return { dashboards };
  }

  private saveDashboards(dashboards: Dashboard[]) {
    try {
      localStorage.setItem('dashboards', JSON.stringify(dashboards));
    } catch (error) {
      console.error('Failed to save dashboards:', error);
    }
  }

  async createAutomations(entities: Entity[], preferences: UserPreferences, rooms: Room[]) {
    const prompt = `Create practical automations based on user preferences and available devices. Focus on energy efficiency, security, and convenience.`;
    
    const context = { entities, preferences, rooms };
    
    try {
      const result = await this.callAI(prompt, context);
      if (result.automations) {
        this.saveAutomations(result.automations);
        return result;
      }
    } catch (error) {
      console.error('AI automation creation failed:', error);
    }
    
    return this.createAutomationsBuiltin(entities, preferences);
  }

  private createAutomationsBuiltin(entities: Entity[], preferences: UserPreferences): { automations: Automation[] } {
    const automations: Automation[] = [];
    const lights = entities.filter(e => e.entity_id.startsWith('light.'));
    const switches = entities.filter(e => e.entity_id.startsWith('switch.'));

    // Good Morning automation
    if (lights.length > 0) {
      automations.push({
        id: 'good_morning',
        name: 'Good Morning',
        description: 'Turn on lights and start the day',
        enabled: true,
        trigger: { type: 'time', time: preferences.wakeTime },
        conditions: [],
        actions: [
          {
            type: 'service',
            service: 'light.turn_on',
            entityId: lights[0].entity_id,
            data: { brightness: 180 }
          }
        ],
        triggerCount: 0
      });
    }

    // Good Night automation
    if (lights.length > 0 || switches.length > 0) {
      automations.push({
        id: 'good_night',
        name: 'Good Night',
        description: 'Turn off all lights and switches',
        enabled: true,
        trigger: { type: 'time', time: preferences.sleepTime },
        conditions: [],
        actions: [
          {
            type: 'service',
            service: 'light.turn_off',
            entityId: 'all',
            data: {}
          }
        ],
        triggerCount: 0
      });
    }

    // Energy saving automation
    if (preferences.priorities.includes('energy-efficiency') && switches.length > 0) {
      automations.push({
        id: 'energy_saver',
        name: 'Energy Saver',
        description: 'Turn off non-essential devices when away',
        enabled: true,
        trigger: { type: 'state', entityId: 'person.user', state: 'away' },
        conditions: [],
        actions: [
          {
            type: 'service',
            service: 'switch.turn_off',
            entityId: switches[0].entity_id,
            data: {}
          }
        ],
        triggerCount: 0
      });
    }

    // Security automation
    if (preferences.priorities.includes('security')) {
      const motionSensors = entities.filter(e => 
        e.entity_id.includes('motion') || e.device_class === 'motion'
      );
      
      if (motionSensors.length > 0 && lights.length > 0) {
        automations.push({
          id: 'security_lights',
          name: 'Security Lights',
          description: 'Turn on lights when motion detected at night',
          enabled: true,
          trigger: { type: 'state', entityId: motionSensors[0].entity_id, state: 'on' },
          conditions: [
            { type: 'sun', after: 'sunset', before: 'sunrise' }
          ],
          actions: [
            {
              type: 'service',
              service: 'light.turn_on',
              entityId: lights[0].entity_id,
              data: { brightness: 255 }
            }
          ],
          triggerCount: 0
        });
      }
    }

    // Work from home automation
    if (preferences.workFromHome && lights.length > 0) {
      automations.push({
        id: 'work_mode',
        name: 'Work Mode',
        description: 'Optimize lighting for work hours',
        enabled: true,
        trigger: { type: 'time', time: '09:00' },
        conditions: [],
        actions: [
          {
            type: 'service',
            service: 'light.turn_on',
            entityId: lights[0].entity_id,
            data: { brightness: 220, color_temp: 250 }
          }
        ],
        triggerCount: 0
      });
    }

    this.saveAutomations(automations);
    return { automations };
  }

  private saveAutomations(automations: Automation[]) {
    try {
      localStorage.setItem('automations', JSON.stringify(automations));
    } catch (error) {
      console.error('Failed to save automations:', error);
    }
  }

  async configureEnergy(entities: Entity[]) {
    const prompt = `Analyze entities and create energy monitoring configuration. Map solar, battery, grid, and consumption entities.`;
    
    const context = { entities };
    
    try {
      const result = await this.callAI(prompt, context);
      if (result.energyMapping) {
        this.saveEnergyMapping(result.energyMapping);
        return result;
      }
    } catch (error) {
      console.error('AI energy configuration failed:', error);
    }
    
    return this.configureEnergyBuiltin(entities);
  }

  private configureEnergyBuiltin(entities: Entity[]): { energyMapping: any, mappedEntities: number } {
    const energyEntities = entities.filter(e => 
      e.attributes.device_class === 'energy' || 
      e.attributes.unit_of_measurement === 'kWh' ||
      e.attributes.unit_of_measurement === 'W' ||
      e.entity_id.includes('solar') ||
      e.entity_id.includes('battery') ||
      e.entity_id.includes('grid') ||
      e.entity_id.includes('power')
    );

    const energyMapping = {
      solar: energyEntities.filter(e => 
        e.entity_id.includes('solar') || 
        e.friendly_name?.toLowerCase().includes('solar')
      ).map(e => e.entity_id),
      battery: energyEntities.filter(e => 
        e.entity_id.includes('battery') || 
        e.friendly_name?.toLowerCase().includes('battery')
      ).map(e => e.entity_id),
      homeLoad: energyEntities.filter(e => 
        e.entity_id.includes('load') || 
        e.entity_id.includes('consumption') ||
        e.friendly_name?.toLowerCase().includes('load')
      ).map(e => e.entity_id),
      grid: energyEntities.filter(e => 
        e.entity_id.includes('grid') || 
        e.friendly_name?.toLowerCase().includes('grid')
      ).map(e => e.entity_id),
      devices: {}
    };

    this.saveEnergyMapping(energyMapping);
    return { energyMapping, mappedEntities: energyEntities.length };
  }

  private saveEnergyMapping(energyMapping: any) {
    try {
      localStorage.setItem('energyMapping', JSON.stringify(energyMapping));
    } catch (error) {
      console.error('Failed to save energy mapping:', error);
    }
  }
}

export const aiSetupService = new AISetupService();