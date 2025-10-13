import { mcpService } from './mcpService';
import { Entity } from '../types/homeAssistant';

interface CachedContext {
  data: any;
  timestamp: number;
  ttl: number;
}

class OptimizedAIService {
  private contextCache: Map<string, CachedContext> = new Map();
  private readonly DEFAULT_TTL = 30000; // 30 seconds
  private readonly FAST_TTL = 5000; // 5 seconds for frequently changing data

  async getSmartContext(forceRefresh: boolean = false): Promise<any> {
    const cacheKey = 'ai_context';
    const cached = this.contextCache.get(cacheKey);

    if (!forceRefresh && cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log('[OptimizedAI] Using cached context');
      return cached.data;
    }

    try {
      console.log('[OptimizedAI] Fetching fresh MCP context');
      const context = await mcpService.getAIContext();

      this.contextCache.set(cacheKey, {
        data: context,
        timestamp: Date.now(),
        ttl: this.DEFAULT_TTL
      });

      return context;
    } catch (error) {
      console.error('[OptimizedAI] Failed to get MCP context:', error);

      if (cached) {
        console.log('[OptimizedAI] Using stale cache due to error');
        return cached.data;
      }

      throw error;
    }
  }

  async getRelevantEntities(query: string): Promise<Entity[]> {
    const keywords = query.toLowerCase().split(' ');
    const relevantDomains = this.extractDomains(keywords);

    const cacheKey = `entities_${relevantDomains.join('_')}`;
    const cached = this.contextCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    try {
      const states = await mcpService.getStates();
      const entities = Array.isArray(states) ? states : [];

      const relevantEntities = entities.filter((entity: any) => {
        const entityDomain = entity.entity_id.split('.')[0];
        const entityName = (entity.attributes?.friendly_name || entity.entity_id).toLowerCase();

        return relevantDomains.includes(entityDomain) ||
               keywords.some(keyword => entityName.includes(keyword));
      });

      this.contextCache.set(cacheKey, {
        data: relevantEntities,
        timestamp: Date.now(),
        ttl: this.FAST_TTL
      });

      return relevantEntities;
    } catch (error) {
      console.error('[OptimizedAI] Failed to get entities:', error);
      if (cached) return cached.data;
      return [];
    }
  }

  private extractDomains(keywords: string[]): string[] {
    const domainMap: Record<string, string[]> = {
      light: ['light'],
      switch: ['switch'],
      temperature: ['sensor', 'climate'],
      climate: ['climate'],
      thermostat: ['climate'],
      sensor: ['sensor'],
      battery: ['sensor'],
      power: ['sensor'],
      energy: ['sensor'],
      solar: ['sensor'],
      automation: ['automation'],
      script: ['script'],
      scene: ['scene'],
      media: ['media_player'],
      cover: ['cover'],
      blind: ['cover'],
      door: ['binary_sensor', 'cover'],
      window: ['binary_sensor'],
      motion: ['binary_sensor'],
      lock: ['lock']
    };

    const domains = new Set<string>();

    keywords.forEach(keyword => {
      const mappedDomains = domainMap[keyword];
      if (mappedDomains) {
        mappedDomains.forEach(d => domains.add(d));
      }
    });

    if (domains.size === 0) {
      return ['light', 'switch', 'sensor'];
    }

    return Array.from(domains);
  }

  buildOptimizedPrompt(query: string, context: any, relevantEntities: Entity[]): string {
    const summary = context.summary || {};
    const capabilities = context.capabilities || {};
    const energy = context.energy || {};
    const homeControl = context.home_control || {};

    return `You are an advanced smart home AI assistant for Home Assistant.

HOME SUMMARY:
- Total Entities: ${summary.total_entities || 0}
- Automations: ${summary.total_automations || 0}

CAPABILITIES:
- Solar: ${capabilities.has_solar ? 'Yes' : 'No'}
- Battery: ${capabilities.has_battery ? 'Yes' : 'No'}
- Climate Control: ${capabilities.has_climate_control ? 'Yes' : 'No'}
- Lights: ${homeControl.lights || 0}
- Switches: ${homeControl.switches || 0}

RELEVANT ENTITIES FOR THIS QUERY:
${relevantEntities.slice(0, 50).map((e: any) =>
  `${e.entity_id} | ${e.attributes?.friendly_name || e.entity_id} | ${e.state}${e.attributes?.unit_of_measurement ? ' ' + e.attributes.unit_of_measurement : ''}`
).join('\n')}

USER QUERY: ${query}

Provide a concise, accurate response. If controlling devices, confirm the action. If querying status, provide current values with units.`;
  }

  buildCompactSystemPrompt(context: any): string {
    const capabilities = context.capabilities || {};
    const summary = context.summary || {};

    return `Smart Home Assistant
Entities: ${summary.total_entities || 0}
Solar: ${capabilities.has_solar ? '✓' : '✗'}
Battery: ${capabilities.has_battery ? '✓' : '✗'}
Climate: ${capabilities.has_climate_control ? '✓' : '✗'}

You can control lights, switches, climate, and query all sensors.
Be concise and accurate.`;
  }

  clearCache(): void {
    this.contextCache.clear();
    console.log('[OptimizedAI] Cache cleared');
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.contextCache.size,
      keys: Array.from(this.contextCache.keys())
    };
  }

  async prefetchContext(): Promise<void> {
    try {
      await Promise.all([
        this.getSmartContext(),
        mcpService.getEntities(),
        mcpService.getAutomations()
      ]);
      console.log('[OptimizedAI] Context prefetched successfully');
    } catch (error) {
      console.error('[OptimizedAI] Prefetch failed:', error);
    }
  }
}

export const optimizedAIService = new OptimizedAIService();
export default optimizedAIService;
