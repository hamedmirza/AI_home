import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { auditService, AISuggestion } from '../services/auditService';
import { homeAssistantService } from '../services/homeAssistant';
import {
  Lightbulb, TrendingDown, Shield, Zap, Wrench,
  CheckCircle, XCircle, Clock, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronUp, Sparkles, TrendingUp
} from 'lucide-react';

interface AISuggestionsProps {
  entities: any[];
}

export function AISuggestions({ entities }: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'implemented'>('all');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, [filter]);

  const loadSuggestions = async () => {
    console.log('[AISuggestions] Loading suggestions with filter:', filter);
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const data = await auditService.getSuggestions(status);
      console.log('[AISuggestions] Loaded suggestions:', data.length, 'items');
      setSuggestions(data);
    } catch (error) {
      console.error('[AISuggestions] Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    console.log('[AISuggestions] Starting suggestion generation...');
    console.log('[AISuggestions] Available entities:', entities.length);

    setGenerating(true);
    try {
      const actionLogs = await auditService.getActionLogs(100);
      console.log('[AISuggestions] Retrieved action logs:', actionLogs.length);

      const newSuggestions = await auditService.generateSmartSuggestions(entities, actionLogs);
      console.log('[AISuggestions] Generated suggestions:', newSuggestions.length);

      for (const suggestion of newSuggestions) {
        console.log('[AISuggestions] Creating suggestion:', suggestion.title);
        await auditService.createSuggestion(suggestion);
      }

      await loadSuggestions();
      alert(`Generated ${newSuggestions.length} new suggestions!`);
    } catch (error) {
      console.error('[AISuggestions] Failed to generate suggestions:', error);
      alert('Failed to generate suggestions');
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async (id: string) => {
    await auditService.updateSuggestionStatus(id, 'accepted');
    await loadSuggestions();
  };

  const handleReject = async (id: string) => {
    await auditService.updateSuggestionStatus(id, 'rejected');
    await loadSuggestions();
  };

  const handleImplement = async (id: string) => {
    await auditService.updateSuggestionStatus(id, 'implemented');
    await loadSuggestions();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'energy': return TrendingDown;
      case 'security': return Shield;
      case 'convenience': return Zap;
      case 'maintenance': return Wrench;
      case 'comfort': return Sparkles;
      default: return Lightbulb;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-800';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </span>;
      case 'accepted':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full flex items-center gap-1">
          <ThumbsUp className="w-3 h-3" />
          Accepted
        </span>;
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full flex items-center gap-1">
          <ThumbsDown className="w-3 h-3" />
          Rejected
        </span>;
      case 'implemented':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Implemented
        </span>;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12">
      <div className="text-gray-500 dark:text-gray-400">Loading suggestions...</div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="w-7 h-7 text-yellow-500" />
            AI Suggestions
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Smart recommendations based on your usage patterns
          </p>
        </div>
        <Button onClick={generateSuggestions} disabled={generating}>
          {generating ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Analyzing...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4 mr-2" />
              Generate Suggestions
            </>
          )}
        </Button>
      </div>

      <div className="flex gap-2">
        {['all', 'pending', 'implemented'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {suggestions.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <Lightbulb className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No suggestions yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Click "Generate Suggestions" to analyze your home and get smart recommendations
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => {
            const Icon = getCategoryIcon(suggestion.category);
            const isExpanded = expandedId === suggestion.id;

            return (
              <Card key={suggestion.id} className="overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-lg ${getImpactColor(suggestion.impact)}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {suggestion.title}
                          </h3>
                          {getStatusBadge(suggestion.status)}
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-3">
                          {suggestion.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className={`px-2 py-1 rounded ${getImpactColor(suggestion.impact)}`}>
                            {suggestion.impact} impact
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {suggestion.category}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : suggestion.id || null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                      {suggestion.entities_involved.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Entities Involved:
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {suggestion.entities_involved.map((entityId) => (
                              <span
                                key={entityId}
                                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-mono"
                              >
                                {entityId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {suggestion.data && Object.keys(suggestion.data).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Details:
                          </h4>
                          <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 text-sm">
                            {Object.entries(suggestion.data).map(([key, value]) => (
                              <div key={key} className="flex justify-between py-1">
                                <span className="text-gray-600 dark:text-gray-400">{key}:</span>
                                <span className="text-gray-900 dark:text-white font-medium">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {suggestion.status === 'pending' && (
                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleAccept(suggestion.id!)}
                            variant="primary"
                            className="flex-1"
                          >
                            <ThumbsUp className="w-4 h-4 mr-2" />
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleImplement(suggestion.id!)}
                            variant="secondary"
                            className="flex-1"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Implement
                          </Button>
                          <Button
                            onClick={() => handleReject(suggestion.id!)}
                            variant="secondary"
                            className="flex-1"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
