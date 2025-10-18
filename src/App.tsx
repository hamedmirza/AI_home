import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Card } from './components/ui/Card';
import { InitialSetup } from './components/InitialSetup';
import { Overview } from './components/Overview';
import { Dashboards } from './components/Dashboards';
import { EntityManager } from './components/EntityManager';
import { EnergyManager } from './components/EnergyManager';
import { EnergyDashboard } from './components/EnergyDashboard';
import { AIAssistant } from './components/AIAssistant';
import { Automations } from './components/Automations';
import { SettingsNew as Settings } from './components/SettingsNew';
import { FloatingChat } from './components/FloatingChat';
import { SmartDashboard } from './components/SmartDashboard';
import { Admin } from './components/Admin';
import { AuditTrail } from './components/AuditTrail';
import { Entity } from './types/homeAssistant';
import { homeAssistantService } from './services/homeAssistant';
import { energyPricingService } from './services/energyPricingService';
import { supabase } from './services/database';
import { Home, Settings as SettingsIcon, Zap, Bot, Grid3x3 as Grid3X3, Menu, X, LayoutDashboard, Activity, Battery, Shield, FileText } from 'lucide-react';

type ActiveTab = 'overview' | 'dashboards' | 'smart-dashboards' | 'entities' | 'energy' | 'energy-dashboard' | 'automations' | 'ai' | 'admin' | 'audit' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showInitialSetup, setShowInitialSetup] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('');

  // Get pinned dashboards for sidebar - moved to top to fix hooks order
  const [pinnedDashboards, setPinnedDashboards] = useState<any[]>([]);

  // Load dark mode preference and initialize dynamic pricing
  useEffect(() => {
    try {
      const savedPreferences = localStorage.getItem('appPreferences');
      if (savedPreferences) {
        const preferences = JSON.parse(savedPreferences);
        setDarkMode(preferences.darkMode || false);
      }

      energyPricingService.initializeDynamicPricing();
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const loadPinnedDashboards = () => {
      try {
        const saved = localStorage.getItem('dashboards');
        if (saved) {
          const dashboards = JSON.parse(saved);
          setPinnedDashboards(dashboards.filter((d: any) => d.isPinned));
        }
      } catch (error) {
        console.error('Failed to load pinned dashboards:', error);
      }
    };

    loadPinnedDashboards();
    
    // Listen for dashboard changes
    const interval = setInterval(loadPinnedDashboards, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check Supabase authentication
    checkAuthStatus();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsLoggedIn(true);
        setCurrentUser(session.user.email || 'User');
      } else {
        setIsLoggedIn(false);
        setCurrentUser('');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsLoggedIn(true);
      setCurrentUser(session.user.email || 'User');
    } else {
      setIsLoggedIn(false);
    }

  };

  useEffect(() => {
    // Check if initial setup has been completed
    const setupCompleted = localStorage.getItem('initialSetupCompleted');
    if (!setupCompleted && entities.length > 0 && isConnected) {
      setShowInitialSetup(true);
    }

    // Check connection status and auto-connect if credentials exist
    const checkAndAutoConnect = async () => {
      if (homeAssistantService.isConnected()) {
        setIsConnected(true);
        return;
      }

      // Try to auto-connect if we have saved credentials
      try {
        const savedConfig = localStorage.getItem('homeAssistantConfig');
        if (savedConfig) {
          const config = JSON.parse(savedConfig);
          if (config.url && config.token) {
            console.log('Auto-connecting to Home Assistant...');
            await homeAssistantService.connect(config.url, config.token);
            setIsConnected(true);
            console.log('Auto-connection successful!');
          }
        }
      } catch (error) {
        console.log('Auto-connection failed:', error);
        setIsConnected(false);
      }
    };

    checkAndAutoConnect();
    setLoading(false);
  }, [entities, isConnected]);

  const handleLogin = async () => {
    // Authentication is handled by Supabase in Login component
    // Just refresh auth state here
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setIsLoggedIn(true);
      setCurrentUser(session.user.email || 'User');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setCurrentUser('');
  };

  useEffect(() => {
    if (isConnected && isLoggedIn) {
      loadEntities();
      // Set up auto-refresh interval
      const interval = setInterval(loadEntities, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    } else {
      setEntities([]);
      setLoading(false);
    }
  }, [isConnected, isLoggedIn]);

  const loadEntities = async () => {
    if (!isConnected || !isLoggedIn) {
      setLoading(false);
      return;
    }

    try {
      const entitiesData = await homeAssistantService.getEntities();
      setEntities(entitiesData);
    } catch (error) {
      console.error('Failed to load entities:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEntityToggle = async (entityId: string) => {
    if (!isConnected) return;

    // Optimistically update the UI immediately
    setEntities(prevEntities => 
      prevEntities.map(entity => 
        entity.entity_id === entityId 
          ? { ...entity, state: entity.state === 'on' ? 'off' : 'on' }
          : entity
      )
    );
    try {
      await homeAssistantService.toggleEntity(entityId);
      
      // Refresh entities after a short delay to get the actual state
      setTimeout(loadEntities, 1000);
    } catch (error) {
      console.error('Failed to toggle entity:', error);
      // Revert the optimistic update on error
      setTimeout(loadEntities, 100);
      // Show user-friendly error message
      alert(`Failed to toggle ${entityId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSetupComplete = () => {
    setShowInitialSetup(false);
    loadEntities(); // Refresh entities after setup
  };

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const navigation = [
    {
      id: 'overview' as ActiveTab,
      name: 'Overview',
      icon: Home,
      description: 'Overview and quick controls'
    },
    {
      id: 'dashboards' as ActiveTab,
      name: 'Dashboards',
      icon: LayoutDashboard,
      description: 'Custom dashboard views'
    },
    {
      id: 'smart-dashboards' as ActiveTab,
      name: 'Smart Dashboards',
      icon: LayoutDashboard,
      description: 'AI-powered card system'
    },
    {
      id: 'entities' as ActiveTab,
      name: 'Entities',
      icon: Grid3X3,
      description: 'Manage all devices'
    },
    {
      id: 'energy' as ActiveTab,
      name: 'Energy',
      icon: Zap,
      description: 'Usage and optimization'
    },
    {
      id: 'energy-dashboard' as ActiveTab,
      name: 'Energy Dashboard',
      icon: Battery,
      description: 'Live battery & solar monitoring'
    },
    {
      id: 'automations' as ActiveTab,
      name: 'Automations',
      icon: Activity,
      description: 'Smart home automations'
    },
    {
      id: 'ai' as ActiveTab,
      name: 'AI Assistant',
      icon: Bot,
      description: 'Natural language control'
    },
    {
      id: 'admin' as ActiveTab,
      name: 'Admin',
      icon: Shield,
      description: 'System diagnostics'
    },
    {
      id: 'audit' as ActiveTab,
      name: 'Audit Trail',
      icon: FileText,
      description: 'Action logs and traces'
    },
    {
      id: 'settings' as ActiveTab,
      name: 'Settings',
      icon: SettingsIcon,
      description: 'Configuration and preferences'
    }
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <Overview entities={entities} onEntityToggle={handleEntityToggle} isConnected={isConnected} />;
      case 'dashboards':
        return <Dashboards entities={entities} onEntityToggle={handleEntityToggle} isConnected={isConnected} />;
      case 'smart-dashboards':
        return <SmartDashboard />;
      case 'entities':
        return <EntityManager entities={entities} onEntityToggle={handleEntityToggle} onEntitiesUpdate={loadEntities} isConnected={isConnected} />;
      case 'energy':
        return <EnergyManager entities={entities} isConnected={isConnected} />;
      case 'energy-dashboard':
        return <EnergyDashboard />;
      case 'automations':
        return <Automations entities={entities} isConnected={isConnected} />;
      case 'ai':
        return <AIAssistant isConnected={isConnected} onEntityUpdate={loadEntities} />;
      case 'admin':
        return <Admin />;
      case 'audit':
        return <AuditTrail />;
      case 'settings':
        return <Settings onConnectionChange={setIsConnected} />;
      default:
        return <Overview entities={entities} onEntityToggle={handleEntityToggle} isConnected={isConnected} />;
    }
  };

  // Show initial setup if needed
  if (showInitialSetup) {
    return (
      <InitialSetup 
        entities={entities}
        isConnected={isConnected}
        onSetupComplete={handleSetupComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar - Always Fixed */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">AI Smart Home</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Welcome, {currentUser}</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-3 text-left rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </nav>
            {/* Pinned Dashboards */}
            {pinnedDashboards.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="px-3 py-2">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pinned Dashboards
                  </h3>
                </div>
                {pinnedDashboards.map((dashboard) => (
                  <button
                    key={dashboard.id}
                    onClick={() => {
                      setActiveTab('dashboards');
                      setSidebarOpen(false);
                      // Set active dashboard in localStorage for the Dashboards component to pick up
                      localStorage.setItem('activeDashboard', dashboard.id);
                    }}
                    className="w-full flex items-center px-3 py-2 text-left rounded-lg transition-all duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-3 text-gray-500 dark:text-gray-400" />
                    <div className="text-sm font-medium">{dashboard.name}</div>
                  </button>
                ))}
              </div>
            )}

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              <button
                onClick={handleLogout}
                className="w-full text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                Sign Out ({currentUser})
              </button>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                AI Smart Home v2.0
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content - Add left padding for fixed sidebar */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">AI Smart Home</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          >
            Sign Out
          </button>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Floating Chat - Available everywhere except AI Assistant tab */}
      {activeTab !== 'ai' && (
        <FloatingChat isConnected={isConnected} onEntityUpdate={loadEntities} />
      )}
    </div>
  );
}

export default App;