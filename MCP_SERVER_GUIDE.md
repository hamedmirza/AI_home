# Home Assistant MCP Server Guide

## Overview

The Home Assistant MCP (Model Context Protocol) Server provides AI assistants with structured, secure access to your Home Assistant data through a standardized interface.

## Quick Test (Easiest!)

### Using the Built-in Test Interface

1. **Connect to Home Assistant** in Settings first (if not already connected)
2. Click **"MCP Test"** in the sidebar
3. Click **"Test All"** to test all endpoints at once
4. View results with success/error status, duration, and data preview

**What you'll see:**
- ✅ Green checkmarks for successful tests
- ❌ Red X for errors (with error messages)
- Response time in milliseconds
- Number of items returned
- Raw JSON data in expandable section

### Using curl

```bash
curl -X POST \
  "${VITE_SUPABASE_URL}/functions/v1/home-assistant-mcp" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "home/ai_context",
    "ha_config": {
      "url": "http://homeassistant.local:8123",
      "token": "YOUR_LONG_LIVED_ACCESS_TOKEN"
    }
  }'
```

## Deployment

The MCP server is deployed as a Supabase Edge Function at:
```
{VITE_SUPABASE_URL}/functions/v1/home-assistant-mcp
```

## Phase 1: Read-Only Tools (Active)

### Available Methods

#### 1. `home/entities`
Returns a simplified list of all entities with basic information.

**Request:**
```json
{
  "method": "home/entities",
  "ha_config": {
    "url": "http://homeassistant.local:8123",
    "token": "YOUR_TOKEN"
  }
}
```

**Response:**
```json
{
  "result": [
    {
      "entity_id": "sensor.temperature",
      "state": "22.5",
      "friendly_name": "Living Room Temperature",
      "device_class": "temperature",
      "unit_of_measurement": "°C",
      "last_updated": "2025-10-12T10:30:00Z"
    }
  ]
}
```

#### 2. `home/states`
Returns full state information for all entities or filtered by entity_id/domain.

**Request (all states):**
```json
{
  "method": "home/states",
  "ha_config": {
    "url": "http://homeassistant.local:8123",
    "token": "YOUR_TOKEN"
  }
}
```

**Request (filter by domain):**
```json
{
  "method": "home/states",
  "params": {
    "domain": "sensor"
  },
  "ha_config": {
    "url": "http://homeassistant.local:8123",
    "token": "YOUR_TOKEN"
  }
}
```

**Request (specific entity):**
```json
{
  "method": "home/states",
  "params": {
    "entity_id": "sensor.temperature"
  },
  "ha_config": {
    "url": "http://homeassistant.local:8123",
    "token": "YOUR_TOKEN"
  }
}
```

#### 3. `home/automations`
Returns all automation entities with their current state and last triggered time.

**Request:**
```json
{
  "method": "home/automations",
  "ha_config": {
    "url": "http://homeassistant.local:8123",
    "token": "YOUR_TOKEN"
  }
}
```

#### 4. `home/scripts`
Returns all script entities.

**Request:**
```json
{
  "method": "home/scripts",
  "ha_config": {
    "url": "http://homeassistant.local:8123",
    "token": "YOUR_TOKEN"
  }
}
```

#### 5. `home/services`
Returns all available services in Home Assistant.

**Request:**
```json
{
  "method": "home/services",
  "ha_config": {
    "url": "http://homeassistant.local:8123",
    "token": "YOUR_TOKEN"
  }
}
```

#### 6. `home/energy`
Returns energy dashboard summary data.

**Request:**
```json
{
  "method": "home/energy",
  "ha_config": {
    "url": "http://homeassistant.local:8123",
    "token": "YOUR_TOKEN"
  }
}
```

#### 7. `home/ai_context` (Recommended for AI)
Returns consolidated context data optimized for AI understanding.

**Request:**
```json
{
  "method": "home/ai_context",
  "ha_config": {
    "url": "http://homeassistant.local:8123",
    "token": "YOUR_TOKEN"
  }
}
```

**Response:**
```json
{
  "result": {
    "summary": {
      "total_entities": 150,
      "total_automations": 12,
      "domains": {
        "sensor": 45,
        "light": 20,
        "switch": 15
      }
    },
    "energy": {
      "devices": [...],
      "solar_devices": 3,
      "battery_devices": 1
    },
    "home_control": {
      "lights": 20,
      "switches": 15,
      "climate": 2
    },
    "capabilities": {
      "has_solar": true,
      "has_battery": true,
      "has_climate_control": true,
      "has_lighting": true
    },
    "available_services": ["light", "switch", "climate", ...]
  }
}
```

## Using the MCP Service in Code

```typescript
import { mcpService } from '../services/mcpService';

// Get AI context (recommended starting point)
const context = await mcpService.getAIContext();
console.log('Home has solar:', context.capabilities.has_solar);

// Get all entities
const entities = await mcpService.getEntities();

// Get specific domain
const sensors = await mcpService.getStates({ domain: 'sensor' });

// Get automations
const automations = await mcpService.getAutomations();

// Get energy data
const energy = await mcpService.getEnergy();
```

## Phase 2: Actions (Coming Soon)

Phase 2 will add controlled service calls:
- `home/call_service` - Call Home Assistant services with allowlist
- Policy enforcement (time-of-day, energy price, occupancy checks)
- Rate limiting and safety constraints

## Phase 3: Audit & Traces (Planned)

Phase 3 will add comprehensive logging:
- Tool call logging with reasoning
- Audit trail for all AI actions
- Rollback capabilities
- Historical analysis

## Error Handling

All errors follow JSON-RPC 2.0 error format:

```json
{
  "error": {
    "code": -32603,
    "message": "Internal error: Connection refused"
  }
}
```

**Error Codes:**
- `-32700`: Parse error (malformed JSON)
- `-32601`: Method not found
- `-32602`: Invalid params (missing ha_config)
- `-32603`: Internal error (HA connection failed, etc.)

## Security

- All requests require valid Home Assistant credentials
- JWT authentication enforced at edge function level
- Phase 1 is read-only (no state changes possible)
- Phase 2 will implement explicit allowlists and policy checks
- Phase 3 will add comprehensive audit trails

## Testing

You can test the MCP server using curl:

```bash
curl -X POST \
  "${VITE_SUPABASE_URL}/functions/v1/home-assistant-mcp" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "home/ai_context",
    "ha_config": {
      "url": "http://homeassistant.local:8123",
      "token": "YOUR_TOKEN"
    }
  }'
```

## Benefits for AI Assistants

1. **Structured Data**: Clean, consistent format optimized for AI understanding
2. **Consolidated Context**: `home/ai_context` provides everything an AI needs in one call
3. **Semantic Understanding**: Device classifications, capabilities, and relationships
4. **Energy Awareness**: Built-in understanding of solar, battery, and consumption
5. **Action Readiness**: Phase 2 will enable safe, policy-controlled actions

## Roadmap

- ✅ **Phase 1**: Read-only tools (deployed)
- 🚧 **Phase 2**: Service calls with allowlist (in development)
- 📋 **Phase 3**: Audit trails and rollback (planned)
