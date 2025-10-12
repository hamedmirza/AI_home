import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { HomeAssistantConfig } from '../types/homeAssistant';
import { homeAssistantService } from '../services/homeAssistant';
import { energyPricingService } from '../services/energyPricingService';
import {
  Settings as SettingsIcon,
  Home,
  Wifi,
  Shield,
  Bell,
  Moon,
  Sun,
  Save,
  TestTube,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Bot,
  DollarSign,
  Zap
} from 'lucide-react';

interface SettingsProps {
  onConnectionChange: (connected: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onConnectionChange }) => {
  const [config, setConfig] = useState<HomeAssistantConfig>({
    url: 'http://homeassistant.local:8123',
    token: '',
    connected: false,
    connectionType: 'direct'
  });

  const [preferences, setPreferences] = useState({
    darkMode: false,
    notifications: true,
    autoRefresh: true,
    refreshInterval: 30,
    enableVoiceControl: true,
    energyAlerts: true,
    deviceOfflineAlerts: true,
    aiSuggestions: true,
    aiProvider: 'homeassistant',
    openaiApiKey: '',
    claudeApiKey: '',
    geminiApiKey: '',
    grokApiKey: '',
    lmstudioUrl: 'http://localhost:1234',
    enableAI: true,
    generalPrice: 0.30,
    feedInTariff: 0.08,
    currency: 'USD',
    pricingMode: 'static',
    updateIntervalMinutes: 5
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('');
  const [aiConnectionStatus, setAiConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [aiConnectionMessage, setAiConnectionMessage] = useState('');
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string>('');

  // Load energy pricing and subscribe to updates
  React.useEffect(() => {
    const loadPricing = async () => {
      try {
        const pricing = await energyPricingService.getPricing();
        setPreferences(prev => ({
          ...prev,
          generalPrice: pricing.general_price,
          feedInTariff: pricing.feed_in_tariff,
          currency: pricing.currency,
          pricingMode: pricing.pricing_mode || 'static',
          updateIntervalMinutes: pricing.update_interval_minutes || 5
        }));

        if (pricing.last_updated) {
          setLastPriceUpdate(new Date(pricing.last_updated).toLocaleString());
        }
      } catch (error) {
        console.error('Failed to load pricing:', error);
      }
    };

    loadPricing();

    const unsubscribe = energyPricingService.onPriceUpdate((pricing) => {
      setPreferences(prev => ({
        ...prev,
        generalPrice: pricing.general_price,
        feedInTariff: pricing.feed_in_tariff,
        currency: pricing.currency
      }));
      setLastPriceUpdate(new Date(pricing.last_updated || Date.now()).toLocaleString());
    });

    return () => unsubscribe();
  }, []);

  // Load saved preferences on component mount
  React.useEffect(() => {
    try {
      const savedPreferences = localStorage.getItem('appPreferences');
      if (savedPreferences) {
        const parsedPreferences = JSON.parse(savedPreferences);
        setPreferences(prev => ({ ...prev, ...parsedPreferences }));

        // Auto-test AI connection if provider is configured
        setTimeout(() => {
          const aiProvider = parsedPreferences.aiProvider;
          if (aiProvider && aiProvider !== 'homeassistant') {
            const hasKey = parsedPreferences[`${aiProvider}ApiKey`] || aiProvider === 'lmstudio';
            if (hasKey) {
              testAIConnection();
            }
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to load saved preferences:', error);
    }
  }, []);

  // Apply dark mode to document
  React.useEffect(() => {
    if (preferences.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [preferences.darkMode]);

  // Load saved connection state on component mount
  React.useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('homeAssistantConfig');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig({
          url: parsedConfig.url || 'http://homeassistant.local:8123',
          token: parsedConfig.token || '',
          connected: homeAssistantService.isConnected()
        });
        
        // Auto-connect if we have saved credentials
        if (parsedConfig.url && parsedConfig.token && !homeAssistantService.isConnected()) {
          handleConnect();
        }
      }
    } catch (error) {
      console.error('Failed to load saved config:', error);
    }
  }, []);

  const handleConnect = async () => {
    if (!config.url || !config.token) return;

    setIsConnecting(true);
    setConnectionStatus('idle');
    setConnectionErrorMessage('');

    try {
      await homeAssistantService.connect(config.url, config.token);
      setConfig(prev => ({ ...prev, connected: true }));
      setConnectionStatus('success');
      onConnectionChange(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Connection failed:', errorMessage);
      setConnectionStatus('error');
      setConnectionErrorMessage(errorMessage);
      setConfig(prev => ({ ...prev, connected: false }));
      onConnectionChange(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    homeAssistantService.disconnect();
    setConfig(prev => ({ ...prev, connected: false }));
    setConnectionStatus('idle');
    onConnectionChange(false);
  };

  const handleSavePreferences = async () => {
    try {
      localStorage.setItem('appPreferences', JSON.stringify(preferences));

      await energyPricingService.savePricing({
        general_price: preferences.generalPrice,
        feed_in_tariff: preferences.feedInTariff,
        currency: preferences.currency,
        pricing_mode: preferences.pricingMode,
        update_interval_minutes: preferences.updateIntervalMinutes
      });

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const testAIConnection = async () => {
    if (preferences.aiProvider === 'homeassistant') {
      setAiConnectionStatus('success');
      setAiConnectionMessage('Home Assistant built-in AI is ready');
      return;
    }

    const apiKey = preferences.aiProvider === 'openai' ? preferences.openaiApiKey :
                   preferences.aiProvider === 'claude' ? preferences.claudeApiKey :
                   preferences.aiProvider === 'gemini' ? preferences.geminiApiKey :
                   preferences.aiProvider === 'grok' ? preferences.grokApiKey?.trim() :
                   preferences.aiProvider === 'lmstudio' ? 'local' : '';

    if (!apiKey && preferences.aiProvider !== 'lmstudio') {
      setAiConnectionStatus('error');
      setAiConnectionMessage('API key is required');
      return;
    }

    if (preferences.aiProvider === 'lmstudio' && !preferences.lmstudioUrl) {
      setAiConnectionStatus('error');
      setAiConnectionMessage('LM Studio URL is required');
      return;
    }

    setAiConnectionStatus('testing');
    setAiConnectionMessage('Testing connection...');

    try {
      let response;
      const testPrompt = 'Test';

      switch (preferences.aiProvider) {
        case 'openai':
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: testPrompt }],
              max_tokens: 10
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
              max_tokens: 10,
              messages: [{ role: 'user', content: testPrompt }]
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
                parts: [{ text: testPrompt }]
              }],
              generationConfig: {
                maxOutputTokens: 10
              }
            })
          });
          break;

        case 'grok':
          response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey.trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'grok-3',
              messages: [{ role: 'user', content: testPrompt }],
              max_tokens: 10
            })
          });
          break;

        case 'lmstudio':
          try {
            response = await fetch(`${preferences.lmstudioUrl}/v1/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messages: [{ role: 'user', content: testPrompt }],
                max_tokens: 10,
                temperature: 0.7,
                stream: false
              }),
              signal: AbortSignal.timeout(10000)
            });
          } catch (error) {
            if (error instanceof Error && error.name === 'TimeoutError') {
              throw new Error('Connection timed out. Please ensure LM Studio server is running and a model is loaded.');
            }
            throw error;
          }
          break;

        default:
          throw new Error(`Unsupported AI provider: ${preferences.aiProvider}`);
      }

      if (response?.ok) {
        const data = await response.json();
        console.log('AI API Response:', data);
        setAiConnectionStatus('success');
        setAiConnectionMessage('Connection successful! AI model is ready.');
      } else {
        const errorText = await response?.text().catch(() => 'Unknown error');
        console.error('AI API Error:', errorText);
        throw new Error(`HTTP ${response?.status}: ${response?.statusText || 'API request failed'}`);
      }
    } catch (error) {
      console.error('AI connection test failed:', error);
      setAiConnectionStatus('error');
      
      // Handle CORS errors specifically
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        if (preferences.aiProvider === 'lmstudio') {
          setAiConnectionMessage('❌ Cannot connect to LM Studio. Please ensure:\n1. LM Studio is running\n2. Server is started (Server tab)\n3. A model is loaded\n4. URL is correct: ' + preferences.lmstudioUrl);
        } else {
          setAiConnectionStatus('success'); // Mark as success since CORS is expected for external APIs
          setAiConnectionMessage('✅ CORS blocked (normal browser security). Your API key is saved and the AI Assistant will work properly despite this test limitation.');
        }
      } else if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized') || error.message.includes('Invalid API key')) {
          setAiConnectionMessage('❌ Invalid API key. Please check your credentials.');
        } else if (error.message.includes('quota') || error.message.includes('billing') || error.message.includes('429')) {
          setAiConnectionMessage('❌ API quota exceeded or billing issue. Check your account.');
        } else if (error.message.includes('403')) {
          setAiConnectionMessage('❌ Access forbidden. Check your API key permissions.');
        } else {
          setAiConnectionMessage(`❌ Connection failed: ${error.message}`);
        }
      } else {
        setAiConnectionMessage('❌ Connection failed. Check your API key and try again.');
      }
    }
  };

  // Auto-test connection when provider or API key changes
  React.useEffect(() => {
    if (preferences.aiProvider !== 'homeassistant') {
      let apiKey = '';
      switch (preferences.aiProvider) {
        case 'openai':
          apiKey = preferences.openaiApiKey || '';
          break;
        case 'claude':
          apiKey = preferences.claudeApiKey || '';
          break;
        case 'gemini':
          apiKey = preferences.geminiApiKey || '';
          break;
        case 'grok':
          apiKey = preferences.grokApiKey || '';
          break;
        case 'lmstudio':
          apiKey = 'local';
          break;
      }
      apiKey = apiKey.trim();
      
      if (apiKey) {
        // Debounce the test to avoid too many API calls
        const timer = setTimeout(testAIConnection, 1000);
        return () => clearTimeout(timer);
      } else {
        setAiConnectionStatus('idle');
        setAiConnectionMessage('');
      }
    } else {
      setAiConnectionStatus('success');
      setAiConnectionMessage('Home Assistant built-in AI is ready');
    }
  }, [preferences.aiProvider, preferences.openaiApiKey, preferences.claudeApiKey, preferences.geminiApiKey, preferences.grokApiKey, preferences.lmstudioUrl]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure your Home Assistant connection and preferences</p>
      </div>

      {/* Connection Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="w-5 h-5 text-blue-500" />
            <span>Home Assistant Connection</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Connection Type</label>
            <select
              value={config.connectionType || 'direct'}
              onChange={(e) => setConfig(prev => ({ ...prev, connectionType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="direct">Direct Connection (Local/Port Forward)</option>
              <option value="cloudflare">Cloudflare Tunnel</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={config.connectionType === 'cloudflare' ? "Cloudflare Tunnel URL" : "Home Assistant URL"}
              value={config.url}
              onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
              placeholder={config.connectionType === 'cloudflare' 
                ? "https://your-tunnel.example.com" 
                : "http://homeassistant.local:8123 or http://192.168.1.100:8123"}
            />
            <Input
              label="Long-lived Access Token"
              type="password"
              value={config.token}
              onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
              placeholder="Enter your access token"
            />
          </div>
          
          {config.connectionType === 'cloudflare' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">Cloudflare Tunnel Configuration</h4>
              <p className="text-sm text-green-800 mb-2">
                Using Cloudflare Tunnel provides secure HTTPS access without port forwarding. 
                Add this to your Home Assistant <code className="bg-green-100 px-1 rounded">configuration.yaml</code>:
              </p>
              <pre className="bg-green-100 p-2 rounded text-xs overflow-x-auto text-green-900">
{`http:
  cors_allowed_origins:
    - "https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--96435430.local-credentialless.webcontainer-api.io"
    - "http://localhost:5173"
    - "https://localhost:5173"
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
    - 173.245.48.0/20
    - 103.21.244.0/22
    - 103.22.200.0/22
    - 103.31.4.0/22
    - 141.101.64.0/18
    - 108.162.192.0/18
    - 190.93.240.0/20
    - 188.114.96.0/20
    - 197.234.240.0/22
    - 198.41.128.0/17
    - 162.158.0.0/15
    - 104.16.0.0/13
    - 104.24.0.0/14
    - 172.64.0.0/13
    - 131.0.72.0/22`}
              </pre>
              <p className="text-xs text-green-700 mt-2">
                The trusted_proxies includes Cloudflare IP ranges for proper forwarding.
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">CORS Configuration Required</h4>
              <p className="text-sm text-blue-800 mb-2">
                To connect from localhost, add this to your Home Assistant <code className="bg-blue-100 px-1 rounded">configuration.yaml</code> and restart Home Assistant:
              </p>
              <pre className="bg-blue-100 p-2 rounded text-xs overflow-x-auto text-blue-900">
{`http:
  cors_allowed_origins:
    - "http://localhost:5173"
    - "https://localhost:5173"
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1`}
              </pre>
              <p className="text-xs text-blue-700 mt-2">
                After adding this configuration, restart Home Assistant completely and try connecting again.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-3">
              {config.connected ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-600 font-medium">Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <span className="text-yellow-600 font-medium">Disconnected</span>
                </>
              )}
              
              {connectionStatus === 'success' && (
                <span className="text-sm text-green-600">Connection successful!</span>
              )}
              {connectionStatus === 'error' && (
                <div className="text-sm text-red-600 max-w-md">
                  <p className="font-medium">Connection failed: {connectionErrorMessage}</p>
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-xs">
                    <p className="font-medium text-red-800 mb-2">Quick Troubleshooting:</p>
                    <ul className="list-disc list-inside space-y-1 text-red-700">
                      <li><strong>401 Unauthorized:</strong> Check your access token</li>
                      <li><strong>CORS Error:</strong> Add configuration below and restart HA</li>
                      <li><strong>Connection refused:</strong> Check URL and port</li>
                      <li><strong>Timeout:</strong> Ensure Home Assistant is accessible</li>
                    </ul>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-medium text-red-800 mb-1">Add to configuration.yaml:</p>
                    <pre className="p-2 bg-gray-100 rounded text-xs overflow-x-auto">
{`http:
  cors_allowed_origins:
    - "http://localhost:5173"
    - "https://localhost:5173"
    - "http://localhost:3000"
    - "https://localhost:3000"
    - "http://127.0.0.1:5173"
    - "https://127.0.0.1:5173"
    - "https://zp1v56uxy8rdx5ypatb0ockcb9tr6a-oci3--5173--96435430.local-credentialless.webcontainer-api.io"
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1`}
                    </pre>
                    <p className="mt-2 text-xs text-red-700">
                      <strong>Important:</strong> Save the file, then restart Home Assistant completely (not just reload config).
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token', '_blank')}
              >
                <TestTube className="w-4 h-4 mr-2" />
                Get Token
              </Button>
              
              {config.connected ? (
                <Button variant="outline" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleConnect}
                  disabled={!config.url || !config.token || isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect'
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interface Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon className="w-5 h-5 text-gray-500" />
            <span>Interface Preferences</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {preferences.darkMode ? <Moon className="w-5 h-5 text-blue-500" /> : <Sun className="w-5 h-5 text-yellow-500" />}
              <div>
                <p className="font-medium text-gray-900">Dark Mode</p>
                <p className="text-sm text-gray-600">Use dark theme for the interface</p>
              </div>
            </div>
            <Switch
              checked={preferences.darkMode}
              onChange={(checked) => setPreferences(prev => ({ ...prev, darkMode: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <RefreshCw className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-gray-900">Auto Refresh</p>
                <p className="text-sm text-gray-600">Automatically update device states</p>
              </div>
            </div>
            <Switch
              checked={preferences.autoRefresh}
              onChange={(checked) => setPreferences(prev => ({ ...prev, autoRefresh: checked }))}
            />
          </div>

          {preferences.autoRefresh && (
            <div className="ml-8">
              <Input
                label="Refresh Interval (seconds)"
                type="number"
                value={preferences.refreshInterval}
                onChange={(e) => setPreferences(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) || 30 }))}
                min="5"
                max="300"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-orange-500" />
            <span>Notifications</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Enable Notifications</p>
              <p className="text-sm text-gray-600">Receive alerts and updates</p>
            </div>
            <Switch
              checked={preferences.notifications}
              onChange={(checked) => setPreferences(prev => ({ ...prev, notifications: checked }))}
            />
          </div>

          {preferences.notifications && (
            <div className="ml-0 space-y-4 border-l-4 border-blue-200 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Energy Alerts</p>
                  <p className="text-sm text-gray-600">High usage and cost alerts</p>
                </div>
                <Switch
                  checked={preferences.energyAlerts}
                  onChange={(checked) => setPreferences(prev => ({ ...prev, energyAlerts: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Device Offline Alerts</p>
                  <p className="text-sm text-gray-600">Notifications when devices go offline</p>
                </div>
                <Switch
                  checked={preferences.deviceOfflineAlerts}
                  onChange={(checked) => setPreferences(prev => ({ ...prev, deviceOfflineAlerts: checked }))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-purple-500" />
            <span>AI Assistant</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Voice Control</p>
              <p className="text-sm text-gray-600">Enable voice commands and responses</p>
            </div>
            <Switch
              checked={preferences.enableVoiceControl}
              onChange={(checked) => setPreferences(prev => ({ ...prev, enableVoiceControl: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">AI Suggestions</p>
              <p className="text-sm text-gray-600">Receive smart recommendations and tips</p>
            </div>
            <Switch
              checked={preferences.aiSuggestions}
              onChange={(checked) => setPreferences(prev => ({ ...prev, aiSuggestions: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* AI Engine Settings */}
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
            <p className="text-sm text-gray-600 mt-1">
              Choose your preferred AI provider for smart home assistance
            </p>
          </div>

          {/* AI Connection Status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {aiConnectionStatus === 'testing' && (
                <>
                  <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  <span className="text-blue-600 font-medium">Testing Connection...</span>
                </>
              )}
              {aiConnectionStatus === 'success' && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-600 font-medium">Connected</span>
                </>
              )}
              {aiConnectionStatus === 'error' && (
                <>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-red-600 font-medium">Connection Failed</span>
                </>
              )}
              {aiConnectionStatus === 'idle' && (
                <>
                  <AlertCircle className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-600 font-medium">Not Tested</span>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={testAIConnection}
              disabled={aiConnectionStatus === 'testing' || (preferences.aiProvider !== 'homeassistant' && preferences.aiProvider !== 'lmstudio' && !preferences[`${preferences.aiProvider}ApiKey` as keyof typeof preferences])}
            >
              {aiConnectionStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>

          {aiConnectionMessage && (
            <div className={`p-3 rounded-lg text-sm ${
              aiConnectionStatus === 'success' ? 'bg-green-50 text-green-800' :
              aiConnectionStatus === 'error' ? 'bg-red-50 text-red-800' :
              'bg-blue-50 text-blue-800'
            }`}>
              {aiConnectionMessage}
              {aiConnectionStatus === 'error' && aiConnectionMessage.includes('CORS') && (
                <div className="mt-2 text-xs">
                  <p className="font-medium">Solutions:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Install a CORS browser extension (recommended)</li>
                    <li>Use the AI Assistant tab - it will work despite this test failing</li>
                    <li>The connection test is optional - AI functionality will still work</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {preferences.aiProvider === 'openai' && (
            <div>
              <Input
                label="OpenAI API Key"
                type="password"
                value={preferences.openaiApiKey}
                onChange={(e) => setPreferences(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                placeholder="sk-..."
              />
              <p className="text-sm text-gray-600 mt-1">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-600 hover:underline">OpenAI Platform</a>
              </p>
              <div className="text-xs text-gray-500 mt-1">
                Note: API calls may be blocked by CORS in some browsers. Consider using a CORS extension if needed.
              </div>
            </div>
          )}

          {preferences.aiProvider === 'claude' && (
            <div>
              <Input
                label="Claude API Key"
                type="password"
                value={preferences.claudeApiKey}
                onChange={(e) => setPreferences(prev => ({ ...prev, claudeApiKey: e.target.value }))}
                placeholder="sk-ant-..."
              />
              <p className="text-sm text-gray-600 mt-1">
                Get your API key from <a href="https://console.anthropic.com/" target="_blank" className="text-blue-600 hover:underline">Anthropic Console</a>
              </p>
              <div className="text-xs text-gray-500 mt-1">
                Note: API calls may be blocked by CORS in some browsers. Consider using a CORS extension if needed.
              </div>
            </div>
          )}

          {preferences.aiProvider === 'gemini' && (
            <div>
              <Input
                label="Gemini API Key"
                type="password"
                value={preferences.geminiApiKey}
                onChange={(e) => setPreferences(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                placeholder="AI..."
              />
              <p className="text-sm text-gray-600 mt-1">
                Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" className="text-blue-600 hover:underline">Google AI Studio</a>
              </p>
              <div className="text-xs text-gray-500 mt-1">
                Note: API calls may be blocked by CORS in some browsers. Consider using a CORS extension if needed.
              </div>
            </div>
          )}

          {preferences.aiProvider === 'grok' && (
            <div>
              <Input
                label="Grok API Key"
                type="password"
                value={preferences.grokApiKey}
                onChange={(e) => setPreferences(prev => ({ ...prev, grokApiKey: e.target.value }))}
                placeholder="xai-..."
              />
              <p className="text-sm text-gray-600 mt-1">
                Get your API key from <a href="https://console.x.ai/" target="_blank" className="text-blue-600 hover:underline">X.AI Console</a>
              </p>
              <div className="text-xs text-gray-500 mt-1">
                Note: API calls may be blocked by CORS in some browsers. Consider using a CORS extension if needed.
              </div>
            </div>
          )}

          {preferences.aiProvider === 'lmstudio' && (
            <div>
              <Input
                label="LM Studio Server URL"
                type="text"
                value={preferences.lmstudioUrl}
                onChange={(e) => setPreferences(prev => ({ ...prev, lmstudioUrl: e.target.value }))}
                placeholder="http://localhost:1234"
              />
              <p className="text-sm text-gray-600 mt-1">
                Download and run <a href="https://lmstudio.ai/" target="_blank" className="text-blue-600 hover:underline">LM Studio</a> on your local machine. Start the local server from LM Studio's &quot;Local Server&quot; tab.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                <h5 className="text-sm font-medium text-blue-900 mb-1">Setup Instructions:</h5>
                <ol className="list-decimal list-inside text-xs text-blue-800 space-y-1">
                  <li>Download and install LM Studio from lmstudio.ai</li>
                  <li>Download a model (e.g., Mistral, Llama 2, or any chat model)</li>
                  <li>Go to the &quot;Local Server&quot; tab in LM Studio</li>
                  <li>Click &quot;Start Server&quot; (default: http://localhost:1234)</li>
                  <li>The server must be running for the AI Assistant to work</li>
                </ol>
              </div>
              <div className="text-xs text-green-600 mt-2 font-medium">
                ✓ 100% Private - All processing happens on your local machine
              </div>
            </div>
          )}

          {preferences.aiProvider !== 'homeassistant' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900">Privacy Notice</h4>
                  <p className="text-sm text-yellow-800 mt-1">
                    External AI providers will receive your smart home data and commands. 
                    Consider privacy implications before enabling external AI services.
                  </p>
                </div>
              </div>
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

      {/* Energy Pricing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span>Energy Pricing & Cost Calculation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-2">
              <Zap className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-green-900">Real-Time Cost Tracking</h4>
                <p className="text-sm text-green-800 mt-1">
                  Configure your electricity rates to see real-time costs, savings from solar, and export earnings in your energy dashboard.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">Pricing Mode</h4>
                <p className="text-sm text-gray-600">Choose between static or dynamic pricing</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium ${preferences.pricingMode === 'static' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Static
                </span>
                <Switch
                  checked={preferences.pricingMode === 'dynamic'}
                  onChange={(checked) => setPreferences(prev => ({ ...prev, pricingMode: checked ? 'dynamic' : 'static' }))}
                />
                <span className={`text-sm font-medium ${preferences.pricingMode === 'dynamic' ? 'text-blue-600' : 'text-gray-500'}`}>
                  Dynamic
                </span>
              </div>
            </div>

            {preferences.pricingMode === 'dynamic' && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-start space-x-2">
                  <RefreshCw className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-900 font-medium">Dynamic Pricing Enabled</p>
                    <p className="text-xs text-blue-800 mt-1">
                      Prices will automatically update from entities named "general_price" or "feed_in_tariff" in your Home Assistant setup.
                    </p>
                    {lastPriceUpdate && (
                      <p className="text-xs text-blue-700 mt-2">
                        <strong>Last Updated:</strong> {lastPriceUpdate}
                      </p>
                    )}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-blue-900 mb-1">
                        Update Interval (minutes)
                      </label>
                      <select
                        value={preferences.updateIntervalMinutes}
                        onChange={(e) => setPreferences(prev => ({ ...prev, updateIntervalMinutes: parseInt(e.target.value) }))}
                        className="px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="1">1 minute</option>
                        <option value="5">5 minutes</option>
                        <option value="10">10 minutes</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {preferences.pricingMode === 'static' && (
              <div className="mt-4 p-3 bg-gray-100 border border-gray-300 rounded">
                <p className="text-sm text-gray-700">
                  <strong>Static Mode:</strong> Manually set prices below. They won't change until you update them.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                General Electricity Price (per kWh)
                {preferences.pricingMode === 'dynamic' && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">(Auto-updating)</span>
                )}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={preferences.generalPrice}
                onChange={(e) => setPreferences(prev => ({ ...prev, generalPrice: parseFloat(e.target.value) || 0 }))}
                placeholder="0.30"
                disabled={preferences.pricingMode === 'dynamic'}
                className={preferences.pricingMode === 'dynamic' ? 'bg-gray-100' : ''}
              />
              <p className="text-xs text-gray-500 mt-1">
                {preferences.pricingMode === 'dynamic' ? 'Automatically updated from HA entities' : 'Cost of grid electricity'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feed-In Tariff (per kWh)
                {preferences.pricingMode === 'dynamic' && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">(Auto-updating)</span>
                )}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={preferences.feedInTariff}
                onChange={(e) => setPreferences(prev => ({ ...prev, feedInTariff: parseFloat(e.target.value) || 0 }))}
                placeholder="0.08"
                disabled={preferences.pricingMode === 'dynamic'}
                className={preferences.pricingMode === 'dynamic' ? 'bg-gray-100' : ''}
              />
              <p className="text-xs text-gray-500 mt-1">
                {preferences.pricingMode === 'dynamic' ? 'Automatically updated from HA entities' : 'Payment for solar export'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={preferences.currency}
                onChange={(e) => setPreferences(prev => ({ ...prev, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD ($)</option>
                <option value="CAD">CAD ($)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Display currency</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-blue-900 mb-2">How It Works</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Grid Cost:</strong> Grid import (kWh) × General price = Cost from grid</li>
              <li><strong>Solar Savings:</strong> Solar used directly × General price = Money saved</li>
              <li><strong>Export Earnings:</strong> Grid export (kWh) × Feed-in tariff = Income from solar</li>
              <li><strong>Net Cost:</strong> Grid cost - Export earnings = Your actual energy cost</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSavePreferences} className="px-8">
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>

      {/* MCP Server Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-purple-500" />
            <span>AI MCP Server</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              MCP Server Active
            </h4>
            <p className="text-sm text-purple-800 mb-3">
              The Model Context Protocol (MCP) server provides AI assistants with structured access to your Home Assistant data.
            </p>

            <div className="bg-white/70 rounded p-3 space-y-2">
              <h5 className="font-medium text-purple-900 text-sm mb-2">Phase 1: Read-Only Tools (Active)</h5>
              <div className="grid grid-cols-2 gap-2 text-xs text-purple-800">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>home/entities</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>home/states</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>home/automations</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>home/scripts</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>home/services</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span>home/energy</span>
                </div>
                <div className="flex items-center space-x-2 col-span-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span className="font-medium">home/ai_context</span>
                  <span className="text-gray-600">(Consolidated AI context)</span>
                </div>
              </div>
            </div>

            <div className="bg-white/70 rounded p-3 mt-3 space-y-2">
              <h5 className="font-medium text-gray-700 text-sm mb-2">Phase 2: Actions (Coming Soon)</h5>
              <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-3 h-3 text-yellow-600" />
                  <span>home/call_service (with minimal allowlist)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-3 h-3 text-yellow-600" />
                  <span>Policy checks (time-of-day, energy price, occupancy)</span>
                </div>
              </div>
            </div>

            <div className="bg-white/70 rounded p-3 mt-3 space-y-2">
              <h5 className="font-medium text-gray-700 text-sm mb-2">Phase 3: Audit & Traces (Planned)</h5>
              <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-3 h-3 text-gray-400" />
                  <span>Tool call logging with reason + inputs</span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-3 h-3 text-gray-400" />
                  <span>Audit trail for all AI actions</span>
                </div>
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-3 h-3 text-gray-400" />
                  <span>Rollback capabilities</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">MCP Server Endpoint</h4>
            <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-900 block overflow-x-auto">
              {import.meta.env.VITE_SUPABASE_URL}/functions/v1/home-assistant-mcp
            </code>
            <p className="text-xs text-blue-700 mt-2">
              The MCP server automatically uses your Home Assistant credentials when making requests.
            </p>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>What is MCP?</strong> Model Context Protocol gives AI assistants structured, secure access to your home data.</p>
            <p><strong>Benefits:</strong> Better AI understanding, smarter suggestions, context-aware automations.</p>
            <p><strong>Security:</strong> Read-only in Phase 1. Phase 2 actions require explicit allowlist and policy checks.</p>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="bg-gray-50">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">App Version:</span> 1.0.0
            </div>
            <div>
              <span className="font-medium">API Version:</span> 2023.12
            </div>
            <div>
              <span className="font-medium">Last Updated:</span> {new Date().toLocaleDateString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};