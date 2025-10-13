import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { SettingsIcon, Moon, Sun, RefreshCw } from 'lucide-react';

export function InterfaceSettings() {
  const [preferences, setPreferences] = useState({
    darkMode: false,
    autoRefresh: true,
    refreshInterval: 30
  });

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

  useEffect(() => {
    if (preferences.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [preferences.darkMode]);

  const handleSave = () => {
    try {
      localStorage.setItem('appPreferences', JSON.stringify(preferences));
      alert('Interface settings saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  return (
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
            onChange={(checked) => {
              setPreferences(prev => ({ ...prev, darkMode: checked }));
              handleSave();
            }}
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
  );
}
