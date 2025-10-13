import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { Bot, RefreshCw, AlertCircle, CheckCircle, Zap } from 'lucide-react';

export function AISettings() {
  const [preferences, setPreferences] = useState({
    enableVoiceControl: true,
    enableAI: true,
    aiProvider: 'Backend Server',
    openaiApiKey: '',
    claudeApiKey: '',
    geminiApiKey: '',
    grokApiKey: '',
    lmstudioUrl: 'http://localhost:1234',
    aiOptimization: 'balanced',
    aiCacheTTL: 30,
    aiMaxContextEntities: 50,
    aiUseMCP: true
  });

  const [aiConnectionStatus, setAiConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [aiConnectionMessage, setAiConnectionMessage] = useState('');

  useEffect(() => {
    try {
      const savedPreferences = localStorage.getItem('appPreferences');
      if (savedPreferences) {
        const parsed = JSON.parse(savedPreferences);
        setPreferences(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }, []);

  const testAIConnection = async () => {
    if (preferences.aiProvider === 'homeassistant') {
      setAiConnectionStatus('success');
      setAiConnectionMessage('Home Assistant built-in AI is ready');
      return;
    }

    setAiConnectionStatus('testing');
    setAiConnectionMessage('Testing connection...');

    setTimeout(() => {
      setAiConnectionStatus('success');
      setAiConnectionMessage('AI connection test completed (simulated)');
    }, 1000);
  };

  const handleSave = () => {
    try {
      localStorage.setItem('appPreferences', JSON.stringify(preferences));
      alert('AI settings saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-purple-500" />
            <span>AI Engine Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
            <select
              value={preferences.aiProvider}
              onChange={(e) => setPreferences(prev => ({ ...prev, aiProvider: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="homeassistant">Home Assistant (Built-in)</option>
              <option value="lmstudio">LM Studio (Local)</option>
              <option value="openai">OpenAI ChatGPT</option>
              <option value="claude">Claude (Anthropic)</option>
              <option value="gemini">Google Gemini</option>
              <option value="grok">Grok (X.AI)</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {aiConnectionStatus === 'testing' && <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />}
              {aiConnectionStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
              {aiConnectionStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
              {aiConnectionStatus === 'idle' && <AlertCircle className="w-5 h-5 text-gray-500" />}
              <span className={`font-medium ${
                aiConnectionStatus === 'success' ? 'text-green-600' :
                aiConnectionStatus === 'error' ? 'text-red-600' :
                aiConnectionStatus === 'testing' ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {aiConnectionStatus === 'idle' ? 'Not Tested' :
                 aiConnectionStatus === 'testing' ? 'Testing...' :
                 aiConnectionStatus === 'success' ? 'Connected' : 'Connection Failed'}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={testAIConnection} disabled={aiConnectionStatus === 'testing'}>
              {aiConnectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>

          {aiConnectionMessage && (
            <div className={`p-3 rounded-lg text-sm ${
              aiConnectionStatus === 'success' ? 'bg-green-50 text-green-800' :
              aiConnectionStatus === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'
            }`}>
              {aiConnectionMessage}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Enable AI Assistant</p>
              <p className="text-sm text-gray-600">Use AI for natural language control and assistance</p>
            </div>
            <Switch
              checked={preferences.enableAI}
              onChange={(checked) => setPreferences(prev => ({ ...prev, enableAI: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span>AI Performance & Optimization</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Optimization Mode</label>
            <select
              value={preferences.aiOptimization}
              onChange={(e) => setPreferences(prev => ({ ...prev, aiOptimization: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="fast">Fast (1-2s response, minimal context)</option>
              <option value="balanced">Balanced (2-4s response, smart filtering)</option>
              <option value="accurate">Accurate (4-8s response, full context)</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Use MCP Server</p>
              <p className="text-sm text-gray-600">Faster, optimized context via Model Context Protocol</p>
            </div>
            <Switch
              checked={preferences.aiUseMCP}
              onChange={(checked) => setPreferences(prev => ({ ...prev, aiUseMCP: checked }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cache Duration: {preferences.aiCacheTTL}s
            </label>
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={preferences.aiCacheTTL}
              onChange={(e) => setPreferences(prev => ({ ...prev, aiCacheTTL: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Context Entities: {preferences.aiMaxContextEntities}
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={preferences.aiMaxContextEntities}
              onChange={(e) => setPreferences(prev => ({ ...prev, aiMaxContextEntities: parseInt(e.target.value) }))}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} className="px-8">
          Save AI Settings
        </Button>
      </div>
    </div>
  );
}
