# Testing Phase 3: Audit & Traces

## Overview
Phase 3 adds action logging, AI suggestions, and rollback capabilities to track all AI assistant actions and provide smart recommendations.

## How to Test

### 1. Action Logging

**Automatic Logging:**
All AI assistant actions are automatically logged when you use the AI chat.

**Test Steps:**
1. Open the **Floating Chat** (bottom-right corner)
2. Ask AI to control a device:
   - "Turn on the living room light"
   - "Set thermostat to 22 degrees"
   - "Turn off all lights"
3. Actions are logged automatically with:
   - Timestamp
   - Entity & Service
   - AI's reasoning
   - Success/Failure
   - Response time

**View Logs via Browser Console:**
```javascript
// Open browser console (F12)
import { auditService } from './services/auditService';

// Get last 50 action logs
const logs = await auditService.getActionLogs(50);
console.log(logs);

// Get history for specific entity
const history = await auditService.getEntityHistory('light.living_room');
console.log(history);

// Get statistics
const stats = await auditService.getActionStats();
console.log(stats);
```

### 2. AI Suggestions

**Location:** Overview page (main dashboard)

**Test Steps:**
1. Go to **Overview** page
2. Scroll to bottom to see "AI Suggestions" section
3. Click **"Generate Suggestions"** button
4. AI analyzes:
   - Your usage patterns
   - Energy consumption
   - Frequent manual controls
   - Lights left on

**Generated Suggestions Include:**
- 🔋 **Energy** - High power consumption alerts, cost-saving tips
- 🛡️ **Security** - Lights left on warnings
- ⚡ **Convenience** - Automation opportunities for repeated actions
- 🛠️ **Maintenance** - Device optimization
- ✨ **Comfort** - Environment improvements

**Actions You Can Take:**
- **Accept** - Mark suggestion as good
- **Reject** - Dismiss suggestion
- **Implement** - Mark as implemented
- **Filter** - View by status (Pending/Accepted/Implemented)

**Example Suggestions:**
```
Title: "High Power Consumption Detected"
Description: "3 device(s) are consuming over 1kW. Consider scheduling
             usage during off-peak hours to reduce costs."
Confidence: 85%
Impact: High
Category: Energy
Entities: [heater.living_room, ac.bedroom, water_heater.main]
```

### 3. Testing Suggestion Generation

**Manual Testing:**
1. Control entities multiple times manually
2. Leave some lights on
3. Generate suggestions
4. Should see suggestions about:
   - Frequent manual controls → automation recommendations
   - Multiple lights on → energy optimization
   - High power devices → cost savings

### 4. Database Queries

**Check Data Directly:**
```sql
-- View action logs
SELECT * FROM action_logs
ORDER BY created_at DESC
LIMIT 10;

-- View suggestions
SELECT * FROM ai_suggestions
WHERE status = 'pending'
ORDER BY created_at DESC;

-- View rollback points
SELECT * FROM rollback_points
ORDER BY created_at DESC;
```

### 5. Rollback Points (Advanced)

**Via Browser Console:**
```javascript
import { auditService } from './services/auditService';

// Create rollback point
await auditService.createRollbackPoint(
  'action_log_id_here',
  { 'light.bedroom': 'on', 'climate.home': '22' },
  'Before AI optimization'
);

// View available rollback points
const points = await auditService.getRollbackPoints();
console.log(points);
```

## Expected Results

### After Using AI Chat:
- ✅ Actions logged in `action_logs` table
- ✅ Timing data recorded (duration_ms)
- ✅ Success/failure tracked
- ✅ AI reasoning saved

### After Generating Suggestions:
- ✅ Smart recommendations appear
- ✅ Each has confidence score (0-1)
- ✅ Each has impact level (high/medium/low)
- ✅ Entities involved are listed
- ✅ Can accept/reject/implement

### Suggestion Triggers:
- **5+ manual controls** on same entity → automation suggestion
- **High power device** (>1kW) → cost-saving suggestion
- **5+ lights on** simultaneously → optimization suggestion

## Troubleshooting

**No suggestions appearing?**
- Click "Generate Suggestions" button
- Control some entities first to create patterns
- Check browser console for errors

**No action logs?**
- Use AI chat to control devices (not manual toggle)
- Check Supabase database tables exist
- Verify user is authenticated

**Suggestions not saving?**
- Check browser console for errors
- Verify Supabase connection
- Check RLS policies are enabled

## API Reference

### auditService Methods

```typescript
// Log an action
await auditService.logAction({
  action_type: 'service_call',
  entity_id: 'light.living_room',
  service: 'light.turn_on',
  data: { brightness: 255 },
  reason: 'User requested via AI',
  source: 'ai_assistant',
  success: true,
  duration_ms: 150
});

// Get logs
const logs = await auditService.getActionLogs(50, 0);

// Get entity history
const history = await auditService.getEntityHistory('light.living_room', 20);

// Get statistics
const stats = await auditService.getActionStats();

// Create suggestion
await auditService.createSuggestion({
  suggestion_type: 'automation',
  title: 'Automate bedroom light',
  description: 'Create schedule based on usage pattern',
  confidence: 0.85,
  impact: 'medium',
  category: 'convenience',
  entities_involved: ['light.bedroom'],
  status: 'pending'
});

// Get suggestions
const suggestions = await auditService.getSuggestions('pending');

// Update suggestion status
await auditService.updateSuggestionStatus(id, 'implemented');
```

## Integration Points

### Auto-Logging in AI Assistant
- Located in: `src/services/unifiedAIService.ts`
- Lines: 100-136
- Every AI action is automatically logged

### Suggestions UI
- Component: `src/components/AISuggestions.tsx`
- Shown on: Overview page
- Features: Generate, filter, accept/reject/implement

### Database Schema
- Tables: `action_logs`, `ai_suggestions`, `rollback_points`
- Location: `supabase/migrations/20251013050040_create_audit_and_suggestions.sql`
- RLS: Enabled with user-specific policies

## Quick Test Checklist

- [ ] Open Floating Chat
- [ ] Ask AI to turn on a light
- [ ] Go to Overview page
- [ ] Click "Generate Suggestions"
- [ ] See suggestions appear
- [ ] Click "Accept" on a suggestion
- [ ] Filter by "Accepted" status
- [ ] Verify suggestion status changed
- [ ] Open browser console
- [ ] Run: `await auditService.getActionLogs(10)`
- [ ] Verify logs contain AI actions
