import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { Bell } from 'lucide-react';

export function NotificationSettings() {
  const [preferences, setPreferences] = useState({
    notifications: true,
    energyAlerts: true,
    deviceOfflineAlerts: true,
    aiSuggestions: true
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

  const handleSave = () => {
    try {
      localStorage.setItem('appPreferences', JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const handleChange = (key: string, value: boolean) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('appPreferences', JSON.stringify(updated));
      return updated;
    });
  };

  return (
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
            onChange={(checked) => handleChange('notifications', checked)}
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
                onChange={(checked) => handleChange('energyAlerts', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Device Offline Alerts</p>
                <p className="text-sm text-gray-600">Notifications when devices go offline</p>
              </div>
              <Switch
                checked={preferences.deviceOfflineAlerts}
                onChange={(checked) => handleChange('deviceOfflineAlerts', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">AI Suggestions</p>
                <p className="text-sm text-gray-600">Receive smart recommendations and tips</p>
              </div>
              <Switch
                checked={preferences.aiSuggestions}
                onChange={(checked) => handleChange('aiSuggestions', checked)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
