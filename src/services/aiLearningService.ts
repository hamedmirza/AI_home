import { dbService } from './database';
import { homeAssistantService } from './homeAssistant';
import { aiContextService } from './aiContextService';
import { energyPatternService } from './energyPatternService';

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: any;
  created_at: string;
}

interface LearnedPattern {
  id: string;
  pattern_type: string;
  pattern_key: string;
  pattern_value: any;
  confidence_score: number;
  usage_count: number;
}

class AILearningService {
  private currentConversationId: string | null = null;

  private getAIConfig() {
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
      lmstudioUrl: 'http://localhost:1234',
      openaiApiKey: '',
      claudeApiKey: '',
      geminiApiKey: '',
      grokApiKey: ''
    };
  }

  async startConversation(): Promise<string> {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: user?.id || null,
        title: 'New Conversation'
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Failed to create conversation');

    this.currentConversationId = data.id;
    return data.id;
  }

  async sendMessage(content: string, conversationId?: string): Promise<string> {
    try {
      const entities = await dbService.getEntities().catch(() => []);
      const patterns = await this.getLearnedPatterns().catch(() => []);

      const context = await this.buildContext(content, entities, patterns);
      const response = await this.callAI(content, context);

      try {
        await this.extractAndLearnPatterns(content, response);
      } catch (error) {
        console.warn('Failed to extract patterns (non-critical):', error);
      }

      return response;
    } catch (error) {
      console.error('AI Learning service error:', error);
      throw error;
    }
  }

  private async callAI(userMessage: string, context: any): Promise<string> {
    try {
      const config = this.getAIConfig();
      const systemPrompt = await this.buildSystemPrompt(context);

      let response;
      let apiKey = '';

      switch (config.provider) {
        case 'openai':
          apiKey = config.openaiApiKey;
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
          apiKey = config.claudeApiKey;
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
                { role: 'user', content: `${systemPrompt}\n\n${userMessage}` }
              ]
            })
          });
          break;

        case 'gemini':
          apiKey = config.geminiApiKey;
          if (!apiKey) throw new Error('Gemini API key not configured');
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `${systemPrompt}\n\n${userMessage}`
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
          apiKey = config.grokApiKey;
          if (!apiKey) throw new Error('Grok API key not configured');
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
                { role: 'user', content: userMessage }
              ],
              temperature: 0.7,
              max_tokens: 500
            })
          });
          break;

        case 'lmstudio':
        default:
          const endpoint = `${config.lmstudioUrl}/v1/chat/completions`;
          response = await fetch(endpoint, {
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
              max_tokens: 500
            })
          });
          break;
      }

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();

      let content = '';
      switch (config.provider) {
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

      return content || 'I apologize, but I could not generate a response.';
    } catch (error) {
      console.error('AI call failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `I am having trouble connecting to the AI service: ${errorMessage}. Please check your settings.`;
    }
  }

  private async buildSystemPrompt(context: any): Promise<string> {
    const { entities, patterns, recentConversations, entityContext, energyInsights, energySuggestions } = context;

    let prompt = `You are an intelligent smart home AI assistant with advanced energy management capabilities. You help users control devices, monitor their home, and optimize energy usage to reduce costs.\n\n`;

    prompt += entityContext || '';

    if (energyInsights) {
      prompt += `\n\nEnergy Insights:`;
      prompt += `\n- Daily Average Usage: ${energyInsights.dailyAverage.toFixed(0)}W`;
      prompt += `\n- Weekly Average Usage: ${energyInsights.weeklyAverage.toFixed(0)}W`;
      prompt += `\n- Trend: ${energyInsights.trend}`;
      if (energyInsights.solarProduction > 0) {
        prompt += `\n- Solar Production: ${energyInsights.solarProduction.toFixed(0)}W`;
      }
    }

    if (energySuggestions && energySuggestions.length > 0) {
      prompt += `\n\nEnergy Saving Opportunities:`;
      energySuggestions.slice(0, 3).forEach((suggestion: any) => {
        prompt += `\n- [${suggestion.priority.toUpperCase()}] ${suggestion.title}: ${suggestion.description}`;
        if (suggestion.estimatedSavings > 0) {
          prompt += ` (Est. savings: $${suggestion.estimatedSavings.toFixed(2)}/month)`;
        }
      });
    }

    if (patterns.length > 0) {
      prompt += `\n\nLearned User Patterns:`;
      patterns.slice(0, 5).forEach((pattern: LearnedPattern) => {
        prompt += `\n- ${pattern.pattern_type}: ${pattern.pattern_key} (confidence: ${(pattern.confidence_score * 100).toFixed(0)}%)`;
      });
    }

    if (recentConversations.length > 0) {
      prompt += `\n\nRecent Context:`;
      recentConversations.slice(0, 3).forEach((msg: Message) => {
        prompt += `\n${msg.role}: ${msg.content.substring(0, 100)}`;
      });
    }

    prompt += `\n\nInstructions:
- Be helpful, friendly, and concise
- When controlling devices, mention which device you're acting on
- Learn from user corrections and preferences
- Proactively suggest energy-saving actions based on learned patterns
- Highlight cost-saving opportunities when relevant
- Use learned usage patterns to provide personalized recommendations
- Search entities by name, alias, or entity_id
- Report states with proper units
- If unsure, ask for clarification`;

    return prompt;
  }

  private async buildContext(userMessage: string, entities: any[], patterns: LearnedPattern[]) {
    const recentMessages = await this.getRecentMessages(10);
    const entityContext = await aiContextService.buildCompleteAIContext(entities);

    const relevantPatterns = patterns.filter(p =>
      userMessage.toLowerCase().includes(p.pattern_key.toLowerCase()) ||
      p.pattern_type === 'preference'
    );

    let energyInsights = null;
    let energySuggestions = null;

    try {
      const lowerMessage = userMessage.toLowerCase();
      const isEnergyQuery = lowerMessage.includes('energy') ||
        lowerMessage.includes('power') ||
        lowerMessage.includes('cost') ||
        lowerMessage.includes('save') ||
        lowerMessage.includes('usage') ||
        lowerMessage.includes('suggest');

      if (isEnergyQuery) {
        energyInsights = await energyPatternService.getEnergyInsights();
        energySuggestions = await energyPatternService.generateEnergySuggestions();
      }
    } catch (error) {
      console.warn('Failed to get energy insights:', error);
    }

    return {
      entities,
      patterns: relevantPatterns,
      recentConversations: recentMessages,
      entityContext,
      energyInsights,
      energySuggestions
    };
  }

  private async saveMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, metadata: any = {}) {
    const supabase = dbService.getClient();

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        metadata
      });

    if (error) {
      console.error('Failed to save message:', error);
    }
  }

  private async getRecentMessages(limit: number = 10): Promise<Message[]> {
    if (!this.currentConversationId) return [];

    const supabase = dbService.getClient();

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', this.currentConversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get recent messages:', error);
      return [];
    }

    return (data || []).reverse();
  }

  private async extractAndLearnPatterns(userMessage: string, assistantResponse: string) {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    const commandPatterns = this.extractCommandPatterns(userMessage);
    const preferencePatterns = this.extractPreferencePatterns(userMessage);
    const entityAliases = this.extractEntityAliases(userMessage);

    for (const pattern of commandPatterns) {
      try {
        await this.upsertLearnedPattern(
          userId,
          pattern.type,
          pattern.key,
          pattern.value,
          pattern.confidence,
          'pattern_detection',
          { detectedFrom: 'command_parsing', message: userMessage.substring(0, 100) }
        );
      } catch (error) {
        console.error('Failed to upsert pattern:', error);
      }
    }

    for (const pattern of preferencePatterns) {
      try {
        await this.upsertLearnedPattern(
          userId,
          pattern.type,
          pattern.key,
          pattern.value,
          pattern.confidence,
          'user_interaction',
          { detectedFrom: 'preference_expression', message: userMessage.substring(0, 100) }
        );
      } catch (error) {
        console.error('Failed to upsert pattern:', error);
      }
    }

    for (const pattern of entityAliases) {
      try {
        await this.upsertLearnedPattern(
          userId,
          pattern.type,
          pattern.key,
          pattern.value,
          pattern.confidence,
          'user_interaction',
          { detectedFrom: 'entity_reference', message: userMessage.substring(0, 100) }
        );
      } catch (error) {
        console.error('Failed to upsert pattern:', error);
      }
    }
  }

  private extractCommandPatterns(message: string): Array<{ type: string; key: string; value: any; confidence: number }> {
    const patterns = [];
    const lowerMessage = message.toLowerCase();

    const commonCommands = [
      { pattern: /turn (on|off) (the )?(.*)/i, action: 'toggle' },
      { pattern: /set (.*) to (\d+)/i, action: 'set_value' },
      { pattern: /dim (the )?(.*)/i, action: 'dim' },
      { pattern: /brighten (the )?(.*)/i, action: 'brighten' },
      { pattern: /(open|close) (the )?(.*)/i, action: 'cover_control' }
    ];

    for (const cmd of commonCommands) {
      const match = message.match(cmd.pattern);
      if (match) {
        patterns.push({
          type: 'command_alias',
          key: match[0].toLowerCase(),
          value: { action: cmd.action, original: match[0] },
          confidence: 0.85
        });
      }
    }

    return patterns;
  }

  private extractPreferencePatterns(message: string): Array<{ type: string; key: string; value: any; confidence: number }> {
    const patterns = [];
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('prefer') || lowerMessage.includes('like')) {
      patterns.push({
        type: 'preference',
        key: 'communication_style',
        value: { message: message },
        confidence: 0.75
      });
    }

    const timePatterns = [
      { pattern: /morning/i, time: 'morning' },
      { pattern: /evening/i, time: 'evening' },
      { pattern: /night/i, time: 'night' },
      { pattern: /bedtime/i, time: 'bedtime' }
    ];

    for (const tp of timePatterns) {
      if (tp.pattern.test(message)) {
        patterns.push({
          type: 'routine',
          key: tp.time,
          value: { context: message, mentioned_at: new Date().toISOString() },
          confidence: 0.70
        });
      }
    }

    return patterns;
  }

  private extractEntityAliases(message: string): Array<{ type: string; key: string; value: any; confidence: number }> {
    const patterns = [];

    const aliasPatterns = [
      { pattern: /bedroom light/i, alias: 'bedroom_light' },
      { pattern: /living room/i, alias: 'living_room' },
      { pattern: /front door/i, alias: 'front_door' },
      { pattern: /garage door/i, alias: 'garage_door' }
    ];

    for (const alias of aliasPatterns) {
      if (alias.pattern.test(message)) {
        patterns.push({
          type: 'entity_alias',
          key: alias.alias,
          value: { natural_name: message.match(alias.pattern)?.[0] },
          confidence: 0.90
        });
      }
    }

    return patterns;
  }

  private async upsertLearnedPattern(
    userId: string | null,
    patternType: string,
    patternKey: string,
    patternValue: any,
    confidenceScore: number,
    learningSource: 'user_interaction' | 'feedback' | 'automation' | 'pattern_detection' = 'user_interaction',
    sourceMetadata: any = {}
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
          learning_source: learningSource,
          source_metadata: sourceMetadata
        });
    }
  }

  async getLearnedPatterns(minConfidence: number = 0.5): Promise<LearnedPattern[]> {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    let query = supabase
      .from('learned_patterns')
      .select('*')
      .gte('confidence_score', minConfidence)
      .order('usage_count', { ascending: false })
      .limit(50);

    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get learned patterns:', error);
      return [];
    }

    return data || [];
  }

  async correctResponse(messageId: string, correctedResponse: string, correctionType: string) {
    const supabase = dbService.getClient();

    const { data: message } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (!message) return;

    await supabase
      .from('user_corrections')
      .insert({
        message_id: messageId,
        original_response: message.content,
        corrected_response: correctedResponse,
        correction_type: correctionType
      });

    if (correctionType === 'entity_name') {
      const { data: { user } } = await supabase.auth.getUser();
      await this.upsertLearnedPattern(
        user?.id || null,
        'correction',
        'entity_reference',
        {
          original: message.content,
          corrected: correctedResponse
        },
        0.9,
        'feedback',
        { correctionType, timestamp: new Date().toISOString() }
      );
    }
  }

  async getConversationHistory(conversationId: string): Promise<Message[]> {
    const supabase = dbService.getClient();

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }

    return data || [];
  }

  async listConversations(limit: number = 20) {
    try {
      const supabase = dbService.getClient();

      const { data, error } = await supabase
        .from('chat_messages')
        .select('session_id, created_at, content')
        .order('created_at', { ascending: false })
        .limit(limit * 2);

      if (error) {
        console.error('Failed to list conversations:', error);
        return [];
      }

      const sessionMap = new Map<string, any>();

      data?.forEach(msg => {
        if (!sessionMap.has(msg.session_id)) {
          sessionMap.set(msg.session_id, {
            id: msg.session_id,
            title: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : ''),
            updated_at: msg.created_at,
            created_at: msg.created_at
          });
        }
      });

      return Array.from(sessionMap.values()).slice(0, limit);
    } catch (error) {
      console.error('Failed to list conversations:', error);
      return [];
    }
  }

  private async updateConversationTitle(conversationId: string, firstMessage: string) {
    const supabase = dbService.getClient();

    const { data: conversation } = await supabase
      .from('conversations')
      .select('title')
      .eq('id', conversationId)
      .single();

    if (conversation && conversation.title === 'New Conversation') {
      const title = firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');

      await supabase
        .from('conversations')
        .update({ title })
        .eq('id', conversationId);
    }
  }

  async getPatternInsights() {
    const supabase = dbService.getClient();

    const { data: patterns } = await supabase
      .from('learned_patterns')
      .select('*')
      .order('usage_count', { ascending: false });

    const allPatterns = patterns || [];

    const insights = {
      totalPatterns: allPatterns.length,
      byType: {} as { [key: string]: number },
      bySource: {} as { [key: string]: { count: number; avgConfidence: number } },
      topPatterns: allPatterns.slice(0, 10),
      averageConfidence: 0
    };

    const sourceStats: { [key: string]: { total: number; confidence: number } } = {};

    allPatterns.forEach(p => {
      insights.byType[p.pattern_type] = (insights.byType[p.pattern_type] || 0) + 1;

      const source = p.learning_source || 'user_interaction';
      if (!sourceStats[source]) {
        sourceStats[source] = { total: 0, confidence: 0 };
      }
      sourceStats[source].total++;

      const usageBoost = Math.min(0.3, p.usage_count * 0.02);
      const adjustedConfidence = Math.min(1.0, p.confidence_score + usageBoost);
      sourceStats[source].confidence += adjustedConfidence;
    });

    Object.entries(sourceStats).forEach(([source, stats]) => {
      insights.bySource[source] = {
        count: stats.total,
        avgConfidence: stats.confidence / stats.total
      };
    });

    if (allPatterns.length > 0) {
      const totalConfidence = allPatterns.reduce((sum, p) => {
        const usageBoost = Math.min(0.3, p.usage_count * 0.02);
        const adjustedConfidence = Math.min(1.0, p.confidence_score + usageBoost);
        return sum + adjustedConfidence;
      }, 0);
      insights.averageConfidence = totalConfidence / allPatterns.length;
    }

    return insights;
  }

  async getFeedbackInsights() {
    const supabase = dbService.getClient();

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id, content, role, metadata, created_at')
      .eq('role', 'assistant')
      .not('metadata->feedback', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!messages || messages.length === 0) {
      return {
        totalFeedback: 0,
        positiveCount: 0,
        negativeCount: 0,
        positivePct: 0,
        recentFeedback: []
      };
    }

    const positiveCount = messages.filter(m => m.metadata?.feedback === 'up').length;
    const negativeCount = messages.filter(m => m.metadata?.feedback === 'down').length;

    return {
      totalFeedback: messages.length,
      positiveCount,
      negativeCount,
      positivePct: messages.length > 0 ? (positiveCount / messages.length) * 100 : 0,
      recentFeedback: messages.slice(0, 10).map(m => ({
        id: m.id,
        content: m.content.substring(0, 100),
        feedback: m.metadata?.feedback,
        timestamp: m.created_at
      }))
    };
  }

  async learnFromFeedback() {
    const supabase = dbService.getClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: negativeFeedback } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('role', 'assistant')
      .eq('metadata->feedback', 'down')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!negativeFeedback || negativeFeedback.length === 0) return;

    for (const msg of negativeFeedback) {
      try {
        const content = msg.content.toLowerCase();

        if (content.includes('wrong') || content.includes('incorrect')) {
          await this.upsertLearnedPattern(
            user?.id || null,
            'correction',
            'response_issue',
            { content: msg.content, timestamp: msg.created_at },
            0.3,
            'feedback',
            { feedbackType: 'negative', reason: 'incorrect_response' }
          );
        }

        if (content.includes('device') || content.includes('entity')) {
          await this.upsertLearnedPattern(
            user?.id || null,
            'entity_issue',
            'needs_clarification',
            { content: msg.content, timestamp: msg.created_at },
            0.4,
            'feedback',
            { feedbackType: 'negative', reason: 'entity_confusion' }
          );
        }
      } catch (error) {
        console.error('Error learning from feedback:', error);
      }
    }
  }
}

export const aiLearningService = new AILearningService();
