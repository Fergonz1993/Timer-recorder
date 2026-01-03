# Timer Record REST API

The Timer Record dashboard exposes a local REST API at `http://localhost:3000` (default port).

## Quick Start

```bash
# Start the dashboard server
tt dashboard start

# Check status
curl http://localhost:3000/api/status

# Get dashboard data
curl http://localhost:3000/api/data
```

## Endpoints

### GET /api/status

Check if the dashboard server is running.

**Response:**
```json
{
  "status": "running",
  "port": 3000
}
```

### GET /api/data

Get complete dashboard data including active timer, today's summary, and weekly stats.

**Response:**
```json
{
  "activeTimer": {
    "running": true,
    "category": "programming",
    "duration": 3600,
    "startTime": "2026-01-03 10:00:00"
  },
  "today": {
    "totalSeconds": 14400,
    "categories": [
      {
        "name": "programming",
        "seconds": 10800,
        "color": "#61AFEF"
      },
      {
        "name": "debugging",
        "seconds": 3600,
        "color": "#E06C75"
      }
    ]
  },
  "week": {
    "days": [
      { "date": "2025-12-28", "seconds": 28800 },
      { "date": "2025-12-29", "seconds": 25200 },
      { "date": "2025-12-30", "seconds": 30600 },
      { "date": "2025-12-31", "seconds": 18000 },
      { "date": "2026-01-01", "seconds": 0 },
      { "date": "2026-01-02", "seconds": 21600 },
      { "date": "2026-01-03", "seconds": 14400 }
    ]
  }
}
```

### GET /

Returns the HTML dashboard page with auto-refresh every 30 seconds.

## Data Types

### ActiveTimer
| Field | Type | Description |
|-------|------|-------------|
| running | boolean | Whether a timer is currently active |
| category | string \| null | Category name of active timer |
| duration | number | Duration in seconds |
| startTime | string \| null | ISO timestamp when timer started |

### CategorySummary
| Field | Type | Description |
|-------|------|-------------|
| name | string | Category name |
| seconds | number | Total seconds tracked |
| color | string \| null | Hex color code |

### DayStats
| Field | Type | Description |
|-------|------|-------------|
| date | string | Date in YYYY-MM-DD format |
| seconds | number | Total seconds tracked that day |

## Security

- The dashboard binds to `127.0.0.1` (localhost) only
- Not accessible from external network
- No authentication required (local-only access)
- Privacy lockdown mode disables the dashboard entirely

## Configuration

```bash
# Start on custom port
tt dashboard start --port 8080

# Stop the server
tt dashboard stop

# Check status
tt dashboard status
```

## Integration Examples

### JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:3000/api/data');
const data = await response.json();

console.log(`Active: ${data.activeTimer.running}`);
console.log(`Today: ${Math.floor(data.today.totalSeconds / 3600)}h`);
```

### Python

```python
import requests

response = requests.get('http://localhost:3000/api/data')
data = response.json()

print(f"Active: {data['activeTimer']['running']}")
print(f"Today: {data['today']['totalSeconds'] // 3600}h")
```

### Shell/Curl

```bash
# Get active timer status
curl -s http://localhost:3000/api/data | jq '.activeTimer'

# Get today's total hours
curl -s http://localhost:3000/api/data | jq '.today.totalSeconds / 3600'
```

## Raycast/Alfred Integration

You can create quick actions using the API:

```bash
#!/bin/bash
# raycast-timer-status.sh

DATA=$(curl -s http://localhost:3000/api/data)
RUNNING=$(echo $DATA | jq -r '.activeTimer.running')
CATEGORY=$(echo $DATA | jq -r '.activeTimer.category // "none"')

if [ "$RUNNING" = "true" ]; then
  echo "⏱️ $CATEGORY"
else
  echo "⏸️ Not tracking"
fi
```
