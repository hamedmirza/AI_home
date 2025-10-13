import React, { useState } from 'react';
import { Card, CardContent } from './ui/Card';
import { ConnectionSettings } from './settings/ConnectionSettings';
import { InterfaceSettings } from './settings/InterfaceSettings';
import { NotificationSettings } from './settings/NotificationSettings';
import { AISettings } from './settings/AISettings';
import { EnergyPricingSettings } from './settings/EnergyPricingSettings';
import {
  Settings as SettingsIcon,
  Wifi,
  Monitor,
  Bell,
  Bot,
  DollarSign,
  Info
} from 'lucide-react';

interface SettingsProps {
  onConnectionChange: (connected: boolean) => void;
}

type SettingsPage = 'connection' | 'interface' | 'notifications' | 'ai' | 'energy' | 'about';

export const SettingsNew: React.FC<SettingsProps> = ({ onConnectionChange }) => {
  const [activePage, setActivePage] = useState<SettingsPage>('connection');

  const pages = [
    { id: 'connection' as SettingsPage, label: 'Connection', icon: Wifi, description: 'Backend & Network' },
    { id: 'interface' as SettingsPage, label: 'Interface', icon: Monitor, description: 'Display & Theme' },
    { id: 'notifications' as SettingsPage, label: 'Notifications', icon: Bell, description: 'Alerts & Updates' },
    { id: 'ai' as SettingsPage, label: 'AI Assistant', icon: Bot, description: 'AI Provider & Performance' },
    { id: 'energy' as SettingsPage, label: 'Energy Pricing', icon: DollarSign, description: 'Rates & Billing' },
    { id: 'about' as SettingsPage, label: 'About', icon: Info, description: 'System Information' }
  ];

  const renderContent = () => {
    switch (activePage) {
      case 'connection':
        return <ConnectionSettings onConnectionChange={onConnectionChange} />;
      case 'interface':
        return <InterfaceSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'ai':
        return <AISettings />;
      case 'energy':
        return <EnergyPricingSettings />;
      case 'about':
        return (
          <Card className="bg-gray-50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
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
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Settings Sidebar */}
      <div className="w-64 flex-shrink-0">
        <Card className="sticky top-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-6">
              <SettingsIcon className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
            </div>
            <nav className="space-y-1">
              {pages.map((page) => {
                const Icon = page.icon;
                return (
                  <button
                    key={page.id}
                    onClick={() => setActivePage(page.id)}
                    className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                      activePage === page.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                      activePage === page.id ? 'text-blue-600' : 'text-gray-500'
                    }`} />
                    <div>
                      <div className="font-medium">{page.label}</div>
                      <div className="text-xs text-gray-500">{page.description}</div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {pages.find(p => p.id === activePage)?.label}
            </h1>
            <p className="text-gray-600">
              {pages.find(p => p.id === activePage)?.description}
            </p>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
