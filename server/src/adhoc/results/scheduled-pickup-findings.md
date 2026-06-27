# Scheduled pickup — findings

Investigation into how Buy On Demand (BoD) scheduled (future-time) pickup works, based on
the checkout HAR captures at the repo root. Goal: find the config that drives first/last
pickup time and time-block granularity, and the request params we'd need to send to schedule
a pickup instead of ordering ASAP.

## Verdict

- **We have enough to *describe* scheduling and generate candidate slots**: the config that
  governs slot interval, buffer/lead time, and the open/close windows is all present in the
  HARs.
- **We do NOT have enough to *implement* a scheduled checkout end-to-end.** Every captured
  order is ASAP/now — no HAR contains a request that actually books a future slot, so we
  can't see the exact request field(s) that flip an order from ASAP to scheduled.
- **Action required Monday:** capture a real "schedule for later" checkout and diff the
  create-order / wait-time / close-order bodies against an ASAP order (see Test plan below).

## Where the scheduling config lives

### `GET /api/config` → `properties.scheduledOrdering`

This is the primary scheduling config. Observed values:

| Site | `bufferTime` | `intervalTime` | Other |
|------|-------------|----------------|-------|
| bobae | 30 | 15 | `timeSlotReservation.featureEnabled: false`, `slotFreezeTimeInMinutes: 10` |
| cafe25 | 20 | 15 | — |
| foodhall4 | 30 | 15 | `timeSlotReservation.featureEnabled: false` |
| foodhall9 | 30 | 15 | `timeSlotReservation.featureEnabled: false` |

- `intervalTime` = **time-block granularity in minutes** (15-minute slots in every captured site).
- `bufferTime` = minutes of lead/buffer before the earliest selectable slot.
- HAR refs: `bobae add things to cart.har` entry 15; `cafe25 beef lasagna.har` entry 14;
  `ordering the basic foodhall4.buy-ondemand.com.har` entry 2; `trying to check out w vanilla latte fh9.har` entry 14
  (all `GET .../api/config`).

> NOTE: `/api/config` is a BoD endpoint we do **not** currently fetch. The scheduling config
> is not in our `site-data` (`GET /api/sites/{tenantId}`) or `pay-config` responses, so adding
> scheduling means fetching `/api/config` too.

### Scheduling feature flags (in site-data / pay-config responses)

- `todaySchedulingEnabled: true`
- `isScheduleOrderEnabled: true`
- `isAsapOrderDisabled: false`
- `isFutureSchedulingEnabled: false`  ← future (multi-day) scheduling is OFF on these sites
- `isCalendarSchedulingEnabled: false`
- `futureScheduledDays: 0`

So today these sites support **same-day** scheduling only (pick a later slot today), not
multi-day. HAR refs: pay-config POSTs — `cafe25 beef lasagna.har` entry 23, `bobae...` entry 24,
`foodhall4...` entry 11, `foodhall9...` entry 23.

### Open/close windows (for slot bounds) — `GET /api/sites/{tenantId}`

`availableAt.opens` / `closes` plus per-window ranges:

- bobae: opens `11:00 am`, closes `4:00 pm` (windows 11–2, 2–4). `bobae...` entry 20.
- cafe25: opens `7:30 am`, closes `2:00 pm` (windows 7:30–8, 8–10, 10–11, 11–2). `cafe25...` entry 19.
- foodhall4: opens `8:00 am`, closes `2:00 pm`. `ordering...foodhall4...` entry 7.
- foodhall9: opens `7:30 am`, closes `3:00 pm`. `trying...fh9.har` entry 19.

### Lead time — `POST /api/sites/{tenantId}/getKitchenLeadTimesForHomePage`

- bobae: `leadTime.pickup: 15`, `minimumItemPreparationTimeInMinutes: 5`. `bobae...` entry 22.
- cafe25: `leadTime.pickup: 20`, `minimumItemPreparationTimeInMinutes: 5`. `cafe25...` entry 21.
- foodhall4: `leadTime.pickup: 20`, min prep 5. `ordering...` entry 9.
- foodhall9: `leadTime.pickup: 20`, min prep 10. `trying...fh9.har` entry 21.

### Slot generation (inferred)

First selectable slot ≈ `now + max(bufferTime, leadTime.pickup, minimumItemPreparationTime)`
rounded up to the next `intervalTime` boundary; last slot ≈ `closes - intervalTime`; slots
spaced every `intervalTime` minutes within the open/close window. **This is inferred and must
be confirmed against the real UI's slot list Monday.**

## Request params

All captured orders are ASAP. The ASAP create-order
(`POST /api/order/{tenant}/{context}/orders`, e.g. `cafe25 beef lasagna.har` entry 52) sends:

- `scheduledDay: 0`
- `orderTimeZone: "PST8PDT"`
- `conceptSchedule.openScheduleExpression` / `closeScheduleExpression` as cron, e.g.
  `"0 0 11 * * THU"` / `"0 0 14 * * THU"`
- **No** `scheduleTime` / `scheduledTime` / `scheduleType` / `isAsap` field.

Wait-time (`POST .../getWaitTimeForItems`) sends `deliveryType: "pickup"`, `kitchenContextId: null`,
no time field. Close-order (`POST .../processPaymentAndClosedOrder`) sends `scheduledDay: 0` and
`deliveryProperties.fulfillmentDetails.fulfillmentType: "pickupFormFields"`, no time field.

The CDN JS bundle (`cafe25 beef lasagna.har` entry 9) references UI state named `scheduleType`,
`scheduleTime` (values shaped like `"h:mm A - h:mm A"`), `daysToAdd`, `timezone`,
`calendarDaysToAdd` — these are the most likely request fields once a slot is selected, but we
have not seen them on the wire.

## Test plan (Monday)

Capture a checkout where you select a future time slot, then diff against an ASAP order:

1. `GET /api/config` — confirm `scheduledOrdering.intervalTime` / `bufferTime` for the cafe.
2. `POST /api/order/{tenant}/{context}/orders` — look for new/changed fields: `scheduleType`,
   `scheduleTime`, `scheduledTime`, `scheduledDay`, `calendarDaysToAdd`, `daysToAdd`,
   `timezone`, and whether `conceptSchedule` cron changes.
3. `POST .../getWaitTimeForItems` — does it gain a scheduled-time field?
4. `POST .../processPaymentAndClosedOrder` — **sandbox/test only**, never run against a real
   order. Look for the scheduled-time field in `deliveryProperties` / top-level.

Also note whether the slot list the UI renders matches the `intervalTime`/`bufferTime`/window
math above so we can replicate slot generation client-side without a dedicated endpoint.
