import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, MessageSquare, Lightbulb, Save, Zap, DollarSign, AlertCircle, Users, Bot, ThumbsUp, Activity } from 'lucide-react';
import { aiLearningService } from '../services/aiLearningService';
import { aiContextService } from '../services/aiContextService';
import { energyPatternService } from '../services/energyPatternService';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface PatternInsights {
  totalPatterns: number;
  byType: { [key: string]: number };
  bySource: { [key: string]: { count: number; avgConfidence: number } };
  topPatterns: any[];
  averageConfidence: number;
}

interface EnergySuggestion {
  type: string;
  priority: string;
  title: string;
  description: string;
  estimatedSavings: number;
  actions: any[];
}

export function AIInsights() {
  const [insights, setInsights] = useState<PatternInsights | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [aiProvider, setAiProvider] = useState<string>('homeassistant');
  const [aiInstructions, setAiInstructions] = useState<string>('');
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [energySuggestions, setEnergySuggestions] = useState<EnergySuggestion[]>([]);
  const [energyInsights, setEnergyInsights] = useState<any>(null);

  useEffect(() => {
    loadInsights();
    loadConversations();
    loadAIProvider();
    loadAIInstructions();
    loadEnergySuggestions();
    loadEnergyInsights();
  }, []);

  const loadAIProvider = () => {
    try {
      const preferences = localStorage.getItem('appPreferences');
      if (preferences) {
        const parsed = JSON.parse(preferences);
        setAiProvider(parsed.aiProvider || 'homeassistant');
      }
    } catch (error) {
      console.error('Failed to load AI provider:', error);
    }
  };

  const loadAIInstructions = async () => {
    try {
      const instructions = await aiContextService.getAIInstructions();
      setAiInstructions(instructions);
    } catch (error) {
      console.error('Failed to load AI instructions:', error);
    }
  };

  const handleSaveInstructions = async () => {
    setIsSavingInstructions(true);
    try {
      await aiContextService.saveAIInstructions(aiInstructions);
    } catch (error) {
      console.error('Failed to save AI instructions:', error);
    } finally {
      setIsSavingInstructions(false);
    }
  };

  const loadInsights = async () => {
    try {
      const data = await aiLearningService.getPatternInsights();
      setInsights(data);
    } catch (error) {
      console.error('Failed to load insights:', error);
    }
  };

  const loadEnergySuggestions = async () => {
    try {
      const suggestions = await energyPatternService.generateEnergySuggestions();
      setEnergySuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load energy suggestions:', error);
    }
  };

  const loadEnergyInsights = async () => {
    try {
      const data = await energyPatternService.getEnergyInsights();
      setEnergyInsights(data);
    } catch (error) {
      console.error('Failed to load energy insights:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const data = await aiLearningService.listConversations(10);
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  if (!insights) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Brain className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Learning Dashboard</h1>
              <p className="text-sm text-gray-600">Monitor how your AI assistant learns from interactions</p>
            </div>
          </div>
        </div>

        <Card className="mb-6 p-6 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-blue-900 mb-1">Active AI Provider</h2>
              <p className="text-sm text-blue-800 capitalize">
                Currently using: <span className="font-semibold">{aiProvider === 'homeassistant' ? 'Home Assistant Built-in' : aiProvider === 'lmstudio' ? 'LM Studio (Local)' : aiProvider}</span>
              </p>
              <p className="text-xs text-blue-700 mt-2">
                To change AI provider or configure settings, go to Settings → AI Engine Configuration
              </p>
            </div>
          </div>
        </Card>

        <Card className="mb-6 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">AI Custom Instructions</h2>
          <p className="text-sm text-gray-600 mb-4">
            Provide custom instructions for the AI to follow when responding. These instructions will be included in every AI conversation.
          </p>
          <textarea
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
            placeholder="Example: Always be concise. When showing battery levels, alert me if below 20%. Prefer energy-saving suggestions..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={handleSaveInstructions}
              disabled={isSavingInstructions}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSavingInstructions ? 'Saving...' : 'Save Instructions'}
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Learned Patterns</p>
                <p className="text-2xl font-bold text-gray-900">{insights.totalPatterns}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Patterns extracted from your conversations
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold text-gray-900">
                  {insights.totalPatterns === 0
                    ? 'N/A'
                    : `${(insights.averageConfidence * 100).toFixed(0)}%`}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {insights.totalPatterns === 0
                ? 'Start chatting to build confidence'
                : 'AI confidence in learned patterns'}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Conversations</p>
                <p className="text-2xl font-bold text-gray-900">{conversations.length}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Total conversation sessions
            </p>
          </Card>
        </div>

        {energyInsights && energyInsights.totalSnapshots > 0 && (
          <Card className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center space-x-3 mb-4">
              <Zap className="w-6 h-6 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Energy Usage Insights</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">24h Average</p>
                <p className="text-2xl font-bold text-gray-900">{energyInsights.dailyAverage.toFixed(0)}W</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">7-Day Average</p>
                <p className="text-2xl font-bold text-gray-900">{energyInsights.weeklyAverage.toFixed(0)}W</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Trend</p>
                <p className="text-lg font-bold text-gray-900 capitalize">{energyInsights.trend}</p>
              </div>
              {energyInsights.solarProduction > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Solar Production</p>
                  <p className="text-2xl font-bold text-gray-900">{energyInsights.solarProduction.toFixed(0)}W</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {energySuggestions.length > 0 && (
          <Card className="mb-6 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <DollarSign className="w-6 h-6 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Energy Saving Suggestions</h2>
            </div>
            <div className="space-y-4">
              {energySuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    suggestion.priority === 'high'
                      ? 'bg-red-50 border-red-500'
                      : suggestion.priority === 'medium'
                      ? 'bg-orange-50 border-orange-500'
                      : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className={`w-5 h-5 ${
                        suggestion.priority === 'high'
                          ? 'text-red-600'
                          : suggestion.priority === 'medium'
                          ? 'text-orange-600'
                          : 'text-blue-600'
                      }`} />
                      <h3 className="font-semibold text-gray-900">{suggestion.title}</h3>
                    </div>
                    {suggestion.estimatedSavings > 0 && (
                      <span className="text-sm font-bold text-green-600">
                        Save ${suggestion.estimatedSavings.toFixed(2)}/mo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 ml-7">{suggestion.description}</p>
                  {suggestion.actions.length > 0 && (
                    <div className="mt-2 ml-7">
                      <p className="text-xs text-gray-600 font-medium mb-1">Suggested actions:</p>
                      <div className="space-y-1">
                        {suggestion.actions.slice(0, 3).map((action, idx) => (
                          <p key={idx} className="text-xs text-gray-600">
                            • {action.deviceId.split('.')[1]?.replace(/_/g, ' ')} - {action.action.replace(/_/g, ' ')}
                            {action.timing && ` at ${action.timing}`}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center space-x-3 mb-4">
            <Brain className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Learning Source Breakdown</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            See how the AI learns - through your conversations, feedback, automation detection, and pattern recognition
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(insights.bySource).map(([source, stats]) => {
              const icons = {
                user_interaction: <Users className="w-5 h-5" />,
                feedback: <ThumbsUp className="w-5 h-5" />,
                automation: <Zap className="w-5 h-5" />,
                pattern_detection: <Activity className="w-5 h-5" />
              };
              const colors = {
                user_interaction: 'bg-blue-100 text-blue-600',
                feedback: 'bg-green-100 text-green-600',
                automation: 'bg-orange-100 text-orange-600',
                pattern_detection: 'bg-purple-100 text-purple-600'
              };
              return (
                <div
                  key={source}
                  className="group p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all duration-200 cursor-pointer"
                  title={`${source.replace(/_/g, ' ')} - ${stats.count} patterns with ${(stats.avgConfidence * 100).toFixed(0)}% avg confidence`}
                >
                  <div className={`w-10 h-10 rounded-lg ${colors[source as keyof typeof colors] || 'bg-gray-100 text-gray-600'} flex items-center justify-center mb-2`}>
                    {icons[source as keyof typeof icons] || <Bot className="w-5 h-5" />}
                  </div>
                  <p className="text-xs text-gray-600 capitalize mb-1">{source.replace(/_/g, ' ')}</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.count}</p>
                  <div className="mt-2 flex items-center space-x-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${stats.avgConfidence * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-600">{(stats.avgConfidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
            {Object.keys(insights.bySource).length === 0 && (
              <div className="col-span-4 text-center py-8">
                <Bot className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 italic">No learning data yet. Start chatting to see how the AI learns!</p>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 hover:shadow-lg transition-shadow duration-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pattern Types</h2>
            <div className="space-y-3">
              {Object.entries(insights.byType).map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  title={`${count} ${type} patterns learned`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(insights.byType).length === 0 && (
                <p className="text-sm text-gray-500 italic">No patterns learned yet. Start chatting to build knowledge!</p>
              )}
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow duration-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Learned Patterns</h2>
            <div className="space-y-3">
              {insights.topPatterns.slice(0, 5).map((pattern, index) => {
                const sourceIcons = {
                  user_interaction: <Users className="w-3 h-3" />,
                  feedback: <ThumbsUp className="w-3 h-3" />,
                  automation: <Zap className="w-3 h-3" />,
                  pattern_detection: <Activity className="w-3 h-3" />
                };
                const sourceIcon = sourceIcons[pattern.learning_source as keyof typeof sourceIcons] || <Bot className="w-3 h-3" />;

                return (
                  <div
                    key={pattern.id}
                    className="border-l-4 border-blue-600 pl-3 py-2 hover:bg-blue-50 transition-colors duration-150 rounded-r cursor-pointer"
                    title={`Learned from: ${pattern.learning_source?.replace(/_/g, ' ') || 'user interaction'} - Used ${pattern.usage_count} times`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {pattern.pattern_key}
                        </span>
                        <span className="text-gray-400" title={pattern.learning_source || 'user_interaction'}>
                          {sourceIcon}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {pattern.usage_count} uses
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${pattern.confidence_score * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600">
                        {(pattern.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {insights.topPatterns.length === 0 && (
                <p className="text-sm text-gray-500 italic">Start conversations to see learned patterns here</p>
              )}
            </div>
          </Card>
        </div>

        <Card className="mt-6 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Conversations</h2>
          <div className="space-y-3">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{conv.title}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(conv.updated_at).toLocaleString()}
                  </p>
                </div>
                <MessageSquare className="w-5 h-5 text-gray-400" />
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="text-sm text-gray-500 italic text-center py-4">
                No conversations yet. Open the chat assistant to get started!
              </p>
            )}
          </div>
        </Card>

        <Card className="mt-6 p-6 bg-blue-50 border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">How Learning Works</h2>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Pattern Extraction:</strong> The AI identifies commands, preferences, and routines from your messages</p>
            <p>• <strong>Confidence Building:</strong> Patterns become more confident with repeated use</p>
            <p>• <strong>Corrections:</strong> You can correct AI responses to teach it the right behavior</p>
            <p>• <strong>Context Awareness:</strong> Past conversations inform future responses</p>
            <p>• <strong>AI Provider:</strong> Configure your preferred AI provider (LM Studio, OpenAI, Claude, etc.) in Settings → AI Engine Configuration</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
