import { Entity, EnergyData } from '../types/homeAssistant';
import { aiContextService } from './aiContextService';

class HomeAssistantService {
  private wsConnection: WebSocket | null = null;
  private apiUrl: string = '';
  private token: string = '';
  private connected: boolean = false;

  constructor() {
    // Restore connection credentials from localStorage on initialization
    this.loadConnectionState();
  }

  private loadConnectionState(): void {
    try {
      const savedConfig = localStorage.getItem('homeAssistantConfig');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        this.apiUrl = config.url || '';
        this.token = config.token || '';
        // Don't restore connected state - require explicit connection
      }
    } catch (error) {
      console.error('Failed to load connection state:', error);
    }
  }

  private saveConnectionState(): void {
    try {
      const config = {
        url: this.apiUrl,
        token: this.token
        // Don't save connected state - require explicit connection
      };
      localStorage.setItem('homeAssistantConfig', JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save connection state:', error);
    }
  }

  async connect(url: string, token: string): Promise<boolean> {
    this.apiUrl = url.replace(/\/$/, ''); // Remove trailing slash
    this.token = token;
    
    try {
      console.log('Testing connection to:', `${this.apiUrl}/api/states`);
      
      // Test the connection by fetching states with proper authentication
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${this.apiUrl}/api/states`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your access token.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check if response is JSON before trying to parse it
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON response received:', responseText.substring(0, 200));
        
        if (responseText.includes('<!doctype') || responseText.includes('<html')) {
          throw new Error('Invalid response format - received HTML instead of JSON. This usually means:\n\n1. The Home Assistant URL is incorrect\n2. Home Assistant is not running\n3. You\'re connecting to a web server instead of Home Assistant\n4. A proxy or firewall is intercepting the request\n\nPlease verify your Home Assistant URL and ensure it\'s accessible.');
        }
        
        throw new Error('Invalid response format - expected JSON but received HTML. Check your Home Assistant URL and ensure it\'s accessible.');
      }

      // Try to parse the response to verify it's valid JSON
      const testData = await response.json();
      console.log('Connection successful! Found', testData.length, 'entities');

      this.connected = true;
      this.saveConnectionState();
      return true;
    } catch (error) {
      console.error('Failed to connect to Home Assistant:', error);
      
      // Provide specific error guidance
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Connection timeout. Please check your Home Assistant URL and ensure it\'s accessible.');
        } else if (error.message.includes('Authentication failed')) {
          throw error;
        } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          throw new Error('CORS Error: Home Assistant is blocking requests from this domain. This is a browser security feature that prevents unauthorized access to your Home Assistant instance.\n\nTo fix this, add the following configuration to your Home Assistant configuration.yaml file:\n\nhttp:\n  cors_allowed_origins:\n    - "http://localhost:5173"\n    - "https://localhost:5173"\n    - "http://localhost:3000"\n    - "https://localhost:3000"\n    - "http://127.0.0.1:5173"\n    - "https://127.0.0.1:5173"\n    - "https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--96435430.local-credentialless.webcontainer-api.io"\n  use_x_forwarded_for: true\n  trusted_proxies:\n    - 127.0.0.1\n    - ::1\n\nIMPORTANT STEPS:\n1. Save the configuration.yaml file\n2. Restart Home Assistant COMPLETELY (not just reload config)\n3. Wait for Home Assistant to fully start up\n4. Try connecting again\n\nIf you\'re using Home Assistant OS, you can restart from Settings > System > Hardware > Reboot System.');
        } else if (error.message.includes('NetworkError') || error.message.includes('net::')) {
          throw new Error('Network Error: Cannot reach Home Assistant. Please check:\n1. Home Assistant URL is correct\n2. Home Assistant is running\n3. Network connectivity\n4. Firewall settings');
        }
      }
      
      this.connected = false;
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    this.connected = false;
    this.apiUrl = '';
    this.token = '';
    localStorage.removeItem('homeAssistantConfig');
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  async getEntities(): Promise<Entity[]> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      console.log('Fetching entities from:', `${this.apiUrl}/api/states`);
      
      const response = await fetch(`${this.apiUrl}/api/states`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        if (response.status === 0) {
          throw new Error('CORS Error: Please configure Home Assistant to allow requests from this domain.');
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('Non-JSON response received:', responseText.substring(0, 200));
        
        if (responseText.includes('<!doctype') || responseText.includes('<html')) {
          throw new Error('Invalid response format - received HTML instead of JSON. This usually means:\n\n1. The Home Assistant URL is incorrect\n2. Home Assistant is not running\n3. You\'re connecting to a web server instead of Home Assistant\n4. A proxy or firewall is intercepting the request\n\nPlease verify your Home Assistant URL and ensure it\'s accessible.');
        }
        
        throw new Error('Invalid response format - expected JSON but received HTML. Check your Home Assistant URL and ensure it\'s accessible.');
      }

      const states = await response.json();
      
      return states.map((state: any) => ({
        entity_id: state.entity_id,
        state: state.state,
        attributes: state.attributes,
        last_changed: state.last_changed,
        last_updated: state.last_updated,
        friendly_name: state.attributes.friendly_name || state.entity_id,
        device_class: state.attributes.device_class,
        unit_of_measurement: state.attributes.unit_of_measurement
      }));
    } catch (error) {
      console.error('Failed to fetch entities:', error);
      throw error;
    }
  }

  async disableEntity(entityId: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      // Use the entity registry to disable the entity
      const response = await fetch(`${this.apiUrl}/api/config/entity_registry/${entityId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          disabled_by: 'user'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to disable entity:', error);
      throw error;
    }
  }

  async enableEntity(entityId: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      // Use the entity registry to enable the entity
      const response = await fetch(`${this.apiUrl}/api/config/entity_registry/${entityId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          disabled_by: null
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to enable entity:', error);
      throw error;
    }
  }

  async deleteEntity(entityId: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      // Delete from entity registry
      const response = await fetch(`${this.apiUrl}/api/config/entity_registry/${entityId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete entity:', error);
      throw error;
    }
  }

  async getHelpers(): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      // Get input_boolean helpers
      const inputBooleanResponse = await fetch(`${this.apiUrl}/api/config/input_boolean/config`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      // Get input_number helpers
      const inputNumberResponse = await fetch(`${this.apiUrl}/api/config/input_number/config`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      // Get input_select helpers
      const inputSelectResponse = await fetch(`${this.apiUrl}/api/config/input_select/config`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      const helpers = [];

      if (inputBooleanResponse.ok) {
        const inputBooleans = await inputBooleanResponse.json();
        Object.entries(inputBooleans).forEach(([key, value]: [string, any]) => {
          helpers.push({
            entity_id: `input_boolean.${key}`,
            type: 'input_boolean',
            name: value.name || key,
            ...value
          });
        });
      }

      if (inputNumberResponse.ok) {
        const inputNumbers = await inputNumberResponse.json();
        Object.entries(inputNumbers).forEach(([key, value]: [string, any]) => {
          helpers.push({
            entity_id: `input_number.${key}`,
            type: 'input_number',
            name: value.name || key,
            ...value
          });
        });
      }

      if (inputSelectResponse.ok) {
        const inputSelects = await inputSelectResponse.json();
        Object.entries(inputSelects).forEach(([key, value]: [string, any]) => {
          helpers.push({
            entity_id: `input_select.${key}`,
            type: 'input_select',
            name: value.name || key,
            ...value
          });
        });
      }

      return helpers;
    } catch (error) {
      return [];
    }
  }

  async getAutomations(): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/config/automation/config`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      if (response.ok) {
        const automations = await response.json();
        return Array.isArray(automations) ? automations : [];
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  async getScenes(): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/config/scene/config`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      if (response.ok) {
        const scenes = await response.json();
        return Array.isArray(scenes) ? scenes : [];
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  async getScripts(): Promise<any[]> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/config/script/config`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      if (response.ok) {
        const scripts = await response.json();
        return Object.entries(scripts || {}).map(([key, value]: [string, any]) => ({
          entity_id: `script.${key}`,
          name: value.alias || key,
          ...value
        }));
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  async getServices(): Promise<any> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/services`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });

      if (response.ok) {
        return await response.json();
      }
      return {};
    } catch (error) {
      return {};
    }
  }

  async callService(domain: string, service: string, serviceData?: any): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/services/${domain}/${service}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceData || {})
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Service call error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to call service:', error);
      throw error;
    }
  }
  async toggleEntity(entityId: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      const domain = entityId.split('.')[0];
      let service = 'toggle';
      
      // Use domain-specific services for better control
      if (domain === 'light') {
        service = 'toggle';
      } else if (domain === 'switch') {
        service = 'toggle';
      } else if (domain === 'input_boolean') {
        service = 'toggle';
      }
      
      const response = await fetch(`${this.apiUrl}/api/services/${domain}/${service}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity_id: entityId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Toggle entity error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to toggle entity:', error);
      throw error;
    }
  }

  async getEnergyData(): Promise<EnergyData[]> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      // Query Home Assistant history API for energy data
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const response = await fetch(`${this.apiUrl}/api/history/period/${startTime.toISOString()}?filter_entity_id=sensor.energy_consumption,sensor.power_consumption`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const historyData = await response.json();
      
      // Transform history data to EnergyData format
      const energyData: EnergyData[] = [];
      
      if (historyData && historyData.length > 0) {
        historyData[0].forEach((entry: any) => {
          const consumption = parseFloat(entry.state) || 0;
          energyData.push({
            entity_id: entry.entity_id,
            consumption: consumption,
            cost: consumption * 0.12, // Assuming $0.12 per kWh
            timestamp: entry.last_updated
          });
        });
      }
      
      return energyData.length > 0 ? energyData : this.generateFallbackEnergyData();
    } catch (error) {
      console.error('Failed to fetch energy data:', error);
      // Return fallback data if energy history is not available
      return this.generateFallbackEnergyData();
    }
  }

  async processAICommand(command: string, entities: Entity[] = []): Promise<string> {
    if (!this.connected) {
      return "I'm your Grok AI assistant! While Home Assistant isn't connected, I can still help you with smart home guidance, dashboard creation tips, and energy management advice. What would you like to know?";
    }

    // Get AI provider settings
    const getAIProvider = () => {
      try {
        const preferences = localStorage.getItem('appPreferences');
        if (preferences) {
          const parsed = JSON.parse(preferences);
          return {
            provider: parsed.aiProvider || 'homeassistant',
            apiKey: parsed.aiProvider === 'openai' ? parsed.openaiApiKey?.trim() :
                   parsed.aiProvider === 'claude' ? parsed.claudeApiKey?.trim() :
                   parsed.aiProvider === 'gemini' ? parsed.geminiApiKey?.trim() :
                   parsed.aiProvider === 'grok' ? parsed.grokApiKey?.trim() :
                   parsed.aiProvider === 'lmstudio' ? 'local' : '',
            lmstudioUrl: parsed.lmstudioUrl || 'http://localhost:1234'
          };
        }
      } catch (error) {
        console.error('Failed to get AI provider:', error);
      }
      return { provider: 'homeassistant', apiKey: '' };
    };

    const aiConfig = getAIProvider();
    const { provider, apiKey } = aiConfig;

    // Always try to use external AI if configured, fallback to Home Assistant
    if (provider !== 'homeassistant' && apiKey) {
      try {
        // Fetch comprehensive context
        const currentEntities = entities.length > 0 ? entities : await this.getEntities();
        const [automations, scenes, scripts, helpers] = await Promise.all([
          this.getAutomations().catch(() => []),
          this.getScenes().catch(() => []),
          this.getScripts().catch(() => []),
          this.getHelpers().catch(() => [])
        ]);

        // Group entities by domain for better context
        const entitiesByDomain: Record<string, any[]> = {};
        currentEntities.forEach(e => {
          const domain = e.entity_id.split('.')[0];
          if (!entitiesByDomain[domain]) {
            entitiesByDomain[domain] = [];
          }
          entitiesByDomain[domain].push({
            id: e.entity_id,
            name: e.friendly_name || e.entity_id,
            state: e.state,
            attributes: e.attributes
          });
        });

        const entityContext = await aiContextService.buildCompleteAIContext(currentEntities);

        const deviceContext = currentEntities.map(e => ({
          id: e.entity_id,
          name: e.friendly_name || e.entity_id,
          state: e.state,
          type: e.entity_id.split('.')[0],
          unit: e.unit_of_measurement || '',
          attributes: e.attributes
        }));

        const systemPrompt = `You are an advanced smart home AI assistant with deep knowledge of Home Assistant. You have FULL ACCESS to control and manage this smart home system.

COMPLETE ENTITY DATABASE:
${currentEntities.map(e =>
  `${e.entity_id}|${e.friendly_name || e.entity_id}|${e.state}${e.unit_of_measurement ? ' ' + e.unit_of_measurement : ''}|${e.entity_id.split('.')[0]}`
).join('\n')}

AUTOMATIONS: ${automations.length} configured
${automations.slice(0, 3).map((a: any) => `- ${a.alias || a.id}`).join('\n')}

SCENES: ${scenes.length} configured
${scenes.slice(0, 3).map((s: any) => `- ${s.name || s.id}`).join('\n')}

SCRIPTS: ${scripts.length} configured
${scripts.slice(0, 3).map((s: any) => `- ${s.name}`).join('\n')}

HELPERS: ${helpers.length} configured
${helpers.slice(0, 3).map((h: any) => `- ${h.name} (${h.entity_id})`).join('\n')}

YOUR CAPABILITIES:
1. Control ALL devices (lights, switches, climate, media players, covers, fans, etc.)
   - Turn on/off, set brightness, change colors, adjust temperature
   - Use entity IDs or friendly names

2. Execute automations, scenes, and scripts
   - Trigger any automation by name
   - Activate scenes for predefined states
   - Run scripts for complex actions

3. Query and analyze device states
   - Check current status of any entity
   - Analyze patterns and usage
   - Provide insights on energy consumption

4. Manage helpers (input_boolean, input_number, input_select)
   - Set values, toggle states
   - Use helpers for automation logic

5. Provide technical guidance
   - Home Assistant configuration
   - Automation creation
   - Dashboard design
   - Energy monitoring setup

COMMAND EXECUTION:
When users request device control:
1. Identify the correct entity by name or ID
2. Determine the appropriate action (turn_on, turn_off, toggle, set_value, etc.)
3. Acknowledge the action clearly
4. For scenes/scripts: use their entity names to activate

For queries about status:
1. Search through the complete entity list above using exact names or partial matches
2. Report current states with units of measurement
3. Include relevant attributes (battery level, temperature, power consumption, etc.)
4. If searching for a sensor, look for partial name matches in the entity list
5. Provide the entity_id for reference

CRITICAL INSTRUCTIONS FOR ENTITY QUERIES:
When a user asks about any entity state/status/value:

1. SEARCH STRATEGY (in order):
   a. Exact entity_id match (e.g., "sensor.battery_power")
   b. Exact friendly_name match (case-insensitive)
   c. Partial entity_id match (contains keyword)
   d. Partial friendly_name match (contains keyword)
   e. Domain match (e.g., user says "battery" → search sensor.*, binary_sensor.* with "battery" in name)
   f. Attribute keyword match (check common attributes like device_class)

2. PARSING THE DATABASE:
   - Format: entity_id|friendly_name|state unit|domain
   - Example: "sensor.battery_power|Battery Power|5.2 kW|sensor"
   - Extract ALL fields and use them in your response

3. MULTIPLE MATCHES:
   - If multiple entities match, list ALL of them with their states
   - Group by domain for clarity (sensors together, switches together, etc.)
   - Show entity_id in parentheses for reference

4. STATE REPORTING:
   - ALWAYS include the unit of measurement if present
   - For sensors: report numeric value with unit (e.g., "5.2 kW", "75%", "22.5°C")
   - For binary sensors: report on/off, open/closed, detected/clear, etc.
   - For switches/lights: report on/off with additional attributes if relevant
   - For climate: report temperature, mode, fan speed, etc.

5. FUZZY MATCHING:
   - "battery" → match anything with "battery" in entity_id or friendly_name
   - "temperature" → match temp, temperature, thermostat entities
   - "power" → match wattage, consumption, generation entities
   - "solar" → match solar panels, inverters, production
   - Keywords map to domains: "light" (light.*), "switch" (switch.*), "sensor" (sensor.*)

6. EXAMPLE QUERIES AND RESPONSES:

User: "what's the battery power?"
Search: "battery" AND "power" → find sensor.battery_power
Response: "The Battery Power (sensor.battery_power) is currently 5.2 kW"

User: "show all battery sensors"
Search: "battery" in any field → find all matches
Response: "Here are all battery-related sensors:
• Battery Power (sensor.battery_power): 5.2 kW
• Battery SOC (sensor.battery_soc): 85%
• Battery Voltage (sensor.battery_voltage): 52.3 V"

User: "temperature in living room"
Search: "temperature" AND "living" → find sensor.living_room_temperature
Response: "The Living Room Temperature (sensor.living_room_temperature) is 22.5°C"

User: "is the front door open?"
Search: "front door" → find binary_sensor.front_door
Response: "The Front Door (binary_sensor.front_door) is currently closed"

7. ERROR HANDLING:
   - If NO match found: "I couldn't find any entity matching '[query]'. Available entities include: [list 5 similar entities]"
   - Suggest closest matches based on keyword similarity
   - Never claim an entity exists without finding it in the database above

You are Grok AI, an advanced smart home assistant with deep knowledge of Home Assistant. You can:
1. Control devices (lights, switches, climate, etc.)
2. CREATE AUTOMATIONS via natural language commands
3. CREATE DASHBOARDS with custom cards and layouts
4. Analyze energy usage and provide insights
5. Provide technical guidance on Home Assistant components

AUTOMATION CREATION (NEW FEATURE):
When users ask to create an automation, respond in this format:
AUTOMATION_CREATE: {
  "name": "Descriptive name",
  "description": "What it does",
  "trigger": {"type": "state|time|numeric_state", "entity_id": "...", "to": "on", "at": "18:00"},
  "actions": [{"type": "call_service", "service": "light.turn_on", "entity_id": "light.living_room"}]
}

Examples:
- "Create automation to turn on porch light at sunset" → time trigger + light service
- "When motion detected turn on hallway lights" → state trigger (motion) + light service
- "Turn off all lights at 11pm" → time trigger + light service

DASHBOARD CREATION (NEW FEATURE):
When users ask to create a dashboard, respond in this format:
DASHBOARD_CREATE: {
  "name": "Dashboard Name",
  "description": "Purpose",
  "cards": [
    {"type": "entity", "title": "Living Room Light", "entity_ids": ["light.living_room"]},
    {"type": "thermostat", "title": "Climate", "entity_ids": ["climate.thermostat"]},
    {"type": "energy", "title": "Energy Flow", "entity_ids": ["sensor.solar_power", "sensor.battery_power"]}
  ]
}

Card types available: entity, entities, gauge, history-graph, sensor, thermostat, weather, light, media-control, energy, button, grid

Examples:
- "Create living room dashboard" → cards for lights, climate, media in that room
- "Make energy monitoring dashboard" → energy, gauge, and history-graph cards
- "Dashboard for bedroom" → lights, climate, sensors for bedroom

Available dashboard card types:
- Light control cards with brightness sliders
- Switch control cards with power monitoring
- Sensor display cards with gauges and charts
- Gauge cards (temperature, humidity, battery)
- Line chart cards (energy usage, sensor history)
- Bar chart cards for comparisons
- Weather cards
- Energy flow diagrams with solar/battery/grid
- Statistics cards
- Status overview cards
- Custom metric cards

Energy Management Features:
- Solar generation monitoring and optimization
- Battery storage level and flow tracking
- Grid import/export visualization
- Real-time consumption monitoring
- Cost analysis and savings recommendations
- Device-level energy tracking
- Peak/off-peak usage optimization

Dashboard Management:
- Multiple dashboard creation and organization
- Tree view navigation with pinned favorites
- Professional templates for different room types
- Drag-and-drop card arrangement
- Custom layouts and themes

When users ask about dashboards, suggest specific card types and layouts. For energy management, provide detailed configuration guidance for solar/battery/grid monitoring.

Current device states:
${deviceContext.map(d => `- ${d.name} (${d.id}): ${d.state} [${d.type}]`).join('\n')}

Respond naturally and helpfully as Grok AI. When controlling devices, acknowledge actions. When discussing dashboards or energy management, provide specific, actionable recommendations with professional insights. Always maintain your Grok AI personality - be helpful, knowledgeable, and slightly witty when appropriate.`;

        let response;
        
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
                  { role: 'user', content: command }
                ],
                temperature: 0.7,
                max_tokens: 800
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
                model: 'claude-3-haiku-20240307',
                max_tokens: 800,
                messages: [
                  { role: 'user', content: `${systemPrompt}\n\nUser: ${command}` }
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
                    text: `${systemPrompt}\n\nUser: ${command}`
                  }]
                }],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 800
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
                model: 'grok-beta',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: command }
                ],
                temperature: 0.7,
                max_tokens: 800
              })
            });
            break;

          case 'lmstudio':
            const lmUrl = (aiConfig as any).lmstudioUrl || 'http://localhost:1234';
            try {
              response = await fetch(`${lmUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: command }
                  ],
                  temperature: 0.7,
                  max_tokens: 800,
                  stream: false
                }),
                signal: AbortSignal.timeout(30000)
              });
            } catch (error) {
              console.error('LM Studio connection error:', error);
              if (error instanceof Error && error.name === 'TimeoutError') {
                throw new Error('LM Studio request timed out. The model might be too slow or not responding.');
              }
              throw error;
            }
            break;
        }

        if (response?.ok) {
          const data = await response.json();
          let aiResponse = '';

          switch (provider) {
            case 'openai':
            case 'grok':
            case 'lmstudio':
              aiResponse = data.choices[0]?.message?.content || '';
              break;
            case 'claude':
              aiResponse = data.content[0]?.text || '';
              break;
            case 'gemini':
              aiResponse = data.candidates[0]?.content?.parts[0]?.text || '';
              break;
          }

          if (aiResponse) {
            // Try to execute any device commands mentioned in the response
            await this.executeDeviceCommands(command, currentEntities, automations, scenes, scripts);
            return aiResponse;
          }
        } else {
          const errorText = await response?.text().catch(() => 'Unknown error');
          console.error('AI API Error:', response?.status, errorText);
        }
      } catch (error) {
        console.error('External AI provider failed:', error);

        if (provider === 'lmstudio') {
          if (error instanceof Error) {
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
              return "❌ Unable to connect to LM Studio. Please check:\n\n1. LM Studio is running\n2. Local server is started (look for the server tab)\n3. A model is loaded and ready\n4. Server is accessible at: " + ((aiConfig as any).lmstudioUrl || 'http://localhost:1234') + "\n5. CORS is enabled in LM Studio settings\n\nTry sending your message again once LM Studio is ready.";
            }
            if (error.message.includes('timed out') || error.message.includes('TimeoutError')) {
              return "⏱️ LM Studio is taking too long to respond. This might mean:\n\n1. The model is still loading\n2. Your computer is under heavy load\n3. The model is too large for your hardware\n\nTry a smaller/faster model or wait a moment and try again.";
            }
          }
          return "⚠️ LM Studio error: " + (error instanceof Error ? error.message : 'Unknown error') + "\n\nPlease check that LM Studio is running with a model loaded.";
        }

        // CORS errors for other providers
        if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('CORS'))) {
          return "I'm Grok AI, your smart home assistant! I'm ready to help you control devices, create dashboards, analyze energy usage, and provide Home Assistant guidance. What would you like to do?";
        }

        // For other errors, fall through to Home Assistant conversation API
      }
    }

    // Use Home Assistant's conversation API as fallback or default
    try {
      const response = await fetch(`${this.apiUrl}/api/conversation/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: command,
          language: 'en'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.response?.speech?.plain?.speech || "I'm Grok AI and I've processed your request! How else can I help with your smart home?";
    } catch (error) {
      console.error('Failed to process AI command:', error);
      throw error;
    }
  }

  private async executeDeviceCommands(
    command: string,
    entities: Entity[],
    automations: any[] = [],
    scenes: any[] = [],
    scripts: any[] = []
  ): Promise<void> {
    const lowerCommand = command.toLowerCase();

    try {
      // Helper function to find entity by name or ID
      const findEntity = (searchTerm: string, domain?: string): Entity | undefined => {
        const cleanSearch = searchTerm.toLowerCase().trim();

        return entities.find(e => {
          const matchesDomain = !domain || e.entity_id.startsWith(`${domain}.`);
          const entityIdLower = e.entity_id.toLowerCase();
          const friendlyNameLower = (e.friendly_name || '').toLowerCase();

          const matchesId = entityIdLower.includes(cleanSearch);
          const matchesName = friendlyNameLower.includes(cleanSearch);

          // Also try matching with underscores replaced by spaces
          const entityIdSpaced = entityIdLower.replace(/_/g, ' ');
          const matchesIdSpaced = entityIdSpaced.includes(cleanSearch);

          return matchesDomain && (matchesId || matchesName || matchesIdSpaced);
        });
      };

      // Extract potential entity names from command (multi-word support)
      const extractEntityNames = (): string[] => {
        const names: string[] = [];

        // Try to extract patterns like "upstairs light 6", "bedroom lamp", etc.
        const patterns = [
          // Room + device + number: "upstairs light 6"
          /(?:upstairs|downstairs|bedroom|living room|kitchen|bathroom|garage|office|dining)\s+(?:light|lamp|switch|fan)\s+\d+/gi,
          // Device + number: "light 6"
          /(?:light|lamp|switch|fan)\s+\d+/gi,
          // Room + device: "bedroom lamp"
          /(?:upstairs|downstairs|bedroom|living room|kitchen|bathroom|garage|office|dining)\s+(?:light|lamp|switch|fan)/gi,
        ];

        patterns.forEach(pattern => {
          const matches = command.match(pattern);
          if (matches) {
            names.push(...matches.map(m => m.toLowerCase()));
          }
        });

        return names;
      };

      // Extract entity names/rooms from command
      const words = lowerCommand.split(' ');
      const roomKeywords = ['living room', 'bedroom', 'kitchen', 'bathroom', 'garage', 'office', 'dining'];
      const deviceKeywords = ['light', 'lamp', 'switch', 'fan', 'thermostat', 'tv', 'speaker'];

      // Handle status/state queries - don't execute, just let AI respond
      if (lowerCommand.includes('show') || lowerCommand.includes('status') || lowerCommand.includes('state of') ||
          lowerCommand.includes('what is') || lowerCommand.includes('check') || lowerCommand.includes('get')) {
        // This is a query, not a command - let the AI handle the response
        // The AI has full context and will provide the information
        return;
      }

      // Check for automation triggers
      if (lowerCommand.includes('run automation') || lowerCommand.includes('trigger automation')) {
        for (const auto of automations) {
          const autoName = (auto.alias || auto.id).toLowerCase();
          if (lowerCommand.includes(autoName)) {
            await this.callService('automation', 'trigger', { entity_id: `automation.${auto.id}` });
            return;
          }
        }
      }

      // Check for scene activation
      if (lowerCommand.includes('activate scene') || lowerCommand.includes('turn on scene') || lowerCommand.includes('scene')) {
        for (const scene of scenes) {
          const sceneName = (scene.name || scene.id).toLowerCase();
          if (lowerCommand.includes(sceneName)) {
            await this.callService('scene', 'turn_on', { entity_id: `scene.${scene.id}` });
            return;
          }
        }
      }

      // Check for script execution
      if (lowerCommand.includes('run script') || lowerCommand.includes('execute script')) {
        for (const script of scripts) {
          const scriptName = script.name.toLowerCase();
          if (lowerCommand.includes(scriptName)) {
            await this.callService('script', 'turn_on', { entity_id: script.entity_id });
            return;
          }
        }
      }

      // Turn on commands
      if (lowerCommand.includes('turn on') || lowerCommand.includes('switch on') || lowerCommand.includes('enable')) {
        // Try extracted multi-word entity names first
        const entityNames = extractEntityNames();
        console.log('[AI Control] Extracted entity names:', entityNames);

        for (const name of entityNames) {
          const entity = findEntity(name);
          if (entity) {
            console.log('[AI Control] Found entity:', entity.entity_id, 'for name:', name);
            const domain = entity.entity_id.split('.')[0];
            await this.callService(domain, 'turn_on', { entity_id: entity.entity_id });
            console.log('[AI Control] Turned on:', entity.entity_id);
            return;
          } else {
            console.log('[AI Control] No entity found for name:', name);
          }
        }

        // Try to find specific entity mentioned by single words
        for (const word of words) {
          if (word.length < 3) continue; // Skip short words
          const entity = findEntity(word);
          if (entity && entity.state === 'off') {
            const domain = entity.entity_id.split('.')[0];
            await this.callService(domain, 'turn_on', { entity_id: entity.entity_id });
            return;
          }
        }

        // Try domain-specific searches
        if (lowerCommand.includes('light') || lowerCommand.includes('lamp')) {
          const lightEntity = entities.find(e => e.entity_id.startsWith('light.') && e.state === 'off');
          if (lightEntity) {
            await this.callService('light', 'turn_on', { entity_id: lightEntity.entity_id });
            return;
          }
        }

        if (lowerCommand.includes('switch')) {
          const switchEntity = entities.find(e => e.entity_id.startsWith('switch.') && e.state === 'off');
          if (switchEntity) {
            await this.callService('switch', 'turn_on', { entity_id: switchEntity.entity_id });
            return;
          }
        }
      }

      // Turn off commands
      if (lowerCommand.includes('turn off') || lowerCommand.includes('switch off') || lowerCommand.includes('disable')) {
        // Try extracted multi-word entity names first
        const entityNames = extractEntityNames();
        for (const name of entityNames) {
          const entity = findEntity(name);
          if (entity) {
            const domain = entity.entity_id.split('.')[0];
            await this.callService(domain, 'turn_off', { entity_id: entity.entity_id });
            return;
          }
        }

        // Try to find specific entity mentioned by single words
        for (const word of words) {
          if (word.length < 3) continue; // Skip short words
          const entity = findEntity(word);
          if (entity && entity.state === 'on') {
            const domain = entity.entity_id.split('.')[0];
            await this.callService(domain, 'turn_off', { entity_id: entity.entity_id });
            return;
          }
        }

        // Try domain-specific searches
        if (lowerCommand.includes('light') || lowerCommand.includes('lamp')) {
          const lightEntity = entities.find(e => e.entity_id.startsWith('light.') && e.state === 'on');
          if (lightEntity) {
            await this.callService('light', 'turn_off', { entity_id: lightEntity.entity_id });
            return;
          }
        }

        if (lowerCommand.includes('switch')) {
          const switchEntity = entities.find(e => e.entity_id.startsWith('switch.') && e.state === 'on');
          if (switchEntity) {
            await this.callService('switch', 'turn_off', { entity_id: switchEntity.entity_id });
            return;
          }
        }
      }

      // All lights/switches commands
      if (lowerCommand.includes('all lights')) {
        const action = lowerCommand.includes('off') ? 'turn_off' : 'turn_on';
        const lightEntities = entities.filter(e => e.entity_id.startsWith('light.'));
        for (const light of lightEntities) {
          await this.callService('light', action, { entity_id: light.entity_id });
        }
        return;
      }

      // Set brightness
      if (lowerCommand.includes('brightness') || lowerCommand.includes('dim') || lowerCommand.includes('brighten')) {
        const brightnessMatch = lowerCommand.match(/(\d+)\s*%?/);
        if (brightnessMatch) {
          const brightness = parseInt(brightnessMatch[1]);
          const lightEntity = entities.find(e => e.entity_id.startsWith('light.'));
          if (lightEntity) {
            await this.callService('light', 'turn_on', {
              entity_id: lightEntity.entity_id,
              brightness_pct: brightness
            });
            return;
          }
        }
      }

      // Set temperature
      if (lowerCommand.includes('temperature') || lowerCommand.includes('thermostat')) {
        const tempMatch = lowerCommand.match(/(\d+)\s*(?:degrees?|°)?/);
        if (tempMatch) {
          const temperature = parseInt(tempMatch[1]);
          const climateEntity = entities.find(e => e.entity_id.startsWith('climate.'));
          if (climateEntity) {
            await this.callService('climate', 'set_temperature', {
              entity_id: climateEntity.entity_id,
              temperature
            });
            return;
          }
        }
      }
    } catch (error) {
      console.error('Failed to execute device command:', error);
    }
  }

  async addEntity(entityId: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      // Check if entity exists by trying to get its state
      const response = await fetch(`${this.apiUrl}/api/states/${entityId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return true; // Entity already exists
      } else if (response.status === 404) {
        throw new Error(`Entity ${entityId} not found in Home Assistant`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to add entity:', error);
      throw error;
    }
  }

  async setEntityValue(entityId: string, value: string): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected to Home Assistant');
    }

    try {
      const domain = entityId.split('.')[0];
      let service = '';
      let serviceData: any = { entity_id: entityId };

      // Determine the appropriate service based on entity type
      if (domain === 'input_number') {
        service = 'set_value';
        serviceData.value = parseFloat(value);
      } else if (domain === 'input_text') {
        service = 'set_value';
        serviceData.value = value;
      } else if (domain === 'input_select') {
        service = 'select_option';
        serviceData.option = value;
      } else if (domain === 'light' && !isNaN(parseFloat(value))) {
        service = 'turn_on';
        serviceData.brightness = Math.round((parseFloat(value) / 100) * 255);
      } else {
        throw new Error(`Cannot set value for entity type: ${domain}`);
      }

      const response = await fetch(`${this.apiUrl}/api/services/${domain}/${service}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Set entity value error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to set entity value:', error);
      throw error;
    }
  }
  private generateFallbackEnergyData(): EnergyData[] {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => ({
      entity_id: 'sensor.energy_consumption',
      consumption: 0,
      cost: 0,
      timestamp: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000).toISOString()
    }));
  }
}

export const homeAssistantService = new HomeAssistantService();