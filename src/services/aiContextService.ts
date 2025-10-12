import { dbService } from './database';
import { Entity } from '../types/homeAssistant';

interface EntityMapping {
  entity_id: string;
  friendly_name: string;
  state: string;
  unit: string;
  possible_names: string[];
  domain: string;
}

class AIContextService {
  async getAIInstructions(): Promise<string> {
    try {
      const supabase = dbService.getClient();
      const { data, error } = await supabase
        .from('user_preferences')
        .select('value')
        .eq('key', 'ai_instructions')
        .maybeSingle();

      if (error) {
        console.error('Failed to get AI instructions:', error);
        return '';
      }

      return data?.value?.instructions || '';
    } catch (error) {
      console.error('Error getting AI instructions:', error);
      return '';
    }
  }

  async saveAIInstructions(instructions: string): Promise<void> {
    try {
      const supabase = dbService.getClient();
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          key: 'ai_instructions',
          value: { instructions },
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        console.error('Failed to save AI instructions:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error saving AI instructions:', error);
      throw error;
    }
  }

  createEntityMappings(entities: Entity[]): EntityMapping[] {
    return entities.map(entity => {
      const friendlyName = entity.friendly_name || entity.entity_id;
      const domain = entity.entity_id.split('.')[0];
      const namePart = entity.entity_id.split('.')[1] || '';

      const possibleNames = [
        friendlyName.toLowerCase(),
        entity.entity_id.toLowerCase(),
        namePart.replace(/_/g, ' ').toLowerCase(),
        namePart.replace(/_/g, '').toLowerCase()
      ];

      const words = friendlyName.toLowerCase().split(/\s+/);
      if (words.length > 1) {
        possibleNames.push(...words);
        possibleNames.push(words.join(''));
      }

      return {
        entity_id: entity.entity_id,
        friendly_name: friendlyName,
        state: entity.state || 'unknown',
        unit: entity.attributes?.unit_of_measurement || '',
        possible_names: [...new Set(possibleNames)],
        domain
      };
    });
  }

  buildEntityContext(entities: Entity[]): string {
    const mappings = this.createEntityMappings(entities);

    const byDomain = mappings.reduce((acc, mapping) => {
      if (!acc[mapping.domain]) {
        acc[mapping.domain] = [];
      }
      acc[mapping.domain].push(mapping);
      return acc;
    }, {} as Record<string, EntityMapping[]>);

    let context = 'COMPLETE ENTITY DATABASE:\n\n';

    Object.entries(byDomain).forEach(([domain, domainEntities]) => {
      context += `${domain.toUpperCase()} (${domainEntities.length} entities):\n`;
      domainEntities.forEach(mapping => {
        const stateDisplay = mapping.unit
          ? `${mapping.state} ${mapping.unit}`
          : mapping.state;
        context += `  - ${mapping.friendly_name} (${mapping.entity_id}): ${stateDisplay}\n`;
        if (mapping.possible_names.length > 2) {
          context += `    Aliases: ${mapping.possible_names.slice(0, 5).join(', ')}\n`;
        }
      });
      context += '\n';
    });

    return context;
  }

  async buildCompleteAIContext(entities: Entity[]): Promise<string> {
    const instructions = await this.getAIInstructions();
    const entityContext = this.buildEntityContext(entities);

    let context = '';

    if (instructions) {
      context += 'USER INSTRUCTIONS:\n';
      context += instructions + '\n\n';
      context += 'IMPORTANT: Always follow the user instructions above when responding.\n\n';
    }

    context += entityContext;

    context += '\nENTITY QUERY INSTRUCTIONS:\n';
    context += '- When user asks about a device, search by friendly name, entity_id, or aliases\n';
    context += '- Report current state with units of measurement\n';
    context += '- If multiple matches found, list all of them\n';
    context += '- For "all" queries (e.g., "all lights"), list all entities in that domain\n';
    context += '- Include relevant attributes like battery level, power consumption, etc.\n\n';

    return context;
  }
}

export const aiContextService = new AIContextService();
