# Dine-in online ordering — findings

Investigation into whether BoD supports dine-in (eat-in) ordering in addition to pickup, and
what request flags would switch an order to dine-in. Based on the checkout HAR captures at the
repo root.

## Verdict

- **Downgraded:** the live controls show `deliveryType`, `deliveryOption.id`, and `fulfillmentDetails.fulfillmentType` are **not validated** by the probed BoD endpoints before payment. Garbage values were accepted the same way as `dineIn`.
- **`CC_SALE_TRANSACTION_FAILED` is only a weak signal:** it proves some top-level order payload checks passed (missing/malformed `order` failed differently), but it does **not** prove fulfillment fields validated; omitting `deliveryProperties` entirely still reached card processing.
- **Do not expose dine-in for tested cafes.** `dineInConfig.featureEnabled` remains `false`, and the previous “dine-in accepted” conclusion is not reliable evidence of actual dine-in support.


## Validation control experiments (2026-06-27)

Live controls were run against `cafe25` and `bobae` using `server/src/adhoc/investigate-dinein-validation.ts`. Both cafes were unavailable for same-day concepts during the run, so the script used `scheduledDay: 2` (the next available Monday concepts) for the shared cart item/order setup. Within each wait-time control the bodies are identical except `deliveryType`; within each close-order delivery-option control the shared pending order is reused and the bodies are identical except `deliveryProperties.deliveryOption.id` and `deliveryProperties.fulfillmentDetails.fulfillmentType`.

### Control result summary

| Cafe | Experiment | Variant | Status | Response body summary |
|------|------------|---------|--------|-----------------------|
| cafe25 | wait-time deliveryType control | deliveryType=pickup | 200 OK | `{"minTime":{"minutes":11,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}},"maxTime":{"minutes":12,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}}}` |
| cafe25 | wait-time deliveryType control | deliveryType=dineIn | 200 OK | `{"minTime":{"minutes":11,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}},"maxTime":{"minutes":12,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}}}` |
| cafe25 | wait-time deliveryType control | deliveryType=thisIsNotAValidDeliveryType_zzz | 200 OK | `{"minTime":{"minutes":11,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}},"maxTime":{"minutes":12,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}}}` |
| cafe25 | close-order deliveryOption control | pickup id=pickup fulfillmentType=pickupFormFields | 400 Bad Request | `CC_SALE_TRANSACTION_FAILED` |
| cafe25 | close-order deliveryOption control | dineIn id=dineIn fulfillmentType=dineInFormFields | 400 Bad Request | `CC_SALE_TRANSACTION_FAILED` |
| cafe25 | close-order deliveryOption control | garbage id=thisIsNotValid_zzz fulfillmentType=thisIsNotValid_zzz | 400 Bad Request | `CC_SALE_TRANSACTION_FAILED` |
| cafe25 | close-order schema-break control | missing top-level order | 400 Bad Request | `PAYMENT_PAGE_ERROR_TRANSACTION` |
| cafe25 | close-order schema-break control | malformed top-level order string | 400 Bad Request | `ORDER_ID_INVALID` |
| cafe25 | close-order schema-break control | omitted deliveryProperties | 400 Bad Request | `CC_SALE_TRANSACTION_FAILED` |
| bobae | wait-time deliveryType control | deliveryType=pickup | 200 OK | `{"minTime":{"minutes":6,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}},"maxTime":{"minutes":7,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}}}` |
| bobae | wait-time deliveryType control | deliveryType=dineIn | 200 OK | `{"minTime":{"minutes":6,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}},"maxTime":{"minutes":7,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}}}` |
| bobae | wait-time deliveryType control | deliveryType=thisIsNotAValidDeliveryType_zzz | 200 OK | `{"minTime":{"minutes":6,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}},"maxTime":{"minutes":7,"fieldType":{"name":"minutes"},"periodType":{"name":"Minutes"}}}` |
| bobae | close-order deliveryOption control | pickup id=pickup fulfillmentType=pickupFormFields | 400 Bad Request | `CC_SALE_TRANSACTION_FAILED` |
| bobae | close-order deliveryOption control | dineIn id=dineIn fulfillmentType=dineInFormFields | 400 Bad Request | `CC_SALE_TRANSACTION_FAILED` |
| bobae | close-order deliveryOption control | garbage id=thisIsNotValid_zzz fulfillmentType=thisIsNotValid_zzz | 400 Bad Request | `CC_SALE_TRANSACTION_FAILED` |
| bobae | close-order schema-break control | missing top-level order | 400 Bad Request | `PAYMENT_PAGE_ERROR_TRANSACTION` |
| bobae | close-order schema-break control | malformed top-level order string | 400 Bad Request | `ORDER_ID_INVALID` |
| bobae | close-order schema-break control | omitted deliveryProperties | 400 Bad Request | `CC_SALE_TRANSACTION_FAILED` |

### Revised interpretation

- `getWaitTimeForItems` does **not** validate `deliveryType` in these probes: `pickup`, `dineIn`, and `thisIsNotAValidDeliveryType_zzz` all returned HTTP 200 with identical wait-time bodies for both cafes.
- `processPaymentAndClosedOrder` does **not** validate `deliveryOption.id` / `fulfillmentType` before card processing in these probes: `pickup`, `dineIn`, and `thisIsNotValid_zzz` all returned `CC_SALE_TRANSACTION_FAILED` for both cafes.
- Reaching `CC_SALE_TRANSACTION_FAILED` is still meaningful for some unrelated top-level fields: removing top-level `order` returned `PAYMENT_PAGE_ERROR_TRANSACTION`, and replacing top-level `order` with a string returned `ORDER_ID_INVALID`.
- But it is **not** meaningful evidence that fulfillment fields validated: omitting `deliveryProperties` entirely still returned `CC_SALE_TRANSACTION_FAILED` for both cafes.

### Exact request/response log

The exact request bodies, response statuses, and response bodies for every control call (plus the setup `POST /orders` calls that created the pending orders) are saved in `server/src/adhoc/results/dine-in-validation-control-results-2026-06-27.json`.

## Live findings (2026-06-27)

Live probes were run against `cafe25`, `bobae`, `foodhall4`, and `cafe16`. All four still expose dine-in config but keep it disabled: `dineInConfig.featureEnabled: false`, `dineInConfig.kitchenText: "DINE IN"`, `dineInConfig.buttonText: "DINE IN"`, `tableNumberConfig: {}`. Pickup remains enabled.

Lead-time response from `POST /api/sites/107/getKitchenLeadTimesForHomePage` (body `[{ "id": "<contextId>", "timeZone": "PST8PDT" }]`) includes dine-in on every tested site:

| Site | dine-in lead time | pickup lead time | min prep |
|------|-------------------|------------------|----------|
| cafe25 | 10 | 20 | 5 |
| bobae | 15 | 15 | 5 |
| foodhall4 | 15 | 20 | 5 |
| cafe16 | 15 | 20 | 10 |

### Wait-time probe

On cafe25, `POST /api/order/107/b0380cda-899f-492b-88fa-0cbbaf71dc18/getWaitTimeForItems` accepted the dine-in switch:

```json
{
  "cartItems": ["<live cart item>"],
  "varianceEnabled": true,
  "variancePercentage": 5,
  "kitchenContextId": null,
  "deliveryType": "dineIn"
}
```

It returned HTTP 200 with the same normal response shape as pickup (`minTime.minutes: 11`, `maxTime.minutes: 12` in the probe). Adding scheduled fields to the dine-in wait-time request was also accepted.

### Close-order/payment validation probe

A PENDING cafe25 order was created, then `POST /api/order/107/b0380cda-899f-492b-88fa-0cbbaf71dc18/orderId/{orderId}/processPaymentAndClosedOrder` was called with fake payment data and dine-in delivery properties:

```json
{
  "deliveryProperties": {
    "deliveryOption": {
      "id": "dineIn",
      "kitchenText": "DINE IN",
      "displayText": "DINE IN",
      "defaultConfirmationText": "Thank you!",
      "conceptEntries": {},
      "isEnabled": true,
      "orderSequence": 1
    },
    "fulfillmentDetails": {
      "fulfillmentType": "dineInFormFields",
      "tableNumber": "TEST-1"
    },
    "isCutleryEnabled": false,
    "nameCapture": { "firstName": "BoD Test", "lastInitial": "" },
    "nameString": "BoD Test ",
    "tableNumber": "TEST-1"
  },
  "tokenizedData": {
    "paymentDetails": { "apiToken": "00000000-0000-0000-0000-000000000000", "cardIssuer": "visa" },
    "token": "4111111111111111"
  }
}
```

Result:

```json
{ "statusCode": 400, "error": "Bad Request", "message": "CC_SALE_TRANSACTION_FAILED" }
```

The same fake-payment result occurred **without** `tableNumber` in either `deliveryProperties.fulfillmentDetails` or top-level `deliveryProperties`. On the currently tested disabled sites, table number is therefore not validated as required before payment.

### Corrected verdict after validation controls

The earlier close-order/payment conclusion was too strong. The validation controls above show that BoD reaches `CC_SALE_TRANSACTION_FAILED` even when `deliveryOption.id` / `fulfillmentType` are obvious garbage, and even when `deliveryProperties` is omitted. Therefore the fake-card failure does **not** prove dine-in fulfillment fields were validated. It only proves the payload got far enough for payment after some unrelated top-level order checks.

## Evidence that dine-in exists

### `GET /api/config` → `properties.streamLinedHomepage.filters.fulfillmentType`

Enumerates the fulfillment types BoD knows about:

- `dineIn.text: "DINE IN"`
- `pickup.text: "PICKUP"`
- `delivery.text: "DELIVERY"`
- `foodLocker.text: "APEX"`
- (`streamLinedHomepage.featureEnabled: false` on these sites)

HAR refs: `bobae add things to cart.har` entry 15; `cafe25 beef lasagna.har` entry 14;
`ordering the basic foodhall4.buy-ondemand.com.har` entry 2; `trying to check out w vanilla latte fh9.har` entry 14.

### Site-data (`GET /api/sites/{tenantId}` and pay-config POST)

- `dineInConfig: { featureEnabled: false, kitchenText: "DINE IN", buttonText: "DINE IN" }`
- `pickUpConfig.featureEnabled: true`
- `tableNumberConfig: {}`  ← present but empty; dine-in likely needs a table number

HAR refs: `ordering...foodhall4...` entry 7 (GET) / entry 11 (POST); `cafe25 beef lasagna.har`
entry 19 (GET) / entry 23 (POST).

### Lead-time (`POST /api/sites/{tenantId}/getKitchenLeadTimesForHomePage`)

Returns a lead time **per fulfillment mode**, including dine-in:

- foodhall4: `delivery: 15`, `pickup: 20`, `foodLocker: 15`, `dineIn: 15`. `ordering...` entry 9.
- cafe25: `delivery: 27`, `pickup: 20`, `dineIn: 10`. `cafe25 beef lasagna.har` entry 21.

## How pickup is currently encoded (the fields to flip)

- **Wait-time** (`POST .../getWaitTimeForItems`): `deliveryType: "pickup"`.
  Refs: `cafe25...` entries 53/77; `ordering...` entries 53/98; `trying...fh9.har` entry 56.
- **Close-order** (`POST .../processPaymentAndClosedOrder`):
  - `deliveryProperties.deliveryOption.id: "pickup"`
  - `deliveryProperties.deliveryOption.kitchenText` / `displayText: "PICKUP"` / `"PICK-UP"`
  - `deliveryProperties.fulfillmentDetails.fulfillmentType: "pickupFormFields"`
  - Response echoes `properties.fulfillmentType: "pickup"`.
  - Refs: `ordering...` entry 99; `cafe25 beef lasagna.har` entry 78.

In our code these come from `pickUpConfig` (`ordering-context.ts`) and are written in
`complete-order.ts` (`deliveryProperties`) and `wait-time.ts` (`deliveryType: 'pickup'`).

## Hypotheses (UNCONFIRMED — verify Monday)

- **High confidence:** wait-time switches via `deliveryType: "dineIn"`.
- **Likely** close-order switches via:
  - `deliveryProperties.deliveryOption.id: "dineIn"`
  - `deliveryProperties.deliveryOption.kitchenText` / `displayText: "DINE IN"` (from `dineInConfig`)
  - possibly `fulfillmentDetails.fulfillmentType: "dineInFormFields"`
  - possibly a `tableNumber` (see empty `tableNumberConfig`)
- `orderSourceSystem: "onDemand"`, `onDemandTerminalId`, and `checkTypeId`/`check-type` look like
  POS/context identifiers, **not** the dine-in switch.

## Test plan (Monday)

1. Find a site/profile with `dineInConfig.featureEnabled: true` in `GET /api/config`,
   `GET /api/sites/107`, or `POST /api/sites/{contextId}/{displayProfileId}`. (The in-person
   terminal profiles are the most likely place dine-in is enabled.)
2. Compare `getKitchenLeadTimesForHomePage` keys for that site.
3. **Safe probe:** call `POST .../getWaitTimeForItems` with `deliveryType: "dineIn"` vs
   `"pickup"` and confirm it's accepted (this doesn't place an order).
4. **Sandbox/test only:** capture a real dine-in checkout (or carefully test close-order
   payload changes) to confirm `deliveryProperties` / `fulfillmentType` / table-number fields.
   Do **not** run `processPaymentAndClosedOrder` against a production order.

## Implementation sketch (once confirmed)

`deliveryType`/`deliveryOption` is the natural seam. Rather than hard-coding `"pickup"`,
thread an order-type (pickup | dineIn) through the order session so that `wait-time.ts`,
`complete-order.ts` (`deliveryProperties`), and any table-number prompt derive their values
from it. Source the dine-in labels from `dineInConfig` the same way pickup labels come from
`pickUpConfig` today.
