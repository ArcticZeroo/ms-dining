# Dine-in online ordering — findings

Investigation into whether BoD supports dine-in (eat-in) ordering in addition to pickup, and
what request flags would switch an order to dine-in. Based on the checkout HAR captures at the
repo root.

## Verdict

- **BoD definitely has a dine-in concept** — it's enumerated in config, site-data, and
  lead-time responses across every captured site.
- **But it is disabled on all captured sites** (`dineInConfig.featureEnabled: false`), and no
  HAR contains a dine-in order, so we cannot confirm the exact request payload that books a
  dine-in order.
- **Action required Monday:** find a site/profile where dine-in is enabled (or test the
  hypothesized flags against the wait-time endpoint, which is safe) and capture a dine-in
  order to confirm the close-order payload. See Test plan.

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
