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

Note: Opening the endpoint URL in a browser (GET) will return a friendly JSON status message. Actual requests must be POST with a JSON body as shown above; otherwise you'll see a 400 Bad Request.

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

## Phase 2: Actions ✅ (Active)

### `home/call_service` - Execute Home Assistant Service Calls

Call Home Assistant services with strict allowlist enforcement.

**Request:**
```json
{
  "method": "home/call_service",
  "params": {
    "domain": "light",
    "service": "turn_on",
    "entity_id": "light.living_room",
    "data": {
      "brightness": 255,
      "rgb_color": [255, 0, 0]
    }
  },
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
    "success": true,
    "service": "light.turn_on",
    "entity_id": "light.living_room",
    "data": {
      "brightness": 255,
      "rgb_color": [255, 0, 0]
    },
    "result": [...]
  }
}
```

### Allowed Services

Phase 2 implements a strict allowlist of safe services:

**Lights:**
- `light.turn_on`
- `light.turn_off`
- `light.toggle`

**Switches:**
- `switch.turn_on`
- `switch.turn_off`
- `switch.toggle`

**Climate:**
- `climate.set_temperature`
- `climate.set_hvac_mode`
- `climate.turn_on`
- `climate.turn_off`

**Covers:**
- `cover.open_cover`
- `cover.close_cover`
- `cover.stop_cover`
- `cover.set_cover_position`

**Fans:**
- `fan.turn_on`
- `fan.turn_off`
- `fan.toggle`
- `fan.set_percentage`

**Media Players:**
- `media_player.turn_on`
- `media_player.turn_off`
- `media_player.toggle`
- `media_player.volume_set`
- `media_player.media_play`
- `media_player.media_pause`
- `media_player.media_stop`

**Automation & Scripts:**
- `scene.turn_on`
- `script.turn_on`
- `automation.trigger`
- `automation.turn_on`
- `automation.turn_off`

**Helpers:**
- `input_boolean.turn_on`
- `input_boolean.turn_off`
- `input_boolean.toggle`
- `input_number.set_value`
- `input_select.select_option`
- `input_text.set_value`

### Safety Features

1. **Allowlist Enforcement:** Only services in the allowlist can be called
2. **Error Handling:** Clear error messages for unauthorized services
3. **Parameter Validation:** Required parameters are validated
4. **Atomic Operations:** Service calls either succeed completely or fail

### Examples

**Turn on a light with brightness:**
```json
{
  "method": "home/call_service",
  "params": {
    "domain": "light",
    "service": "turn_on",
    "entity_id": "light.bedroom",
    "data": {
      "brightness": 128
    }
  },
  "ha_config": {...}
}
```

**Set climate temperature:**
```json
{
  "method": "home/call_service",
  "params": {
    "domain": "climate",
    "service": "set_temperature",
    "entity_id": "climate.living_room",
    "data": {
      "temperature": 22
    }
  },
  "ha_config": {...}
}
```

**Trigger an automation:**
```json
{
  "method": "home/call_service",
  "params": {
    "domain": "automation",
    "service": "trigger",
    "entity_id": "automation.evening_lights"
  },
  "ha_config": {...}
}
```

## Phase 3: Audit & Traces ✅ (Active)

Phase 3 adds comprehensive logging, audit trails, and AI-powered suggestions.

### Action Logging

All AI-initiated actions are automatically logged with:
- **Timestamp** - When the action occurred
- **Entity & Service** - What was controlled
- **Reason** - AI's explanation for the action
- **Source** - ai_assistant, user_manual, automation, or voice
- **Success/Failure** - Action outcome with error details
- **Duration** - Response time in milliseconds
- **Before/After States** - State changes for rollback

**Usage:**
```typescript
import { auditService } from './services/auditService';

// Logs are created automatically by unifiedAIService
// View logs:
const logs = await auditService.getActionLogs(50);
const history = await auditService.getEntityHistory('light.living_room');
const stats = await auditService.getActionStats();
```

### AI Suggestions System

The system generates smart suggestions based on:
- **Usage Patterns** - Frequent manual controls → automation suggestions
- **Energy Analysis** - High consumption → cost-saving recommendations
- **Security** - Lights left on → optimization suggestions
- **Behavioral Learning** - Repeated actions → convenience improvements

**Suggestion Categories:**
- 🔋 **Energy** - Cost savings and efficiency
- 🛡️ **Security** - Safety and protection
- ⚡ **Convenience** - Automation opportunities
- 🛠️ **Maintenance** - Device health and optimization
- ✨ **Comfort** - Environment improvements

**Viewing Suggestions:**
- Suggestions appear on the Overview page
- Filter by status: Pending, Accepted, Implemented
- Each suggestion includes confidence score and impact level
- Accept, reject, or implement with one click

**Generating Suggestions:**
```typescript
// Manual generation
const suggestions = await auditService.generateSmartSuggestions(entities, actionLogs);

// Suggestions include:
// - title, description, confidence (0-1), impact (high/medium/low)
// - entities_involved, category, supporting data
// - status tracking (pending/accepted/rejected/implemented)
```

### Rollback Points

Create restore points before risky actions:
```typescript
await auditService.createRollbackPoint(
  actionLogId,
  { 'light.bedroom': 'on', 'climate.home': '22' },
  'Before AI optimization'
);

// List available rollbacks
const points = await auditService.getRollbackPoints();
```

### Analytics & Insights

**Action Statistics:**
- Total actions by source (AI, manual, automation)
- Success/failure rates
- Average response times
- Entity-specific history

**Smart Suggestions:**
- Pattern-based automation recommendations
- Energy optimization opportunities
- Security improvements
- Convenience enhancements

### Implementation Status
- ✅ **Database Schema** - Complete with RLS policies
- ✅ **Action Logging Service** - Auto-logging in unifiedAIService
- ✅ **AI Suggestions Engine** - Pattern analysis and generation
- ✅ **Rollback System** - Create and restore points
- ✅ **UI Components** - AISuggestions component with filtering
- ✅ **Overview Integration** - Suggestions shown on main dashboard

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

### Completed
- ✅ **Phase 1**: Read-only tools - DEPLOYED
  - All read endpoints functional
  - AI context optimization
  - Energy data aggregation

- ✅ **Phase 2**: Service calls with allowlist - DEPLOYED
  - 40+ allowed services across all major domains
  - Allowlist enforcement with clear error messages
  - Parameter validation
  - Full integration with AI assistant

### In Progress
- 🔄 **AI Learning System** - ACTIVE
  - Entity alias learning from interactions
  - Command pattern recognition
  - Confidence scoring and usage tracking
  - Pattern-based context enhancement

### Planned
- 📋 **Phase 3**: Audit trails and rollback
  - Action logging with reasoning
  - Complete audit trail
  - Rollback capabilities
  - Historical analysis and reporting
