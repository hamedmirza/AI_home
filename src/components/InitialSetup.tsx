import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Entity } from '../types/homeAssistant';
import { homeAssistantService } from '../services/homeAssistant';
import { aiSetupService } from '../services/aiSetupService';
import { 
  Wand2, 
  Home, 
  Lightbulb, 
  Thermometer, 
  Zap,
  CheckCircle,
  Clock,
  AlertCircle,
  Sparkles,
  Settings,
  Users,
  Calendar,
  LayoutDashboard,
  Bot,
  ArrowRight,
  Loader2
} from 'lucide-react';

interface InitialSetupProps {
  entities: Entity[];
  isConnected: boolean;
  onSetupComplete: () => void;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
}

export const InitialSetup: React.FC<InitialSetupProps> = ({ entities, isConnected, onSetupComplete }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([
    {
      id: 'analyze',
      title: 'Analyze Your Home',
      description: 'AI analyzes your devices and creates a smart home profile',
      icon: <Bot className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'rooms',
      title: 'Create Rooms',
      description: 'Automatically organize devices into logical rooms',
      icon: <Home className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'dashboards',
      title: 'Build Dashboards',
      description: 'Create custom dashboards for different areas and use cases',
      icon: <LayoutDashboard className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'automations',
      title: 'Setup Automations',
      description: 'Create intelligent automations based on your lifestyle',
      icon: <Calendar className="w-5 h-5" />,
      status: 'pending'
    },
    {
      id: 'energy',
      title: 'Configure Energy',
      description: 'Map energy sources and setup monitoring',
      icon: <Zap className="w-5 h-5" />,
      status: 'pending'
    }
  ]);

  const [userPreferences, setUserPreferences] = useState({
    homeType: 'house', // house, apartment, condo
    residents: 2,
    lifestyle: 'balanced', // energy-saver, comfort, balanced, tech-enthusiast
    priorities: ['security', 'energy-efficiency'], // security, energy-efficiency, convenience, entertainment
    wakeTime: '07:00',
    sleepTime: '23:00',
    workFromHome: true
  });

  const [showPreferences, setShowPreferences] = useState(true);
  const [setupResults, setSetupResults] = useState<any>({});

  const runAISetup = async () => {
    if (!isConnected) {
      alert('Please connect to Home Assistant first');
      return;
    }

    setIsRunning(true);
    setShowPreferences(false);
    setCurrentStep(0);

    try {
      for (let i = 0; i < setupSteps.length; i++) {
        setCurrentStep(i);
        
        // Update step status to running
        setSetupSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, status: 'running' } : step
        ));

        let result;
        const step = setupSteps[i];

        switch (step.id) {
          case 'analyze':
            result = await aiSetupService.analyzeHome(entities, userPreferences);
            break;
          case 'rooms':
            result = await aiSetupService.createRooms(entities, setupResults.analyze);
            break;
          case 'dashboards':
            result = await aiSetupService.createDashboards(entities, setupResults.rooms);
            break;
          case 'automations':
            result = await aiSetupService.createAutomations(entities, userPreferences, setupResults.rooms);
            break;
          case 'energy':
            result = await aiSetupService.configureEnergy(entities);
            break;
        }

        // Store result and update step status
        setSetupResults(prev => ({ ...prev, [step.id]: result }));
        setSetupSteps(prev => prev.map((step, index) => 
          index === i ? { ...step, status: 'completed', result } : step
        ));

        // Small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Mark setup as completed
      localStorage.setItem('initialSetupCompleted', 'true');
      setTimeout(() => {
        onSetupComplete();
      }, 2000);

    } catch (error) {
      console.error('Setup failed:', error);
      setSetupSteps(prev => prev.map((step, index) => 
        index === currentStep ? { ...step, status: 'error' } : step
      ));
    } finally {
      setIsRunning(false);
    }
  };

  const skipSetup = () => {
    localStorage.setItem('initialSetupCompleted', 'true');
    onSetupComplete();
  };

  if (showPreferences) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Welcome to Your Smart Home!</CardTitle>
            <p className="text-gray-600 mt-2">
              Let AI set up your smart home automatically. Just tell us a bit about your preferences.
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Home Type</label>
                <select
                  value={userPreferences.homeType}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, homeType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="house">House</option>
                  <option value="apartment">Apartment</option>
                  <option value="condo">Condo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Residents</label>
                <Input
                  type="number"
                  value={userPreferences.residents}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, residents: parseInt(e.target.value) || 1 }))}
                  min="1"
                  max="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lifestyle</label>
                <select
                  value={userPreferences.lifestyle}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, lifestyle: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="energy-saver">Energy Saver</option>
                  <option value="comfort">Comfort Focused</option>
                  <option value="balanced">Balanced</option>
                  <option value="tech-enthusiast">Tech Enthusiast</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Work From Home</label>
                <select
                  value={userPreferences.workFromHome ? 'yes' : 'no'}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, workFromHome: e.target.value === 'yes' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Wake Time</label>
                <Input
                  type="time"
                  value={userPreferences.wakeTime}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, wakeTime: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sleep Time</label>
                <Input
                  type="time"
                  value={userPreferences.sleepTime}
                  onChange={(e) => setUserPreferences(prev => ({ ...prev, sleepTime: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Priorities (select all that apply)</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'security', label: 'Security & Safety', icon: <Settings className="w-4 h-4" /> },
                  { id: 'energy-efficiency', label: 'Energy Efficiency', icon: <Zap className="w-4 h-4" /> },
                  { id: 'convenience', label: 'Convenience', icon: <Home className="w-4 h-4" /> },
                  { id: 'entertainment', label: 'Entertainment', icon: <Users className="w-4 h-4" /> }
                ].map(priority => (
                  <label key={priority.id} className="flex items-center space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userPreferences.priorities.includes(priority.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUserPreferences(prev => ({
                            ...prev,
                            priorities: [...prev.priorities, priority.id]
                          }));
                        } else {
                          setUserPreferences(prev => ({
                            ...prev,
                            priorities: prev.priorities.filter(p => p !== priority.id)
                          }));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    {priority.icon}
                    <span className="text-sm">{priority.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                <Bot className="w-4 h-4 mr-2" />
                AI Setup Process
              </h4>
              <p className="text-sm text-blue-800">
                Based on your preferences, AI will automatically:
              </p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1">
                <li>• Analyze your {entities.length} connected devices</li>
                <li>• Create logical room groupings</li>
                <li>• Build custom dashboards for your needs</li>
                <li>• Set up intelligent automations</li>
                <li>• Configure energy monitoring</li>
              </ul>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={skipSetup}>
                Skip Setup
              </Button>
              <Button 
                variant="primary" 
                onClick={runAISetup}
                disabled={!isConnected}
                className="px-8"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Start AI Setup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            {isRunning ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : (
              <CheckCircle className="w-8 h-8 text-white" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isRunning ? 'Setting Up Your Smart Home...' : 'Setup Complete!'}
          </CardTitle>
          <p className="text-gray-600 mt-2">
            {isRunning 
              ? 'AI is configuring your smart home based on your preferences'
              : 'Your smart home has been configured and is ready to use!'
            }
          </p>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {setupSteps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center space-x-4 p-4 rounded-lg border transition-all duration-300 ${
                  step.status === 'completed' 
                    ? 'bg-green-50 border-green-200' 
                    : step.status === 'running'
                    ? 'bg-blue-50 border-blue-200'
                    : step.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  step.status === 'completed'
                    ? 'bg-green-500 text-white'
                    : step.status === 'running'
                    ? 'bg-blue-500 text-white'
                    : step.status === 'error'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {step.status === 'running' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : step.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : step.status === 'error' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    step.icon
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{step.title}</h3>
                  <p className="text-sm text-gray-600">{step.description}</p>
                  
                  {step.result && (
                    <div className="mt-2 text-xs text-gray-500">
                      {step.id === 'rooms' && `Created ${step.result.rooms?.length || 0} rooms`}
                      {step.id === 'dashboards' && `Built ${step.result.dashboards?.length || 0} dashboards`}
                      {step.id === 'automations' && `Setup ${step.result.automations?.length || 0} automations`}
                      {step.id === 'energy' && `Mapped ${step.result.mappedEntities || 0} energy entities`}
                      {step.id === 'analyze' && `Analyzed ${entities.length} devices`}
                    </div>
                  )}
                </div>
                
                {index === currentStep && isRunning && (
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!isRunning && setupSteps.every(step => step.status === 'completed') && (
            <div className="mt-8 text-center">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-green-900 mb-2">Setup Successful!</h3>
                <p className="text-green-800">
                  Your smart home has been configured with AI-generated rooms, dashboards, and automations.
                  You can always customize these settings later.
                </p>
              </div>
              
              <Button variant="primary" onClick={onSetupComplete} className="px-8">
                <ArrowRight className="w-4 h-4 mr-2" />
                Enter Your Smart Home
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};