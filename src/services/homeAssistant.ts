import { Entity, EnergyData } from '../types/homeAssistant';
import { aiContextService } from './aiContextService';

export interface AIResponse {
  text: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  provider?: string;
}

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

  async processAICommand(command: string, entities: Entity[] = []): Promise<AIResponse> {
    if (!this.connected) {
      return {
        text: "I'm your Grok AI assistant! While Home Assistant isn't connected, I can still help you with smart home guidance, dashboard creation tips, and energy management advice. What would you like to know?",
        provider: 'none'
      };
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

        // Smart entity filtering based on query
        const filterRelevantEntities = (query: string, entities: Entity[], maxEntities: number = 30) => {
          const queryLower = query.toLowerCase();
          const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);

          // Always include high-priority entities (battery, solar, grid, etc.)
          const priorityKeywords = ['battery', 'solar', 'grid', 'power', 'energy', 'temperature'];
          const priorityEntities = entities.filter(e => {
            const entityId = e.entity_id.toLowerCase();
            const name = (e.friendly_name || '').toLowerCase();
            return priorityKeywords.some(pk => entityId.includes(pk) || name.includes(pk));
          }).slice(0, 10); // Top 10 priority entities

          // Score each entity based on relevance
          const scoredEntities = entities.map(e => {
            let score = 0;
            const entityIdLower = e.entity_id.toLowerCase();
            const nameLower = (e.friendly_name || e.entity_id).toLowerCase();

            // Priority entities get base score
            if (priorityEntities.some(pe => pe.entity_id === e.entity_id)) {
              score += 10;
            }

            // Exact matches get highest priority
            if (entityIdLower === queryLower || nameLower === queryLower) score += 100;

            // Check each keyword
            keywords.forEach(keyword => {
              if (entityIdLower.includes(keyword)) score += 20;
              if (nameLower.includes(keyword)) score += 15;
              if (e.state?.toString().toLowerCase().includes(keyword)) score += 5;
            });

            // Common domains get slight boost for general queries
            const domain = e.entity_id.split('.')[0];
            if (keywords.length === 0 || keywords.some(k => ['light', 'switch', 'sensor', 'climate'].includes(k))) {
              if (['light', 'switch', 'sensor', 'binary_sensor', 'climate'].includes(domain)) {
                score += 2;
              }
            }

            return { entity: e, score };
          });

          // Sort by score and take top results
          const sorted = scoredEntities
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score);

          // If we have highly relevant results, use them
          if (sorted.length > 0 && sorted[0].score > 15) {
            return sorted.slice(0, maxEntities).map(s => s.entity);
          }

          // Otherwise, return a diverse sample of entities
          const domains: Record<string, Entity[]> = {};
          entities.forEach(e => {
            const domain = e.entity_id.split('.')[0];
            if (!domains[domain]) domains[domain] = [];
            if (domains[domain].length < 5) domains[domain].push(e);
          });

          const diverse: Entity[] = [];
          Object.values(domains).forEach(domainEntities => {
            diverse.push(...domainEntities.slice(0, 3));
          });

          return diverse.slice(0, maxEntities);
        };

        const relevantEntities = filterRelevantEntities(command, currentEntities, 30);

        const deviceContext = relevantEntities.map(e => ({
          id: e.entity_id,
          name: e.friendly_name || e.entity_id,
          state: e.state,
          type: e.entity_id.split('.')[0],
          unit: e.unit_of_measurement || '',
          attributes: e.attributes
        }));

        const systemPrompt = `You are Grok AI, a smart home assistant for Home Assistant.

RELEVANT ENTITIES (${relevantEntities.length} of ${currentEntities.length} total):
${relevantEntities.map(e =>
  `${e.entity_id}|${e.friendly_name || e.entity_id}|${e.state}${e.unit_of_measurement ? ' ' + e.unit_of_measurement : ''}`
).join('\n')}

SYSTEM INFO:
- Automations: ${automations.length} | Scenes: ${scenes.length} | Scripts: ${scripts.length}
${automations.length > 0 ? `- Top automations: ${automations.slice(0, 2).map((a: any) => a.alias || a.id).join(', ')}` : ''}

INSTRUCTIONS:
1. Answer queries using entities from the list above
2. Format: entity_id|friendly_name|state unit
3. Search by entity_id or friendly_name (exact or partial match)
4. Control devices: identify entity, state action, acknowledge
5. Always include units of measurement in responses
6. If entity not found in list, say so and suggest similar ones

For automation creation, use: AUTOMATION_CREATE: {...}
For dashboard creation, use: DASHBOARD_CREATE: {...}

Respond naturally as Grok AI - helpful and knowledgeable.`;

        // Log prompt optimization metrics
        const promptLength = systemPrompt.length;
        const estimatedTokens = Math.ceil(promptLength / 4); // Rough estimate: 1 token ≈ 4 chars
        console.log(`[AI Optimization] Prompt size: ${promptLength} chars (~${estimatedTokens} tokens)`);
        console.log(`[AI Optimization] Entities: ${relevantEntities.length}/${currentEntities.length} (${Math.round(relevantEntities.length / currentEntities.length * 100)}%)`);

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
          let tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;

          switch (provider) {
            case 'openai':
            case 'grok':
            case 'lmstudio':
              aiResponse = data.choices[0]?.message?.content || '';
              if (data.usage) {
                tokenUsage = {
                  inputTokens: data.usage.prompt_tokens || 0,
                  outputTokens: data.usage.completion_tokens || 0,
                  totalTokens: data.usage.total_tokens || 0
                };
              }
              break;
            case 'claude':
              aiResponse = data.content[0]?.text || '';
              if (data.usage) {
                tokenUsage = {
                  inputTokens: data.usage.input_tokens || 0,
                  outputTokens: data.usage.output_tokens || 0,
                  totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
                };
              }
              break;
            case 'gemini':
              aiResponse = data.candidates[0]?.content?.parts[0]?.text || '';
              if (data.usageMetadata) {
                tokenUsage = {
                  inputTokens: data.usageMetadata.promptTokenCount || 0,
                  outputTokens: data.usageMetadata.candidatesTokenCount || 0,
                  totalTokens: data.usageMetadata.totalTokenCount || 0
                };
              }
              break;
          }

          if (aiResponse) {
            // Try to execute any device commands mentioned in the response
            await this.executeDeviceCommands(command, currentEntities, automations, scenes, scripts);
            return {
              text: aiResponse,
              tokenUsage,
              provider
            };
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
              return {
                text: "❌ Unable to connect to LM Studio. Please check:\n\n1. LM Studio is running\n2. Local server is started (look for the server tab)\n3. A model is loaded and ready\n4. Server is accessible at: " + ((aiConfig as any).lmstudioUrl || 'http://localhost:1234') + "\n5. CORS is enabled in LM Studio settings\n\nTry sending your message again once LM Studio is ready.",
                provider: 'lmstudio'
              };
            }
            if (error.message.includes('timed out') || error.message.includes('TimeoutError')) {
              return {
                text: "⏱️ LM Studio is taking too long to respond. This might mean:\n\n1. The model is still loading\n2. Your computer is under heavy load\n3. The model is too large for your hardware\n\nTry a smaller/faster model or wait a moment and try again.",
                provider: 'lmstudio'
              };
            }
          }
          return {
            text: "⚠️ LM Studio error: " + (error instanceof Error ? error.message : 'Unknown error') + "\n\nPlease check that LM Studio is running with a model loaded.",
            provider: 'lmstudio'
          };
        }

        // CORS errors for other providers
        if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('CORS'))) {
          return {
            text: "I'm Grok AI, your smart home assistant! I'm ready to help you control devices, create dashboards, analyze energy usage, and provide Home Assistant guidance. What would you like to do?",
            provider
          };
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
      return {
        text: result.response?.speech?.plain?.speech || "I'm Grok AI and I've processed your request! How else can I help with your smart home?",
        provider: 'homeassistant'
      };
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
    console.log('[executeDeviceCommands] Attempting to execute command:', lowerCommand);
    console.log('[executeDeviceCommands] Available entities:', entities.length);

    try {
      // Helper function to find entity by name or ID
      const findEntity = (searchTerm: string, domain?: string): Entity | undefined => {
        const cleanSearch = searchTerm.toLowerCase().trim().replace(/\s+/g, ' ');
        const cleanSearchNoSpaces = cleanSearch.replace(/\s+/g, '_');

        return entities.find(e => {
          const matchesDomain = !domain || e.entity_id.startsWith(`${domain}.`);
          const entityIdLower = e.entity_id.toLowerCase();
          const friendlyNameLower = (e.friendly_name || '').toLowerCase();

          // Direct match
          const matchesId = entityIdLower.includes(cleanSearch);
          const matchesName = friendlyNameLower.includes(cleanSearch);

          // Match with spaces replaced by underscores (for entity_id matching)
          const matchesIdWithUnderscore = entityIdLower.includes(cleanSearchNoSpaces);

          // Match entity ID without domain prefix and with underscores converted to spaces
          const entityIdWithoutDomain = entityIdLower.split('.')[1] || '';
          const entityIdSpaced = entityIdWithoutDomain.replace(/_/g, ' ');
          const matchesIdSpaced = entityIdSpaced.includes(cleanSearch);

          return matchesDomain && (matchesId || matchesName || matchesIdSpaced || matchesIdWithUnderscore);
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
        console.log('[executeDeviceCommands] Detected TURN ON command');

        // Try extracted multi-word entity names first
        const entityNames = extractEntityNames();
        console.log('[executeDeviceCommands] Extracted entity names:', entityNames);

        for (const name of entityNames) {
          const entity = findEntity(name);
          if (entity) {
            console.log('[executeDeviceCommands] Found entity:', entity.entity_id, 'for name:', name);
            const domain = entity.entity_id.split('.')[0];
            await this.callService(domain, 'turn_on', { entity_id: entity.entity_id });
            console.log('[executeDeviceCommands] ✓ Successfully turned on:', entity.entity_id);
            return;
          } else {
            console.log('[executeDeviceCommands] No entity found for name:', name);
          }
        }

        // Try to find specific entity mentioned by single words
        console.log('[executeDeviceCommands] Trying single words from command...');
        for (const word of words) {
          if (word.length < 3) continue; // Skip short words
          const entity = findEntity(word);
          if (entity) {
            console.log('[executeDeviceCommands] Found entity by word "' + word + '":', entity.entity_id, 'state:', entity.state);
            if (entity.state === 'off' || entity.state === 'on') {
              const domain = entity.entity_id.split('.')[0];
              await this.callService(domain, 'turn_on', { entity_id: entity.entity_id });
              console.log('[executeDeviceCommands] ✓ Successfully turned on:', entity.entity_id);
              return;
            }
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

      console.log('[executeDeviceCommands] No matching command pattern found for:', lowerCommand);
    } catch (error) {
      console.error('[executeDeviceCommands] Failed to execute device command:', error);
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