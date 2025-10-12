import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { mcpService } from '../services/mcpService';
import { CheckCircle, XCircle, Loader2, Play, Database } from 'lucide-react';

interface TestResult {
  method: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: unknown;
  error?: string;
  duration?: number;
}

const MCP_METHODS = [
  { name: 'home/ai_context', label: 'AI Context (Recommended)', description: 'Consolidated smart home context' },
  { name: 'home/entities', label: 'Entities', description: 'List all entities' },
  { name: 'home/states', label: 'States', description: 'Get all entity states' },
  { name: 'home/automations', label: 'Automations', description: 'List automations' },
  { name: 'home/scripts', label: 'Scripts', description: 'List scripts' },
  { name: 'home/services', label: 'Services', description: 'Available services' },
  { name: 'home/energy', label: 'Energy', description: 'Energy data' },
];

export function MCPTest() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);

  const testMethod = async (methodName: string) => {
    const startTime = Date.now();

    setResults(prev => ({
      ...prev,
      [methodName]: { method: methodName, status: 'loading' }
    }));

    try {
      let data: unknown;

      switch (methodName) {
        case 'home/ai_context':
          data = await mcpService.getAIContext();
          break;
        case 'home/entities':
          data = await mcpService.getEntities();
          break;
        case 'home/states':
          data = await mcpService.getStates();
          break;
        case 'home/automations':
          data = await mcpService.getAutomations();
          break;
        case 'home/scripts':
          data = await mcpService.getScripts();
          break;
        case 'home/services':
          data = await mcpService.getServices();
          break;
        case 'home/energy':
          data = await mcpService.getEnergy();
          break;
        default:
          throw new Error('Unknown method');
      }

      const duration = Date.now() - startTime;

      setResults(prev => ({
        ...prev,
        [methodName]: {
          method: methodName,
          status: 'success',
          data,
          duration
        }
      }));
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      setResults(prev => ({
        ...prev,
        [methodName]: {
          method: methodName,
          status: 'error',
          error: errorMessage,
          duration
        }
      }));
    }
  };

  const testAll = async () => {
    setIsTestingAll(true);
    setResults({});

    for (const method of MCP_METHODS) {
      await testMethod(method.name);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsTestingAll(false);
  };

  const clearResults = () => {
    setResults({});
  };

  const haConfig = localStorage.getItem('homeAssistantConfig');
  const isConfigured = haConfig !== null;

  if (!isConfigured) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Home Assistant Not Connected</h3>
            <p className="text-gray-600 mb-4">
              Please connect to Home Assistant in Settings before testing the MCP server.
            </p>
            <Button variant="primary" onClick={() => window.location.href = '#settings'}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>MCP Server Test Suite</span>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={clearResults}>
                Clear Results
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={testAll}
                disabled={isTestingAll}
              >
                {isTestingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Test All
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {MCP_METHODS.map((method) => {
              const result = results[method.name];

              return (
                <div
                  key={method.name}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {method.name}
                      </code>
                      <span className="font-medium text-gray-900">{method.label}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 ml-2">{method.description}</p>

                    {result && (
                      <div className="mt-2 ml-2">
                        {result.status === 'success' && (
                          <div className="flex items-center space-x-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-green-700">
                              Success ({result.duration}ms)
                            </span>
                            <span className="text-gray-500">
                              {Array.isArray(result.data)
                                ? `${result.data.length} items`
                                : typeof result.data === 'object' && result.data
                                ? `${Object.keys(result.data).length} properties`
                                : 'Data received'}
                            </span>
                          </div>
                        )}

                        {result.status === 'error' && (
                          <div className="flex items-start space-x-2 text-sm">
                            <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                            <div>
                              <span className="text-red-700 font-medium">Error</span>
                              <p className="text-red-600 text-xs mt-1">{result.error}</p>
                            </div>
                          </div>
                        )}

                        {result.status === 'loading' && (
                          <div className="flex items-center space-x-2 text-sm text-blue-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Testing...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testMethod(method.name)}
                    disabled={result?.status === 'loading' || isTestingAll}
                  >
                    Test
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {Object.keys(results).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Passed</span>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {Object.values(results).filter(r => r.status === 'success').length}
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-1">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-900">Failed</span>
                </div>
                <p className="text-2xl font-bold text-red-700">
                  {Object.values(results).filter(r => r.status === 'error').length}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-1">
                  <Database className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Total</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {Object.keys(results).length}
                </p>
              </div>
            </div>

            {Object.values(results).some(r => r.status === 'success' && r.data) && (
              <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <summary className="cursor-pointer font-medium text-gray-900 hover:text-gray-700">
                  View Raw Response Data
                </summary>
                <div className="mt-3 space-y-3">
                  {Object.entries(results)
                    .filter(([_, r]) => r.status === 'success' && r.data)
                    .map(([method, result]) => (
                      <div key={method}>
                        <p className="text-sm font-medium text-gray-700 mb-1">{method}:</p>
                        <pre className="bg-white p-3 rounded border border-gray-200 text-xs overflow-x-auto max-h-64 overflow-y-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
