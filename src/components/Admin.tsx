import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { MCPTest } from './MCPTest';
import { AIInsights } from './AIInsights';
import { TestTube, Brain, Shield, Database, Activity } from 'lucide-react';

export function Admin() {
  const [activeSection, setActiveSection] = useState<'mcp' | 'ai-learning'>('mcp');

  const sections = [
    {
      id: 'mcp' as const,
      name: 'MCP Testing',
      icon: TestTube,
      description: 'Test Model Context Protocol integration'
    },
    {
      id: 'ai-learning' as const,
      name: 'AI Learning',
      icon: Brain,
      description: 'AI learning patterns and insights'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Advanced diagnostics and system management
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`p-6 rounded-lg border-2 text-left transition-all ${
                isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/40'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <Icon className={`w-6 h-6 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold mb-1 ${
                    isActive
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {section.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {section.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {activeSection === 'mcp' && <MCPTest />}
        {activeSection === 'ai-learning' && <AIInsights />}
      </div>
    </div>
  );
}
