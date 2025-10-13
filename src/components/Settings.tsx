import React, { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Switch } from './ui/Switch';
import { homeAssistantService } from '../services/homeAssistant';
import { energyPricingService } from '../services/energyPricingService';
import { dbService } from '../services/database';
import {
  Settings as SettingsIcon,
  Home,
  Wifi,
  Bot,
  DollarSign,
  Bell,
  Palette,
  Shield,
  ChevronRight,
  Save,
  TestTube,
  CheckCircle,
  AlertCircle,
  Zap
} from 'lucide-react';

interface SettingsProps {
  onConnectionChange: (connected: boolean) => void;
}

type SettingsPage = 'main' | 'connection' | 'ai' | 'energy' | 'notifications' | 'appearance' | 'advanced';

interface BackendConfig {
  url: string;
  token: string;
  connected: boolean;
  connectionType: 'direct' | 'backend';
}

export const Settings: React.FC<SettingsProps> = ({ onConnectionChange }) => {
  const [currentPage, setCurrentPage] = useState<SettingsPage>('main');
  const [config, setConfig] = useState<BackendConfig>({
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
    energyAlerts: true,
    deviceOfflineAlerts: true,
    aiProvider: 'Backend Server',
    openaiApiKey: '',
    claudeApiKey: '',
    geminiApiKey: '',
    grokApiKey: '',
    lmstudioUrl: 'http://localhost:1234',
    enableAI: true,
    aiUseMCP: true,
    generalPrice: 0.30,
    feedInTariff: 0.08,
    currency: 'USD',
    pricingMode: 'static' as 'static' | 'dynamic',
    updateIntervalMinutes: 5
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string>('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load Home Assistant config
      const haConfig = homeAssistantService.getConfig();
      setConfig({
        url: haConfig.url,
        token: haConfig.token,
        connected: homeAssistantService.isConnected(),
        connectionType: 'direct'
      });

      // Load preferences
      const saved = await dbService.getPreference('user_preferences');
      if (saved) {
        setPreferences(prev => ({ ...prev, ...saved }));
      }

      // Load pricing
      const pricing = await energyPricingService.getPricing();
      setPreferences(prev => ({
        ...prev,
        generalPrice: pricing.general_price,
        feedInTariff: pricing.feed_in_tariff,
        currency: pricing.currency,
        pricingMode: (pricing.pricing_mode || 'static') as 'static' | 'dynamic',
        updateIntervalMinutes: pricing.update_interval_minutes || 5
      }));

      if (pricing.last_updated) {
        setLastPriceUpdate(new Date(pricing.last_updated).toLocaleString());
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionStatus('idle');
    setConnectionMessage('');

    try {
      await homeAssistantService.connect({
        url: config.url,
        token: config.token
      });

      setConfig(prev => ({ ...prev, connected: true }));
      setConnectionStatus('success');
      setConnectionMessage('Connected successfully!');
      onConnectionChange(true);

      setTimeout(() => setConnectionStatus('idle'), 3000);
    } catch (error) {
      setConnectionStatus('error');
      setConnectionMessage(error instanceof Error ? error.message : 'Connection failed');
      onConnectionChange(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const savePreferences = async () => {
    try {
      await dbService.setPreference('user_preferences', preferences);

      // Save energy pricing
      await energyPricingService.updatePricing({
        general_price: preferences.generalPrice,
        feed_in_tariff: preferences.feedInTariff,
        currency: preferences.currency,
        pricing_mode: preferences.pricingMode,
        update_interval_minutes: preferences.updateIntervalMinutes
      });

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  const renderMainMenu = () => (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Configure your smart home system
        </p>
      </div>

      <div className="grid gap-4">
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setCurrentPage('connection')}
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Wifi className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Connection</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Home Assistant connection settings
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setCurrentPage('ai')}
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">AI Assistant</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  AI provider and API configuration
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setCurrentPage('energy')}
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Energy & Pricing</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Energy costs and pricing configuration
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setCurrentPage('notifications')}
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <Bell className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Alerts and notification preferences
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setCurrentPage('appearance')}
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center">
                <Palette className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Appearance</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Theme and display settings
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setCurrentPage('advanced')}
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Advanced</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Advanced settings and options
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </Card>
      </div>
    </div>
  );

  const renderConnectionSettings = () => (
    <div className="space-y-6">
      <Button onClick={() => setCurrentPage('main')} variant="secondary">
        ← Back
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Connection Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your Home Assistant connection
        </p>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Home Assistant URL
            </label>
            <Input
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="http://homeassistant.local:8123"
            />
            <p className="text-xs text-gray-500 mt-1">
              e.g., http://192.168.1.100:8123
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Long-Lived Access Token
            </label>
            <Input
              type="password"
              value={config.token}
              onChange={(e) => setConfig({ ...config, token: e.target.value })}
              placeholder="Enter your token"
            />
            <p className="text-xs text-gray-500 mt-1">
              Generate in Home Assistant: Profile → Long-Lived Access Tokens
            </p>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !config.url || !config.token}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 mr-2" />
                  {config.connected ? 'Reconnect' : 'Connect'}
                </>
              )}
            </Button>
          </div>

          {connectionStatus === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span>{connectionMessage}</span>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{connectionMessage}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  const renderAISettings = () => (
    <div className="space-y-6">
      <Button onClick={() => setCurrentPage('main')} variant="secondary">
        ← Back
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          AI Assistant Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure AI providers and API keys
        </p>
      </div>

      <Card>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Enable AI Assistant</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enable or disable AI features
              </p>
            </div>
            <Switch
              checked={preferences.enableAI}
              onChange={(checked) => setPreferences({ ...preferences, enableAI: checked })}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Use MCP Server</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect via Model Context Protocol
              </p>
            </div>
            <Switch
              checked={preferences.aiUseMCP}
              onChange={(checked) => setPreferences({ ...preferences, aiUseMCP: checked })}
            />
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Provider
            </label>
            <select
              value={preferences.aiProvider}
              onChange={(e) => setPreferences({ ...preferences, aiProvider: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="Backend Server">Backend Server (MCP)</option>
              <option value="OpenAI">OpenAI (GPT-4)</option>
              <option value="Claude">Anthropic Claude</option>
              <option value="Gemini">Google Gemini</option>
              <option value="Grok">xAI Grok</option>
              <option value="LM Studio">LM Studio (Local)</option>
            </select>
          </div>

          {preferences.aiProvider === 'OpenAI' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                OpenAI API Key
              </label>
              <Input
                type="password"
                value={preferences.openaiApiKey}
                onChange={(e) => setPreferences({ ...preferences, openaiApiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
          )}

          {preferences.aiProvider === 'Claude' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Claude API Key
              </label>
              <Input
                type="password"
                value={preferences.claudeApiKey}
                onChange={(e) => setPreferences({ ...preferences, claudeApiKey: e.target.value })}
                placeholder="sk-ant-..."
              />
            </div>
          )}

          {preferences.aiProvider === 'Gemini' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gemini API Key
              </label>
              <Input
                type="password"
                value={preferences.geminiApiKey}
                onChange={(e) => setPreferences({ ...preferences, geminiApiKey: e.target.value })}
                placeholder="..."
              />
            </div>
          )}

          {preferences.aiProvider === 'Grok' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Grok API Key
              </label>
              <Input
                type="password"
                value={preferences.grokApiKey}
                onChange={(e) => setPreferences({ ...preferences, grokApiKey: e.target.value })}
                placeholder="..."
              />
            </div>
          )}

          {preferences.aiProvider === 'LM Studio' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                LM Studio URL
              </label>
              <Input
                value={preferences.lmstudioUrl}
                onChange={(e) => setPreferences({ ...preferences, lmstudioUrl: e.target.value })}
                placeholder="http://localhost:1234"
              />
            </div>
          )}

          <div className="pt-4">
            <Button onClick={savePreferences} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save AI Settings
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderEnergySettings = () => (
    <div className="space-y-6">
      <Button onClick={() => setCurrentPage('main')} variant="secondary">
        ← Back
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Energy & Pricing
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure energy costs and pricing
        </p>
      </div>

      <Card>
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pricing Mode
            </label>
            <select
              value={preferences.pricingMode}
              onChange={(e) => setPreferences({ ...preferences, pricingMode: e.target.value as 'static' | 'dynamic' })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="static">Static Pricing</option>
              <option value="dynamic">Dynamic Pricing</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              General Price (per kWh)
            </label>
            <Input
              type="number"
              step="0.01"
              value={preferences.generalPrice}
              onChange={(e) => setPreferences({ ...preferences, generalPrice: parseFloat(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Feed-in Tariff (per kWh)
            </label>
            <Input
              type="number"
              step="0.01"
              value={preferences.feedInTariff}
              onChange={(e) => setPreferences({ ...preferences, feedInTariff: parseFloat(e.target.value) })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Currency
            </label>
            <select
              value={preferences.currency}
              onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AUD">AUD ($)</option>
              <option value="CAD">CAD ($)</option>
            </select>
          </div>

          {preferences.pricingMode === 'dynamic' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Update Interval (minutes)
              </label>
              <Input
                type="number"
                value={preferences.updateIntervalMinutes}
                onChange={(e) => setPreferences({ ...preferences, updateIntervalMinutes: parseInt(e.target.value) })}
              />
            </div>
          )}

          {lastPriceUpdate && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Last updated: {lastPriceUpdate}
            </div>
          )}

          <div className="pt-4">
            <Button onClick={savePreferences} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Energy Settings
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <Button onClick={() => setCurrentPage('main')} variant="secondary">
        ← Back
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Notifications
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage alerts and notifications
        </p>
      </div>

      <Card>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Enable Notifications</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Receive alerts and notifications
              </p>
            </div>
            <Switch
              checked={preferences.notifications}
              onChange={(checked) => setPreferences({ ...preferences, notifications: checked })}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Energy Alerts</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                High consumption warnings
              </p>
            </div>
            <Switch
              checked={preferences.energyAlerts}
              onChange={(checked) => setPreferences({ ...preferences, energyAlerts: checked })}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Device Offline Alerts</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Notify when devices go offline
              </p>
            </div>
            <Switch
              checked={preferences.deviceOfflineAlerts}
              onChange={(checked) => setPreferences({ ...preferences, deviceOfflineAlerts: checked })}
            />
          </div>

          <div className="pt-4">
            <Button onClick={savePreferences} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Notification Settings
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <Button onClick={() => setCurrentPage('main')} variant="secondary">
        ← Back
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Appearance
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Customize theme and display
        </p>
      </div>

      <Card>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Dark Mode</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use dark theme
              </p>
            </div>
            <Switch
              checked={preferences.darkMode}
              onChange={(checked) => setPreferences({ ...preferences, darkMode: checked })}
            />
          </div>

          <div className="pt-4">
            <Button onClick={savePreferences} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Appearance Settings
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="space-y-6">
      <Button onClick={() => setCurrentPage('main')} variant="secondary">
        ← Back
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Advanced Settings
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Advanced configuration options
        </p>
      </div>

      <Card>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Auto Refresh</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically refresh data
              </p>
            </div>
            <Switch
              checked={preferences.autoRefresh}
              onChange={(checked) => setPreferences({ ...preferences, autoRefresh: checked })}
            />
          </div>

          {preferences.autoRefresh && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Refresh Interval (seconds)
              </label>
              <Input
                type="number"
                value={preferences.refreshInterval}
                onChange={(e) => setPreferences({ ...preferences, refreshInterval: parseInt(e.target.value) })}
              />
            </div>
          )}

          <div className="pt-4">
            <Button onClick={savePreferences} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Advanced Settings
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {currentPage === 'main' && renderMainMenu()}
      {currentPage === 'connection' && renderConnectionSettings()}
      {currentPage === 'ai' && renderAISettings()}
      {currentPage === 'energy' && renderEnergySettings()}
      {currentPage === 'notifications' && renderNotificationSettings()}
      {currentPage === 'appearance' && renderAppearanceSettings()}
      {currentPage === 'advanced' && renderAdvancedSettings()}
    </div>
  );
};
