# Scheduled pickup — findings

Investigation into how Buy On Demand (BoD) scheduled (future-time) pickup works, based on
the checkout HAR captures at the repo root. Goal: find the config that drives first/last
pickup time and time-block granularity, and the request params we'd need to send to schedule
a pickup instead of ordering ASAP.

## Verdict

- **Live config confirms same-day scheduling is enabled** on cafe25, bobae, foodhall4, and cafe16 (`isScheduleOrderEnabled: true`, future/calendar scheduling disabled).
- **The API accepts the scheduled-field candidates through order creation and close-order param validation**: `scheduleType`, `scheduleTime`, `daysToAdd`, `timezone`, `calendarDaysToAdd`; close-order also accepts `scheduledTime`/`scheduledDay`.
- **Remaining caveat:** fake-card close-order stops at `CC_SALE_TRANSACTION_FAILED`, so a successful paid scheduled order still has not echoed which scheduled-time spelling BoD persists. Send both `scheduleTime` and `scheduledTime` at close until a successful scheduled HAR is captured.


## Live findings (2026-06-27)

Live probes were run against `cafe25`, `bobae`, `foodhall4`, and `cafe16` with anonymous auth. `POST /api/sites/107/getKitchenLeadTimesForHomePage` must use the browser body shape `[{ "id": "<contextId>", "timeZone": "PST8PDT" }]`; posting `{}` returns HTTP 500.

| Site | contextId | `bufferTime` | `intervalTime` | lead times | min prep |
|------|-----------|--------------|----------------|------------|----------|
| cafe25 | `b0380cda-899f-492b-88fa-0cbbaf71dc18` | 20 | 15 | `delivery:27`, `pickup:20`, `dineIn:10` | 5 |
| bobae | `d80bcb86-03bc-4fd2-be1b-afd5046519c3` | 30 | 15 | `delivery:15`, `pickup:15`, `foodLocker:15`, `dineIn:15` | 5 |
| foodhall4 | `8cf3ef7a-4781-40c0-a40e-49d765bd0967` | 30 | 15 | `delivery:15`, `pickup:20`, `foodLocker:15`, `dineIn:15` | 5 |
| cafe16 | `75a4ba14-102d-4d26-aa73-e3d22d59706f` | 20 | 15 | `delivery:28`, `pickup:20`, `dineIn:15` | 10 |

All four sites returned `todaySchedulingEnabled: true`, `isScheduleOrderEnabled: true`, `isAsapOrderDisabled: false`, `isFutureSchedulingEnabled: false`, `isCalendarSchedulingEnabled: false`, `futureScheduledDays: 0`. So the live config still supports same-day scheduled ordering only.

### Scheduled pickup request probes

Using live cafe25 menu data, the probe selected an orderable item (`Espresso con Panna`) from station `Onda Origins`. The concepts endpoint accepts the browser-style schedule body:

```json
POST /api/sites/107/b0380cda-899f-492b-88fa-0cbbaf71dc18/concepts/1596
{ "scheduleTime": { "startTime": "11:00 AM", "endTime": "11:15 PM" }, "scheduledDay": 0 }
```

`POST /api/order/107/b0380cda-899f-492b-88fa-0cbbaf71dc18/getWaitTimeForItems` accepted both ASAP pickup and scheduled pickup bodies. The scheduled body added these fields:

```json
{
  "deliveryType": "pickup",
  "scheduleType": "laterToday",
  "scheduleTime": "11:15 AM - 11:30 AM",
  "daysToAdd": 0,
  "timezone": "PST8PDT",
  "calendarDaysToAdd": 0,
  "scheduledDay": 0
}
```

The response stayed the normal min/max wait-time shape (`minTime.minutes: 11`, `maxTime.minutes: 12` in the probe), so wait-time accepts these fields but does not echo or visibly transform the selected slot.

`POST /api/order/{tenant}/{context}/orders` accepted two scheduled candidate create bodies:

1. UI-state field names: `scheduleType`, `scheduleTime`, `daysToAdd`, `timezone`, `calendarDaysToAdd`.
2. Close/payment-style alias: `scheduledTime`, `daysToAdd`, `timezone`, `calendarDaysToAdd`.

Both returned HTTP 200 and created only PENDING orders. The order response did **not** echo the scheduled fields at top level; the only schedule-ish response properties were the normal concept window cron strings, e.g. `openScheduleExpression: "0 0 11 * * FRI"` and `closeScheduleExpression: "0 0 14 * * FRI"`.

`POST /api/order/{tenant}/{context}/orderId/{orderId}/processPaymentAndClosedOrder` was then called with obviously fake payment data. Both top-level scheduled variants were accepted through fulfillment/order validation and failed at card sale:

```json
// variant A
{ "scheduleType": "laterToday", "scheduleTime": "11:15 AM - 11:30 AM", "daysToAdd": 0, "timezone": "PST8PDT", "calendarDaysToAdd": 0 }

// variant B
{ "scheduledTime": "11:15 AM - 11:30 AM", "scheduledDay": 0, "daysToAdd": 0, "timezone": "PST8PDT", "calendarDaysToAdd": 0 }

// response for both
{ "statusCode": 400, "error": "Bad Request", "message": "CC_SALE_TRANSACTION_FAILED" }
```

This confirms order/fulfillment params are validated before card processing and these scheduled fields are not rejected before the payment stage. The CDN bundle maps the scheduler UI state as `{ scheduleType, scheduleTime, daysToAdd, timezone, calendarDaysToAdd }`; later pages receive `scheduledTime` from `scheduleOrderData.scheduleTime` and `scheduledDay` from `scheduleOrderData.calendarDaysToAdd`.

### Updated verdict

We can implement same-day scheduled pickup slot selection using the UI-state values above and send them through wait-time/create-order/close-order. The live API accepts the fields and reaches payment validation. Remaining limitation: because fake card data intentionally stops at `CC_SALE_TRANSACTION_FAILED`, the server never returns a successful closed scheduled order, so it does not conclusively prove whether BoD persists `scheduleTime` or `scheduledTime` on a paid close; send both names at close for maximum compatibility until a real scheduled checkout HAR confirms the final successful payload.

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
