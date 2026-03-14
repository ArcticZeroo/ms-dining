# Cafe Hours Investigation Findings

**Date:** Saturday, March 8, 2026 (cafes closed on weekends — affects live API results)

## Summary

The BuyOnDemand API provides rich schedule/hours data via `GET /sites/{tenantId}`. This endpoint is already called implicitly during config retrieval but its hours-related fields are not captured by the current TypeScript types. The concepts endpoint also returns per-concept schedule data (cron expressions + `availableAt`) on weekdays.

---

## 1. HAR File Analysis

**Files analyzed:** 5 HAR files from `foodhall4.buy-ondemand.com` captures (weekday sessions).

### Key schedule endpoints found in HAR data:

| Endpoint | Schedule Data |
|---|---|
| `GET /config` | `showOperationTimes`, `properties.scheduledOrdering`, `properties.streamLinedHomepage.closedText` |
| `GET /sites/{tenantId}` | `availableAt`, `allAvailableList`, `nextAvailableAt`, `timeZone` |
| `POST /sites/{tenantId}/{contextId}/concepts/{displayProfileId}` | Per-concept `availableAt`, `openScheduleExpression`, `closeScheduleExpression`, `schedule[]` |
| `GET /sites/{tenantId}/getKitchenLeadTimesForHomePage` | Lead times for delivery/pickup/dineIn |

### Config (`GET /config`) schedule fields:
```json
{
  "showOperationTimes": true,
  "properties": {
    "scheduledOrdering": {
      "bufferTime": 30,        // minutes before ordering cutoff
      "intervalTime": 15,      // time slot granularity in minutes
      "headerText": "Dining at Microsoft Online Ordering",
      "errorText": "."
    },
    "streamLinedHomepage": {
      "results": { "showHours": true },
      "closedText": "Sorry we're closed for now. Please try again tomorrow."
    }
  }
}
```

### Site data (`GET /sites/{tenantId}`) — **PRIMARY SOURCE OF HOURS**:
```json
{
  "timeZone": "PST8PDT",
  "storeAvailabeNow": true,     // note: misspelled in API
  "availableAt": {
    "opens": "8:00 am",
    "closes": "2:00 pm",
    "availableNow": true,
    "availableLater": false,
    "conceptsAvailableNow": true,
    "closingIn": 4,             // minutes until closing (negative = closed)
    "openWindowTimeFrames": [
      { "opens": "8:00 am", "closes": "2:00 pm" }
    ]
  },
  "allAvailableList": [
    {
      "day": "MON",
      "index": 0,
      "availableAt": { /* same structure as above */ }
    }
  ],
  "nextAvailableAt": {
    "day": "MON",
    "index": 2,
    "availableAt": { /* same structure */ }
  }
}
```

### Concepts endpoint schedule (from HAR weekday data):
```json
{
  "name": "Diner",
  "availableAt": {
    "open": "11:00 am",         // NOTE: "open"/"close" not "opens"/"closes"
    "close": "2:00 pm",
    "time": 3
  },
  "openScheduleExpression": "0 0 11 * * MON",
  "closeScheduleExpression": "0 0 14 * * MON",
  "schedule": [
    {
      "@c": ".DisplayProfileTask",
      "scheduledExpression": "0 0 8 * * MON",       // cron: sec min hour dom month dow
      "properties": { "meal-period-id": "1" },
      "displayProfileState": {
        "displayProfileId": "5341",
        "conceptStates": [{ "conceptId": "10975", "menuId": "16795" }]
      }
    },
    {
      "@c": ".TransitionTask",
      "scheduledExpression": "0 0 14 * * MON",      // closing time
      "properties": { "TRANSITION_MESSAGE": "" }
    }
  ]
}
```

---

## 2. Live API Results (Saturday — cafes closed)

### Endpoint: `GET /sites/{tenantId}` — Works for all cafes

| Cafe | Today (SAT) `availableAt` | `nextAvailableAt` Day | Next Open Hours | Time Windows |
|---|---|---|---|---|
| Food Hall 4 | `opens:"" closes:"" availableNow:false` | MON (index 2) | 8:00 am–2:00 pm | 3 windows: 8–10am, 10–11am, 11am–2pm |
| MiLa (FH4) | `opens:"" closes:"" availableNow:false` | MON (index 2) | 11:00 am–2:00 pm | 1 window: 11am–2pm |
| Café 16 | `opens:"" closes:"" availableNow:false` | MON (index 2) | 7:30 am–3:00 pm | 5 windows: 7:30–8, 8–10, 10–11, 11–2, 2–3 |
| Café 25 | `opens:"11:58 pm" closes:"12:00 am"` ⚠️ | SAT (index 0) | 11:58 pm–12:00 am | Placeholder/dummy schedule |
| Café 40/41 | `opens:"11:58 pm" closes:"12:00 am"` ⚠️ | SAT (index 0) | 11:58 pm–12:00 am | Placeholder/dummy schedule |
| Chandy's | `opens:"" closes:"" availableNow:false` | MON (index 2) | 7:00 am–2:00 pm | 2 windows: 7–10am, 10am–2pm |
| Boardwalk | `opens:"" closes:"" availableNow:false` | MON (index 2) | 11:00 am–7:00 pm | 2 windows: 11am–1:30pm, 3–7pm (lunch+dinner gap!) |
| Food Hall 6 | `opens:"" closes:"" availableNow:false` | MON (index 2) | 8:00 am–2:00 pm | 3 windows: 8–10am, 10–11am, 11am–2pm |

### Key observations:
- **When closed today:** `availableAt.opens` and `closes` are empty strings, `availableNow: false`, `closingIn: -1`
- **Café 25 & 40/41 have a weird `11:58 pm–12:00 am` placeholder** — these might be configured to always appear "available later" or have a different scheduling setup
- **`nextAvailableAt`** always shows the NEXT day the cafe will be open (skips weekends)
- **`openWindowTimeFrames`** shows meal period boundaries (breakfast/lunch/dinner), not just overall open/close
- **All concepts return 410 (Gone)** on Saturday — the cafe is completely closed
- **`scheduledDay=2` (Monday) returns 500** — future day scheduling beyond 1 day may not be supported without calendar scheduling enabled

### Endpoint: `GET /sites/{tenantId}/{contextId}` — Returns 404

This path does NOT work. The correct path is just `/sites/{tenantId}`.

### Endpoint: `POST concepts` — Returns 410 when closed

On Saturday, ALL cafes return HTTP 410 (Gone) for the concepts endpoint regardless of `scheduleTime` or `scheduledDay` values. This is already handled in the code (returns empty array).

---

## 3. Data Format Summary

### Time format
- Human-readable 12-hour format: `"8:00 am"`, `"2:00 pm"`, `"11:00 am"`
- Lowercase am/pm
- No leading zeros on hours

### Days of week
- Three-letter uppercase: `"MON"`, `"SAT"`, `"SUN"`, etc.

### Cron expressions (concepts endpoint)
- Spring-style 6-field cron: `"0 0 11 * * MON"` → `sec min hour dom month dow`
- Day of week uses three-letter abbreviation

### Open window time frames
- Array of `{ opens: string, closes: string }` objects
- Multiple windows = multiple meal periods (breakfast, lunch, dinner)
- Contiguous windows (no gaps) = same effective period
- Non-contiguous windows (with gaps) = separate service periods (e.g., Boardwalk lunch 11–1:30, dinner 3–7)

---

## 4. When a Cafe Is Closed Today

The `/sites/{tenantId}` endpoint still returns successfully (HTTP 200), but:
- `availableAt.opens` = `""` (empty string)
- `availableAt.closes` = `""` (empty string)
- `availableAt.availableNow` = `false`
- `availableAt.closingIn` = `-1`
- `allAvailableList[0].day` = today's day abbreviation
- `nextAvailableAt.day` = the next day the cafe IS open (e.g., `"MON"`)
- `nextAvailableAt.availableAt` = full schedule for that next-open day

The concepts endpoint returns **HTTP 410 Gone** — the existing code already handles this correctly.

---

## 5. Proposed Schema

### New TypeScript interfaces for site hours data:

```typescript
interface IOpenWindowTimeFrame {
    opens: string;    // e.g. "8:00 am"
    closes: string;   // e.g. "2:00 pm"
}

interface IAvailableAt {
    opens: string;
    closes: string;
    availableNow: boolean;
    availableLater?: boolean;
    conceptsAvailableNow?: boolean;
    closingIn: number;                           // minutes, -1 when closed
    openWindowTimeFrames?: IOpenWindowTimeFrame[];
}

interface IDayAvailability {
    day: string;             // "MON", "TUE", etc.
    index: number;           // 0-based offset from today
    availableAt: IAvailableAt;
}

interface ISiteScheduleData {
    timeZone: string;                          // e.g. "PST8PDT"
    storeAvailabeNow: boolean;                 // note: misspelled in API
    availableAt: IAvailableAt;                 // today's hours
    allAvailableList: IDayAvailability[];       // today's day entry
    nextAvailableAt: IDayAvailability;          // next open day
}
```

### Proposed implementation plan:

1. **Add `ISiteScheduleData` types** to `server/src/models/buyondemand/config.ts` or a new `schedule.ts` file.

2. **Add a `getSiteScheduleAsync()` method** to `BuyOnDemandClient` that calls `GET /sites/{tenantId}` and extracts the schedule fields (`availableAt`, `allAvailableList`, `nextAvailableAt`, `timeZone`).

3. **Replace the hardcoded `scheduleTime`** in `stations.ts`:
   - The `scheduleTime` sent to the concepts endpoint should use the site's actual operating hours.
   - Use `availableAt.opens` and the last `openWindowTimeFrames[].closes` to get the full day range.
   - If `availableAt.opens` is empty (closed today), either skip or use `nextAvailableAt`.

4. **Expose hours to the frontend** — add schedule data to the cafe response so the UI can show operating hours.

5. **Handle edge cases:**
   - Empty `opens`/`closes` strings (closed today)
   - Placeholder schedules like `11:58 pm–12:00 am` (Café 25, 40/41)
   - Multiple meal-period windows (Boardwalk lunch/dinner gap)
   - The `closingIn` field (negative = already closed)

---

## 6. Caveats

- **This investigation was run on Saturday** — all tested cafes were closed. The `availableAt` shows empty hours for today. Weekday responses will show active hours with `availableNow: true` and populated time frames.
- **Café 25 and Café 40/41** show unusual `11:58 pm–12:00 am` schedules on Saturday — these may be misconfigured or use a different scheduling model. Worth investigating on a weekday.
- **The concepts endpoint schedule/cron data** was only visible in HAR files (weekday captures). On weekends, the concepts endpoint returns 410 before any data is returned.
- **All cafes share `tenantId=107`** — this is the Microsoft dining tenant. The `contextId` and `displayProfileId` vary per cafe.
- **`scheduledDay=2` returns HTTP 500** — future day scheduling beyond tomorrow doesn't seem supported with current config (`isFutureSchedulingEnabled: false`).
