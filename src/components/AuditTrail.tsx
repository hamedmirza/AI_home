import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { auditService, ActionLog, AISuggestion, RollbackPoint } from '../services/auditService';
import { homeAssistantService } from '../services/homeAssistant';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  BarChart3,
  History,
  AlertCircle,
  Undo,
  User,
  Bot,
  Zap
} from 'lucide-react';

export function AuditTrail() {
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [rollbackPoints, setRollbackPoints] = useState<RollbackPoint[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'logs' | 'suggestions' | 'rollback' | 'stats'>('logs');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logs, suggs, rollbacks, statistics] = await Promise.all([
        auditService.getActionLogs(50),
        auditService.getSuggestions(),
        auditService.getRollbackPoints(),
        auditService.getActionStats()
      ]);

      setActionLogs(logs);
      setSuggestions(suggs);
      setRollbackPoints(rollbacks);
      setStats(statistics);

      // Auto-seed sample data if empty
      if (logs.length === 0 && suggs.length === 0 && rollbacks.length === 0) {
        await seedSampleData();
      }
    } catch (error) {
      console.error('Failed to load audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  const seedSampleData = async () => {
    try {
      // Create sample action logs
      await auditService.logAction({
        action_type: 'service_call',
        entity_id: 'light.living_room',
        service: 'light.turn_on',
        data: { brightness: 200 },
        reason: 'User manually turned on light',
        source: 'user_manual',
        before_state: 'off',
        after_state: 'on',
        success: true,
        duration_ms: 145
      });

      await auditService.logAction({
        action_type: 'automation',
        entity_id: 'switch.bedroom_fan',
        service: 'switch.turn_off',
        data: {},
        reason: 'Scheduled automation at 10 PM',
        source: 'automation',
        before_state: 'on',
        after_state: 'off',
        success: true,
        duration_ms: 98
      });

      // Create sample suggestion
      await auditService.createSuggestion({
        suggestion_type: 'optimization',
        title: 'Optimize bedroom lighting schedule',
        description: 'Your bedroom lights are often on when no motion is detected. Consider adding motion sensors or adjusting the schedule.',
        confidence: 0.85,
        impact: 'medium',
        category: 'energy',
        entities_involved: ['light.bedroom_main', 'light.bedroom_reading'],
        status: 'pending',
        data: {
          config_changes: { schedule: { on: '07:00', off: '23:00' } },
          estimated_savings: 12.5,
          source: 'usage_pattern_analysis'
        }
      });

      // Reload data to show sample entries
      await loadData();
    } catch (error) {
      console.error('Failed to seed sample data:', error);
    }
  };

  const testActionLog = async () => {
    try {
      await auditService.logAction({
        action_type: 'service_call',
        entity_id: 'light.test_light',
        service: 'light.turn_on',
        data: { brightness: 255 },
        reason: 'Test action log from Audit Trail UI',
        source: 'user_manual',
        before_state: 'off',
        after_state: 'on',
        success: true,
        duration_ms: 123
      });
      alert('Test action logged successfully!');
      loadData();
    } catch (error) {
      console.error('Failed to log test action:', error);
      alert('Failed to log test action');
    }
  };

  const testSuggestion = async () => {
    try {
      const entities = homeAssistantService.isConnected()
        ? await homeAssistantService.getEntities()
        : [];

      const suggestions = await auditService.generateSmartSuggestions(entities, actionLogs);

      if (suggestions.length > 0) {
        await auditService.createSuggestion(suggestions[0]);
        alert('Test suggestion created successfully!');
        loadData();
      } else {
        alert('No suggestions generated. Try performing some actions first.');
      }
    } catch (error) {
      console.error('Failed to create test suggestion:', error);
      alert('Failed to create test suggestion');
    }
  };

  const testRollbackPoint = async () => {
    try {
      if (actionLogs.length === 0) {
        alert('No action logs available. Create some actions first.');
        return;
      }

      setLoading(true);
      const lastLog = actionLogs[0];
      const entityStates = {
        [lastLog.entity_id]: {
          state: lastLog.before_state,
          timestamp: new Date().toISOString()
        }
      };

      await auditService.createRollbackPoint(
        lastLog.id || '',
        entityStates,
        'Test rollback point from Audit Trail UI'
      );
      await loadData();
      alert('Test rollback point created successfully!');
    } catch (error) {
      console.error('Failed to create test rollback point:', error);
      alert('Failed to create test rollback point');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai_assistant':
        return <Bot className="w-4 h-4 text-purple-500" />;
      case 'user_manual':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'automation':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'voice':
        return <Activity className="w-4 h-4 text-green-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const renderActionLogs = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Action Logs</h3>
        <Button onClick={testActionLog} size="sm" variant="outline">
          <Activity className="w-4 h-4 mr-2" />
          Test Log Action
        </Button>
      </div>

      {actionLogs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No action logs yet. Actions will appear here as they occur.</p>
            <Button onClick={testActionLog} className="mt-4">
              Create Test Log
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {actionLogs.map((log) => (
            <Card key={log.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getSourceIcon(log.source)}
                      <span className="font-medium text-gray-900">{log.entity_id}</span>
                      {log.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Action:</span> {log.action_type}
                      </div>
                      <div>
                        <span className="font-medium">Source:</span> {log.source}
                      </div>
                      {log.service && (
                        <div>
                          <span className="font-medium">Service:</span> {log.service}
                        </div>
                      )}
                      {log.before_state && (
                        <div>
                          <span className="font-medium">State:</span> {log.before_state} → {log.after_state}
                        </div>
                      )}
                      {log.duration_ms && (
                        <div>
                          <span className="font-medium">Duration:</span> {log.duration_ms}ms
                        </div>
                      )}
                    </div>
                    {log.reason && (
                      <div className="mt-2 text-sm text-gray-700 italic">
                        Reason: {log.reason}
                      </div>
                    )}
                    {log.error_message && (
                      <div className="mt-2 text-sm text-red-600">
                        Error: {log.error_message}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatTimestamp(log.created_at)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderSuggestions = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">AI Suggestions</h3>
        <Button onClick={testSuggestion} size="sm" variant="outline">
          <TrendingUp className="w-4 h-4 mr-2" />
          Generate Test Suggestion
        </Button>
      </div>

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No AI suggestions yet. Use your home system to generate insights.</p>
            <Button onClick={testSuggestion} className="mt-4">
              Generate Test Suggestion
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="border-l-4" style={{
              borderLeftColor:
                suggestion.impact === 'high' ? '#ef4444' :
                suggestion.impact === 'medium' ? '#f59e0b' : '#10b981'
            }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">{suggestion.title}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        suggestion.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        suggestion.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                        suggestion.status === 'implemented' ? 'bg-green-100 text-green-800' :
                        suggestion.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {suggestion.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{suggestion.description}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Type:</span> {suggestion.suggestion_type}
                      </div>
                      <div>
                        <span className="font-medium">Impact:</span> {suggestion.impact}
                      </div>
                      <div>
                        <span className="font-medium">Confidence:</span> {(suggestion.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                    {suggestion.entities_involved.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-medium">Entities:</span> {suggestion.entities_involved.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {formatTimestamp(suggestion.created_at)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderRollbackPoints = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Rollback Points</h3>
        <Button onClick={testRollbackPoint} size="sm" variant="outline">
          <Undo className="w-4 h-4 mr-2" />
          Create Test Rollback
        </Button>
      </div>

      {rollbackPoints.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No rollback points available. Critical actions will create restore points.</p>
            <Button onClick={testRollbackPoint} className="mt-4">
              Create Test Rollback
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rollbackPoints.map((point) => (
            <Card key={point.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Undo className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-gray-900">{point.description}</span>
                      {point.can_rollback && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          Available
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Entity States:</span> {Object.keys(point.entity_states).length} saved
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {Object.entries(point.entity_states).map(([entityId, state]: [string, any]) => (
                        <div key={entityId}>
                          {entityId}: {state.state}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-2">
                      {formatTimestamp(point.created_at)}
                    </div>
                    {point.can_rollback && (
                      <Button size="sm" variant="outline">
                        <Undo className="w-3 h-3 mr-1" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderStats = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>

      {!stats ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading statistics...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Actions</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">{stats.successRate.toFixed(1)}%</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.avgDuration.toFixed(0)}ms</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">AI Actions</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.bySource.ai_assistant || 0}</p>
                </div>
                <Bot className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Actions by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.bySource).map(([source, count]: [string, any]) => (
                  <div key={source} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getSourceIcon(source)}
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {source.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Trail & Traces</h1>
          <p className="text-gray-600">Monitor and review all system actions, AI suggestions, and rollback points</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Phase 3: Audit & Traces Testing</h3>
            <p className="text-sm text-blue-800 mb-2">
              This feature tracks all actions performed in your smart home, generates AI suggestions based on patterns,
              and creates rollback points for critical changes.
            </p>
            <p className="text-sm font-medium text-blue-900">
              To test this feature, click the "Test" buttons in each tab to generate sample data.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'logs', label: 'Action Logs', icon: Activity },
          { id: 'suggestions', label: 'AI Suggestions', icon: TrendingUp },
          { id: 'rollback', label: 'Rollback Points', icon: Undo },
          { id: 'stats', label: 'Statistics', icon: BarChart3 }
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSelectedTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
              selectedTab === id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div>
        {selectedTab === 'logs' && renderActionLogs()}
        {selectedTab === 'suggestions' && renderSuggestions()}
        {selectedTab === 'rollback' && renderRollbackPoints()}
        {selectedTab === 'stats' && renderStats()}
      </div>
    </div>
  );
}
