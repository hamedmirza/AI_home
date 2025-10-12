import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

interface HomeAssistantConfig {
  url: string;
  token: string;
}

async function fetchFromHA(config: HomeAssistantConfig, endpoint: string): Promise<unknown> {
  const url = `${config.url}/api${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Home Assistant API error: ${response.statusText}`);
  }

  return await response.json();
}

async function getEntities(config: HomeAssistantConfig): Promise<unknown> {
  const states = await fetchFromHA(config, "/states") as Array<{
    entity_id: string;
    state: string;
    attributes: Record<string, unknown>;
    last_changed: string;
    last_updated: string;
  }>;

  return states.map(entity => ({
    entity_id: entity.entity_id,
    state: entity.state,
    friendly_name: entity.attributes.friendly_name || entity.entity_id,
    device_class: entity.attributes.device_class,
    unit_of_measurement: entity.attributes.unit_of_measurement,
    last_updated: entity.last_updated,
  }));
}

async function getStates(config: HomeAssistantConfig, params?: Record<string, unknown>): Promise<unknown> {
  const allStates = await fetchFromHA(config, "/states") as Array<Record<string, unknown>>;
  
  if (params?.entity_id) {
    return allStates.filter(s => s.entity_id === params.entity_id);
  }
  
  if (params?.domain) {
    return allStates.filter(s => {
      const entityId = s.entity_id as string;
      return entityId.startsWith(`${params.domain}.`);
    });
  }
  
  return allStates;
}

async function getAutomations(config: HomeAssistantConfig): Promise<unknown> {
  const states = await fetchFromHA(config, "/states") as Array<{
    entity_id: string;
    state: string;
    attributes: Record<string, unknown>;
  }>;

  const automations = states.filter(s => s.entity_id.startsWith("automation."));
  
  return automations.map(auto => ({
    entity_id: auto.entity_id,
    state: auto.state,
    friendly_name: auto.attributes.friendly_name || auto.entity_id,
    last_triggered: auto.attributes.last_triggered,
  }));
}

async function getScripts(config: HomeAssistantConfig): Promise<unknown> {
  const states = await fetchFromHA(config, "/states") as Array<{
    entity_id: string;
    state: string;
    attributes: Record<string, unknown>;
  }>;

  const scripts = states.filter(s => s.entity_id.startsWith("script."));
  
  return scripts.map(script => ({
    entity_id: script.entity_id,
    friendly_name: script.attributes.friendly_name || script.entity_id,
  }));
}

async function getServices(config: HomeAssistantConfig): Promise<unknown> {
  return await fetchFromHA(config, "/services");
}

async function getEnergy(config: HomeAssistantConfig): Promise<unknown> {
  try {
    return await fetchFromHA(config, "/energy/summary");
  } catch {
    return await fetchFromHA(config, "/energy");
  }
}

async function getAIContext(config: HomeAssistantConfig): Promise<unknown> {
  const [states, automations, services] = await Promise.all([
    fetchFromHA(config, "/states"),
    getAutomations(config),
    fetchFromHA(config, "/services"),
  ]);

  const statesArray = states as Array<{
    entity_id: string;
    state: string;
    attributes: Record<string, unknown>;
  }>;

  const energyDevices = statesArray.filter(s => 
    s.entity_id.startsWith("sensor.") && 
    (s.attributes.device_class === "energy" || 
     s.attributes.device_class === "power" ||
     s.entity_id.includes("energy") ||
     s.entity_id.includes("power"))
  );

  const solarDevices = statesArray.filter(s => 
    s.entity_id.includes("solar") || 
    s.entity_id.includes("pv") ||
    (s.attributes.device_class === "power" && s.state !== "unavailable")
  );

  const batteryDevices = statesArray.filter(s => 
    s.entity_id.includes("battery") ||
    s.attributes.device_class === "battery"
  );

  const climateDevices = statesArray.filter(s => 
    s.entity_id.startsWith("climate.") ||
    s.entity_id.startsWith("thermostat.")
  );

  const lightDevices = statesArray.filter(s => s.entity_id.startsWith("light."));
  const switchDevices = statesArray.filter(s => s.entity_id.startsWith("switch."));

  const domainCounts: Record<string, number> = {};
  statesArray.forEach(s => {
    const domain = s.entity_id.split(".")[0];
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  });

  return {
    summary: {
      total_entities: statesArray.length,
      total_automations: Array.isArray(automations) ? automations.length : 0,
      domains: domainCounts,
    },
    energy: {
      devices: energyDevices.map(d => ({
        entity_id: d.entity_id,
        state: d.state,
        unit: d.attributes.unit_of_measurement,
        friendly_name: d.attributes.friendly_name,
      })),
      solar_devices: solarDevices.length,
      battery_devices: batteryDevices.length,
    },
    home_control: {
      lights: lightDevices.length,
      switches: switchDevices.length,
      climate: climateDevices.length,
    },
    capabilities: {
      has_solar: solarDevices.length > 0,
      has_battery: batteryDevices.length > 0,
      has_climate_control: climateDevices.length > 0,
      has_lighting: lightDevices.length > 0,
    },
    available_services: Object.keys(services as Record<string, unknown>),
  };
}

async function handleMCPRequest(request: MCPRequest, config: HomeAssistantConfig): Promise<MCPResponse> {
  try {
    let result: unknown;

    switch (request.method) {
      case "home/entities":
        result = await getEntities(config);
        break;
      
      case "home/states":
        result = await getStates(config, request.params);
        break;
      
      case "home/automations":
        result = await getAutomations(config);
        break;
      
      case "home/scripts":
        result = await getScripts(config);
        break;
      
      case "home/services":
        result = await getServices(config);
        break;
      
      case "home/energy":
        result = await getEnergy(config);
        break;
      
      case "home/ai_context":
        result = await getAIContext(config);
        break;
      
      default:
        return {
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        };
    }

    return { result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      error: {
        code: -32603,
        message: `Internal error: ${errorMessage}`,
      },
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json() as MCPRequest & { ha_config?: HomeAssistantConfig };

    if (!body.ha_config?.url || !body.ha_config?.token) {
      return new Response(
        JSON.stringify({
          error: {
            code: -32602,
            message: "Missing Home Assistant configuration (ha_config.url and ha_config.token required)",
          },
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const response = await handleMCPRequest(body, body.ha_config);

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: {
          code: -32700,
          message: `Parse error: ${errorMessage}`,
        },
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});