import { mcpService } from './mcpService';
import { dbService } from './database';
import { aiContextService } from './aiContextService';
import { energyPatternService } from './energyPatternService';

interface AIConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'grok' | 'lmstudio';
  lmstudioUrl?: string;
  openaiApiKey?: string;
  claudeApiKey?: string;
  geminiApiKey?: string;
  grokApiKey?: string;
}

interface AIResponse {
  text: string;
  actions?: Array<{
    type: 'call_service' | 'query';
    domain?: string;
    service?: string;
    entity_id?: string;
    data?: Record<string, unknown>;
  }>;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  provider: string;
}

interface LearnedPattern {
  id: string;
  pattern_type: string;
  pattern_key: string;
  pattern_value: any;
  confidence_score: number;
  usage_count: number;
}

class UnifiedAIService {
  private getAIConfig(): AIConfig {
    try {
      const savedPreferences = localStorage.getItem('appPreferences');
      if (savedPreferences) {
        const prefs = JSON.parse(savedPreferences);
        return {
          provider: prefs.aiProvider || 'lmstudio',
          lmstudioUrl: prefs.lmstudioUrl || 'http://localhost:1234',
          openaiApiKey: prefs.openaiApiKey || '',
          claudeApiKey: prefs.claudeApiKey || '',
          geminiApiKey: prefs.geminiApiKey || '',
          grokApiKey: prefs.grokApiKey || ''
        };
      }
    } catch (error) {
      console.error('Failed to get AI config:', error);
    }
    return {
      provider: 'lmstudio',
      lmstudioUrl: 'http://localhost:1234'
    };
  }

  async processCommand(userMessage: string): Promise<AIResponse> {
    console.log('[UnifiedAI] Processing command:', userMessage);

    try {
      // Get entities and context via MCP
      const mcpStart = performance.now();
      const entities = await mcpService.getEntities();
      const mcpEntitiesTime = performance.now() - mcpStart;
      console.log(`[UnifiedAI] ✓ MCP getEntities: ${mcpEntitiesTime.toFixed(0)}ms`);

      const contextStart = performance.now();
      const aiContext = await mcpService.getAIContext();
      const mcpContextTime = performance.now() - contextStart;
      console.log(`[UnifiedAI] ✓ MCP getAIContext: ${mcpContextTime.toFixed(0)}ms`);

      const patternsStart = performance.now();
      const learnedPatterns = await this.getLearnedPatterns();
      const patternsTime = performance.now() - patternsStart;
      console.log(`[UnifiedAI] ✓ Get learned patterns: ${patternsTime.toFixed(0)}ms`);

      // Build enhanced context
      const context = await this.buildContext(userMessage, entities, aiContext, learnedPatterns);
      console.log(`[UnifiedAI] ✓ Total MCP+DB time: ${(mcpEntitiesTime + mcpContextTime + patternsTime).toFixed(0)}ms`);

      // Get AI response with structured action format
      const aiStart = performance.now();
      const aiResponse = await this.callAI(userMessage, context);
      const aiTime = performance.now() - aiStart;
      console.log(`[UnifiedAI] ✓ AI provider response: ${aiTime.toFixed(0)}ms`);

      // Parse and execute actions if any
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        console.log('[UnifiedAI] Executing', aiResponse.actions.length, 'actions');

        for (const action of aiResponse.actions) {
          if (action.type === 'call_service' && action.domain && action.service) {
            try {
              console.log('[UnifiedAI] Executing action:', action);
              await mcpService.callService({
                domain: action.domain,
                service: action.service,
                entity_id: action.entity_id,
                data: action.data
              });
            } catch (error) {
              console.error('[UnifiedAI] Action failed:', error);
              aiResponse.text += `\n\n⚠️ Failed to ${action.service} ${action.entity_id}: ${error}`;
            }
          }
        }
      }

      // Learn from interaction
      await this.learnFromInteraction(userMessage, aiResponse);

      return aiResponse;
    } catch (error) {
      console.error('[UnifiedAI] Error processing command:', error);
      return {
        text: `I'm having trouble processing that request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider: this.getAIConfig().provider
      };
    }
  }

  private async buildContext(
    userMessage: string,
    entities: any,
    aiContext: any,
    patterns: LearnedPattern[]
  ): Promise<any> {
    const entityList = Array.isArray(entities) ? entities : [];
    const smartContext = await aiContextService.buildSmartAIContext(entityList, userMessage);

    // Get relevant patterns
    const relevantPatterns = patterns.filter(p =>
      userMessage.toLowerCase().includes(p.pattern_key.toLowerCase()) ||
      p.pattern_type === 'preference' ||
      p.pattern_type === 'entity_alias'
    );

    // Get energy insights if relevant
    let energyInsights = null;
    let energySuggestions = null;

    const lowerMessage = userMessage.toLowerCase();
    const isEnergyQuery = lowerMessage.includes('energy') ||
      lowerMessage.includes('power') ||
      lowerMessage.includes('cost') ||
      lowerMessage.includes('save') ||
      lowerMessage.includes('usage');

    if (isEnergyQuery) {
      try {
        energyInsights = await energyPatternService.getEnergyInsights();
        energySuggestions = await energyPatternService.generateEnergySuggestions();
      } catch (error) {
        console.warn('[UnifiedAI] Failed to get energy insights:', error);
      }
    }

    return {
      entities: entityList,
      aiContext,
      patterns: relevantPatterns,
      smartContext,
      energyInsights,
      energySuggestions
    };
  }

  private async callAI(userMessage: string, context: any): Promise<AIResponse> {
    const config = this.getAIConfig();
    const systemPrompt = this.buildSystemPrompt(context);

    console.log('[UnifiedAI] Calling AI with provider:', config.provider);
    console.log('[UnifiedAI] System prompt length:', systemPrompt.length);

    try {
      let response;
      let apiKey = '';

      switch (config.provider) {
        case 'openai':
          apiKey = config.openaiApiKey || '';
          if (!apiKey) throw new Error('OpenAI API key not configured');
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
                { role: 'user', content: userMessage }
              ],
              temperature: 0.7,
              max_tokens: 500
            })
          });
          break;

        case 'claude':
          apiKey = config.claudeApiKey || '';
          if (!apiKey) throw new Error('Claude API key not configured');
          response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 500,
              messages: [
                { role: 'user', content: `${systemPrompt}\n\nUser: ${userMessage}` }
              ]
            })
          });
          break;

        case 'gemini':
          apiKey = config.geminiApiKey || '';
          if (!apiKey) throw new Error('Gemini API key not configured');
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `${systemPrompt}\n\nUser: ${userMessage}`
                }]
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 500
              }
            })
          });
          break;

        case 'grok':
          apiKey = config.grokApiKey || '';
          if (!apiKey) throw new Error('Grok API key not configured');
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
                { role: 'user', content: userMessage }
              ],
              temperature: 0.7,
              max_tokens: 500
            })
          });
          break;

        case 'lmstudio':
        default:
          const lmUrl = config.lmstudioUrl || 'http://localhost:1234';
          response = await fetch(`${lmUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
              ],
              temperature: 0.7,
              max_tokens: 500,
              repeat_penalty: 1.1,
              top_p: 0.9
            }),
            signal: AbortSignal.timeout(30000)
          });
          break;
      }

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseAIResponse(data, config.provider);
    } catch (error) {
      console.error('[UnifiedAI] AI call failed:', error);
      throw error;
    }
  }

  private buildSystemPrompt(context: any): string {
    const { entities, aiContext, patterns, smartContext, energyInsights, energySuggestions } = context;

    let prompt = `You are an intelligent Home Assistant AI with action capabilities.

${smartContext || ''}

IMPORTANT - ACTION FORMAT:
When you need to control a device, respond with this exact format:
ACTION: domain.service entity_id

Examples:
- "Turning on the light. ACTION: light.turn_on light.upstairs_6"
- "Setting temperature. ACTION: climate.set_temperature climate.bedroom {temperature: 22}"

For queries (no action needed), just respond naturally.
`;

    if (aiContext) {
      const summary = aiContext.summary || {};
      prompt += `\nSYSTEM: ${summary.total_entities || 0} entities`;

      if (aiContext.capabilities) {
        const caps = [];
        if (aiContext.capabilities.has_solar) caps.push('solar');
        if (aiContext.capabilities.has_battery) caps.push('battery');
        if (aiContext.capabilities.has_climate_control) caps.push('climate');
        if (caps.length > 0) prompt += ` | Features: ${caps.join(', ')}`;
      }
    }

    if (energyInsights) {
      prompt += `\n\nENERGY:`;
      prompt += `\n- Daily avg: ${energyInsights.dailyAverage.toFixed(0)}W`;
      prompt += `\n- Trend: ${energyInsights.trend}`;
      if (energyInsights.solarProduction > 0) {
        prompt += `\n- Solar: ${energyInsights.solarProduction.toFixed(0)}W`;
      }
    }

    if (energySuggestions && energySuggestions.length > 0) {
      prompt += `\n\nSUGGESTIONS:`;
      energySuggestions.slice(0, 2).forEach((s: any) => {
        prompt += `\n- ${s.title}: ${s.description}`;
      });
    }

    if (patterns.length > 0) {
      prompt += `\n\nLEARNED PATTERNS:`;
      patterns.slice(0, 5).forEach((p: LearnedPattern) => {
        if (p.pattern_type === 'entity_alias') {
          prompt += `\n- User calls "${p.pattern_value.natural_name}" → ${p.pattern_key}`;
        } else {
          prompt += `\n- ${p.pattern_type}: ${p.pattern_key}`;
        }
      });
    }

    prompt += `\n\nRULES:
1. Search entities by friendly_name OR entity_id
2. For multi-word names like "upstairs light 6", match EXACTLY to the entity
3. Include ACTION: line ONLY when controlling devices
4. Be helpful and concise`;

    return prompt;
  }

  private parseAIResponse(data: any, provider: string): AIResponse {
    let text = '';
    let tokenUsage;

    switch (provider) {
      case 'openai':
      case 'grok':
      case 'lmstudio':
        text = data.choices[0]?.message?.content || '';
        if (data.usage) {
          tokenUsage = {
            inputTokens: data.usage.prompt_tokens || 0,
            outputTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0
          };
        }
        break;
      case 'claude':
        text = data.content[0]?.text || '';
        if (data.usage) {
          tokenUsage = {
            inputTokens: data.usage.input_tokens || 0,
            outputTokens: data.usage.output_tokens || 0,
            totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
          };
        }
        break;
      case 'gemini':
        text = data.candidates[0]?.content?.parts[0]?.text || '';
        if (data.usageMetadata) {
          tokenUsage = {
            inputTokens: data.usageMetadata.promptTokenCount || 0,
            outputTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0
          };
        }
        break;
    }

    // Parse ACTION: commands from response
    const actions: AIResponse['actions'] = [];
    const actionRegex = /ACTION:\s+(\w+)\.(\w+)\s+([\w.]+)(?:\s+(\{[^}]+\}))?/gi;
    let match;

    while ((match = actionRegex.exec(text)) !== null) {
      const [, domain, service, entity_id, dataStr] = match;
      let data;

      if (dataStr) {
        try {
          data = JSON.parse(dataStr);
        } catch (e) {
          console.warn('[UnifiedAI] Failed to parse action data:', dataStr);
        }
      }

      actions.push({
        type: 'call_service',
        domain,
        service,
        entity_id,
        data
      });
    }

    // Remove ACTION: lines from user-facing text
    text = text.replace(actionRegex, '').trim();

    return {
      text: text || 'I apologize, but I could not generate a response.',
      actions,
      tokenUsage,
      provider
    };
  }

  private async learnFromInteraction(userMessage: string, aiResponse: AIResponse) {
    try {
      const supabase = dbService.getClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      // Extract entity references
      if (aiResponse.actions && aiResponse.actions.length > 0) {
        for (const action of aiResponse.actions) {
          if (action.entity_id) {
            // Learn entity aliases
            const words = userMessage.toLowerCase().split(/\s+/);
            const entityPart = action.entity_id.split('.')[1];

            for (let i = 0; i < words.length - 1; i++) {
              const twoWords = `${words[i]} ${words[i + 1]}`;
              const threeWords = i < words.length - 2 ? `${words[i]} ${words[i + 1]} ${words[i + 2]}` : '';

              if (entityPart.includes(words[i].replace(/\s+/g, '_'))) {
                await this.upsertPattern(userId, 'entity_alias', entityPart, {
                  natural_name: twoWords,
                  entity_id: action.entity_id
                }, 0.7);
              }

              if (threeWords && entityPart.includes(threeWords.replace(/\s+/g, '_'))) {
                await this.upsertPattern(userId, 'entity_alias', entityPart, {
                  natural_name: threeWords,
                  entity_id: action.entity_id
                }, 0.8);
              }
            }
          }
        }
      }

      // Extract command patterns
      const commandPatterns = [
        { regex: /turn (on|off) (.+)/i, type: 'device_control' },
        { regex: /set (.+) to (\d+)/i, type: 'value_set' },
        { regex: /(open|close) (.+)/i, type: 'cover_control' }
      ];

      for (const pattern of commandPatterns) {
        const match = userMessage.match(pattern.regex);
        if (match) {
          await this.upsertPattern(userId, 'command_pattern', match[0].toLowerCase(), {
            type: pattern.type,
            original: match[0]
          }, 0.6);
        }
      }
    } catch (error) {
      console.error('[UnifiedAI] Failed to learn from interaction:', error);
    }
  }

  private async upsertPattern(
    userId: string | null,
    patternType: string,
    patternKey: string,
    patternValue: any,
    confidenceScore: number
  ) {
    const supabase = dbService.getClient();

    let query = supabase
      .from('learned_patterns')
      .select('*')
      .eq('pattern_type', patternType)
      .eq('pattern_key', patternKey);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const usageCount = existing.usage_count + 1;
      const confidenceIncrease = usageCount < 5 ? 0.1 : usageCount < 10 ? 0.05 : 0.02;
      const newConfidence = Math.min(1.0, existing.confidence_score + confidenceIncrease);

      await supabase
        .from('learned_patterns')
        .update({
          pattern_value: patternValue,
          confidence_score: newConfidence,
          usage_count: usageCount,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('learned_patterns')
        .insert({
          user_id: userId,
          pattern_type: patternType,
          pattern_key: patternKey,
          pattern_value: patternValue,
          confidence_score: confidenceScore,
          usage_count: 1,
          learning_source: 'user_interaction',
          source_metadata: { timestamp: new Date().toISOString() }
        });
    }
  }

  private async getLearnedPatterns(minConfidence: number = 0.5): Promise<LearnedPattern[]> {
    try {
      const supabase = dbService.getClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      let query = supabase
        .from('learned_patterns')
        .select('*')
        .gte('confidence_score', minConfidence)
        .order('usage_count', { ascending: false })
        .limit(20);

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.is('user_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[UnifiedAI] Failed to get learned patterns:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[UnifiedAI] Error getting patterns:', error);
      return [];
    }
  }
}

export const unifiedAIService = new UnifiedAIService();
export default unifiedAIService;
