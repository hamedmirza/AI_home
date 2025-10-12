interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
  ha_config: {
    url: string;
    token: string;
  };
}

interface MCPResponse<T = unknown> {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

class MCPService {
  private baseUrl: string;
  private anonKey: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_SUPABASE_URL;
    this.anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  }

  private async callMCP<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const haConfig = localStorage.getItem('homeAssistantConfig');
    if (!haConfig) {
      throw new Error('Home Assistant not configured');
    }

    const config = JSON.parse(haConfig);
    if (!config.url || !config.token) {
      throw new Error('Invalid Home Assistant configuration');
    }

    const request: MCPRequest = {
      method,
      params,
      ha_config: {
        url: config.url,
        token: config.token,
      },
    };

    const response = await fetch(`${this.baseUrl}/functions/v1/home-assistant-mcp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.statusText}`);
    }

    const data: MCPResponse<T> = await response.json();

    if (data.error) {
      throw new Error(`MCP error: ${data.error.message}`);
    }

    if (!data.result) {
      throw new Error('No result returned from MCP server');
    }

    return data.result;
  }

  async getEntities() {
    return this.callMCP('home/entities');
  }

  async getStates(params?: { entity_id?: string; domain?: string }) {
    return this.callMCP('home/states', params);
  }

  async getAutomations() {
    return this.callMCP('home/automations');
  }

  async getScripts() {
    return this.callMCP('home/scripts');
  }

  async getServices() {
    return this.callMCP('home/services');
  }

  async getEnergy() {
    return this.callMCP('home/energy');
  }

  async getAIContext() {
    return this.callMCP('home/ai_context');
  }

  isAvailable(): boolean {
    const haConfig = localStorage.getItem('homeAssistantConfig');
    return haConfig !== null;
  }
}

export const mcpService = new MCPService();
export default mcpService;
