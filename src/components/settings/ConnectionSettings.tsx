import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { homeAssistantService } from '../../services/homeAssistant';
import { Wifi, RefreshCw, AlertCircle, CheckCircle, TestTube } from 'lucide-react';

interface BackendConfig {
  url: string;
  token: string;
  connected?: boolean;
  connectionType?: string;
}

interface ConnectionSettingsProps {
  onConnectionChange: (connected: boolean) => void;
}

export function ConnectionSettings({ onConnectionChange }: ConnectionSettingsProps) {
  const [config, setConfig] = useState<BackendConfig>({
    url: 'http://homeassistant.local:8123',
    token: '',
    connected: false,
    connectionType: 'direct'
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionErrorMessage, setConnectionErrorMessage] = useState('');

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('homeAssistantConfig');
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig({
          url: parsedConfig.url || 'http://homeassistant.local:8123',
          token: parsedConfig.token || '',
          connected: homeAssistantService.isConnected()
        });

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="w-5 h-5 text-blue-500" />
            <span>Backend Connection</span>
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
    - "http://localhost:5173"
    - "https://localhost:5173"
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1`}
              </pre>
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
    </div>
  );
}
