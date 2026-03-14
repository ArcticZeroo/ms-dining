# Design Justification — feature/rguest-popup

## 1. Two-Phase Prepare/Complete vs Single Endpoint

**Chosen:** Split the ordering flow into `POST /order/prepare` (creates order, returns iframe URL) and `POST /order/complete` (submits payment token + card info to close the order).

**Why it's right:** The rguest payment system requires a browser-hosted iframe (`pay.rguest.com`) for card collection — the iframe posts a tokenized payment result back via `postMessage`. The server cannot collect card details because it never sees the card form; the iframe runs entirely in the user's browser. A single endpoint would need the card data up front, which is impossible when the iframe hasn't rendered yet. The two-phase split follows the **Single Responsibility Principle** — prepare handles order creation and pricing, complete handles payment finalization — and matches the actual temporal sequence of the rguest protocol.

**Alternatives rejected:**
- **Single endpoint:** Cannot work because the server has no way to collect card details — the iframe must run in the browser to handle card entry and captcha. A single endpoint would require the client to somehow obtain a payment token before the order exists, creating a chicken-and-egg problem.

## 2. Frontend Iframe Popup vs Server-Side Card Submission

**Chosen:** Render the rguest iframe (`PaymentIframe` component) in a popup on the client, listen for `postMessage` events from `pay.rguest.com`, and forward the resulting token to the server.

**Why it's right:** The rguest iframe embeds a captcha challenge that only works when loaded from a browser origin. Server-side submission from the app's domain would be blocked by the captcha. The iframe also handles PCI-compliant card collection — the app never touches raw card numbers, only receives a tokenized result. This is the pattern rguest designed for, confirmed by reverse-engineering their `iframe.js` postMessage protocol (documented in `rguest-popup-findings.md`).

**Alternatives rejected:**
- **Server-side card submission:** Captcha blocks the server's domain. Even if bypassed, handling raw card data server-side introduces PCI compliance scope. The iframe natively handles captcha, 3DS challenges, and card tokenization without exposing sensitive data to the app.

## 3. Zod Schemas for postMessage Parsing vs Duck Typing

**Chosen:** Define `rguestPaymentSuccessSchema`, `rguestPaymentErrorSchema`, and `rguestCancelSchema` using Zod, and validate every `postMessage` event with `.safeParse()` before acting on it.

**Why it's right:** `postMessage` data arrives as `any` from `JSON.parse` — there is zero type safety on messages from an untrusted cross-origin iframe. Zod provides runtime validation that catches malformed or unexpected messages before they propagate. This follows **defensive programming** principles: the schemas document the expected protocol shapes, serve as living documentation of the rguest iframe API, and prevent silent failures from unexpected message formats (e.g., a string error vs an object error). The `tryParseJson` + `safeParse` chain gracefully handles both string and object messages.

**Alternatives rejected:**
- **Duck typing / manual `if` checks:** With `JSON.parse` returning `any`, duck typing (`if (data.token)`) provides no compile-time safety and silently ignores structural changes. Missing or renamed fields would cause subtle bugs. Zod schemas make the contract explicit and fail loudly on violations.

## 4. Multi-Cafe Checklist UX vs Auto-Advancing

**Chosen:** `MultiCafePayment` renders a checklist of cafes with individual "Pay" buttons and a progress indicator ("2 of 3 paid"). The user explicitly clicks each cafe to open its payment iframe.

**Why it's right:** Multi-cafe orders involve separate rguest transactions per cafe — each can independently succeed or fail. A checklist gives the user full control: they can see which payments succeeded (✅), retry a failed one, or abandon remaining payments. This follows established **multi-step checkout UX patterns** (similar to paying multiple invoices). The `completedResults` state accumulates per-cafe results and triggers `onAllComplete` only when all cafes are paid.

**Alternatives rejected:**
- **Auto-advancing (automatically open next iframe on success):** Removes user control — the user can't choose payment order, can't pause between cafes, and gets confused if one fails mid-sequence. If the second iframe fails, the user doesn't know whether to retry or whether the first payment was already charged. The checklist makes state explicit and actionable.

## 5. orderId-Based Session Matching vs Phone/Alias Matching

**Chosen:** The `/complete` endpoint matches the payment to the correct `CafeOrderSession` using the `orderId` returned from `/prepare`, passed back in `ICompleteOrderRequest.orderIds`.

**Why it's right:** The `orderId` is a unique, server-generated identifier that unambiguously maps a payment completion to the exact order session that was prepared. This is cryptographically sound — the client receives the orderId from prepare and returns it to complete, creating a closed loop. It follows the **principle of least authority** by using a minimal, unforgeable identifier.

**Alternatives rejected:**
- **Phone number or alias matching:** Insecure — if User B submits a payment with User A's phone number, the payment could be applied to the wrong order. Phone numbers aren't unique identifiers for concurrent sessions. Alias matching is similarly fragile since multiple users could use the same alias. The orderId is guaranteed unique per session.

## 6. In-Memory Session Store with TTL vs Database-Backed Sessions

**Chosen:** `CafeOrderSession` instances are stored in memory on the server with a TTL (sessions expire after the payment flow completes or times out, ~30 minutes max).

**Why it's right:** The payment flow is inherently short-lived — prepare creates the session, the user enters payment in the iframe (typically 1–5 minutes), and complete closes it. The deployment is single-instance, so in-memory storage has no consistency issues. A TTL ensures abandoned sessions are garbage-collected. This follows **YAGNI** — the simplest storage that meets the requirements.

**Alternatives rejected:**
- **Database-backed sessions (Redis/SQLite):** Adds infrastructure complexity (connection management, serialization, migration) for a flow that lasts minutes and runs on a single instance. The session contains transient rguest API state (tokens, order context) that has no value after completion. DB-backed sessions would be warranted for multi-instance deployment or flows lasting hours, neither of which applies here.

## 7. useDelayedPromiseState vs Manual Loading/Error State

**Chosen:** `PaymentIframe` uses the `useDelayedPromiseState` hook from `@arcticzeroo/react-promise-hook` to manage the completion stage (not-run → running → success/error), with `RetryButton` for error recovery.

**Why it's right:** This is an established codebase convention — the same pattern is used throughout the app for async operations (e.g., `useImmediatePromiseState` in menu loading, price history). Using the hook avoids reimplementing `isLoading`/`error`/`result` state tracking, which is error-prone (forgetting to clear loading on error, race conditions with stale state). The `PromiseStage` enum provides exhaustive stage matching in the render logic.

**Alternatives rejected:**
- **Manual `useState` for loading/error/result:** Would duplicate the pattern already abstracted by the hook library. Manual state management requires coordinating 3+ state variables and is a common source of bugs (e.g., setting `isLoading = false` but forgetting to set `error`). The hook handles all transitions atomically.

---

# Design Justification — feature/cafe-hours

## 1. Storing Hours on `DailyStation` vs `Cafe` Model

**Chosen:** `opensAt` and `closesAt` fields are added to the `DailyStation` model in the Prisma schema, not to the `Cafe` model.

**Why it's right:**
- The upstream API (BuyOnDemand concepts endpoint) provides hours *per concept/station*, not per cafe. Different stations within the same cafe can have different operating hours (e.g., a breakfast station closes at 10am while a lunch station opens at 11am).
- `DailyStation` is already time-scoped — it represents a station's presence on a specific date. Hours are inherently daily data (a station might have different hours on Monday vs Friday), making `DailyStation` the natural home.
- Cafe-level aggregated hours are derived at query time via `getCafeHoursForDate()`, which computes the earliest open and latest close across all stations. This preserves per-station granularity while providing a convenient cafe-level summary.

**Rejected — `Cafe` model:**
- The `Cafe` model represents static configuration (name, tenant ID, context ID). Hours are dynamic and date-specific. Putting hours on `Cafe` would require overwriting them daily, losing history, and would be incorrect for cafes where stations have staggered schedules.

## 2. Extracting Hours from Concepts Endpoint vs Separate `/sites` API Call

**Chosen:** Station hours (`availableAt.open`, `availableAt.close`) are extracted from the concepts endpoint response that is already called during every menu sync cycle.

**Why it's right:**
- The concepts endpoint (`POST /sites/{tenantId}/{contextId}/concepts/{displayProfileId}`) already returns `availableAt` with `open` and `close` fields for each concept/station. This data is currently ignored.
- Zero additional API requests: the code simply reads two extra fields from the existing response and passes them through to `ICafeStation.opensAt`/`closesAt`.
- The investigation script (`investigate-hours.ts`) confirmed that the concepts endpoint is the most reliable source for per-station hours on the current day.

**Rejected — separate `/sites/{tenantId}` call:**
- While `/sites/{tenantId}` provides rich schedule data (weekly availability, time windows, next-available-day), it requires an additional API call per cafe per sync cycle. The concepts endpoint already provides today's hours at no extra cost. The `/sites` data could be added later for weekly schedule display without conflicting with this approach.

## 3. Sync Guard (Skip Closed Cafes) vs Always Syncing

**Chosen:** `update.ts` checks `isCurrentlyPastTime(storedHours.closesAt)` before re-syncing a cafe for today. If the cafe is past its closing time, the sync is skipped.

**Why it's right:**
- The BuyOnDemand API removes menu items after a station closes. Re-syncing after closing time would overwrite the stored menu with an empty or partial result, corrupting the data for users who view the menu later in the day.
- The guard only applies to today's sync (`daysInFuture === 0`). Future-day syncs are unaffected.
- Previously discovered hours are also used as the `scheduleTime` parameter for the concepts API call, improving the accuracy of the returned data.

**Rejected — always syncing:**
- Without the guard, a 3pm sync cycle would hit a cafe that closed at 2pm, receive an empty menu (API returns 410 or empty concepts), and overwrite the valid lunch menu data. Users checking the app at 3:30pm would see no menu items.

## 4. Timezone-Aware Comparison with `America/Los_Angeles` Default

**Chosen:** `isCurrentlyPastTime()` converts the current time to a specific timezone (defaulting to `America/Los_Angeles`) before comparing against the station's closing time string.

**Why it's right:**
- The server may run in any timezone (UTC in production, PST on local dev). The cafes are in the Pacific timezone. Naive `new Date()` comparison would be wrong when the server is in UTC — a cafe closing at 2:00 PM PST would be incorrectly marked as closed at 2:00 PM UTC (which is 6:00 AM PST).
- The timezone parameter is configurable (`timeZone: string = 'America/Los_Angeles'`), enabling future multi-timezone support if cafes in other regions are added.

**Rejected — naive time comparison:**
- Comparing `new Date().getHours()` against the parsed closing time assumes the server clock is in the same timezone as the cafes. This breaks in any hosted environment where the server runs in UTC or another timezone.

## 5. `String()` Coercion for `inUse` Check

**Chosen:** When reading the `priceLevelConfig.inUse` field from the API response in `stations.ts`, the existing codebase pattern uses `String()` coercion for comparisons.

**Why it's right:**
- The API documentation and observed responses show `inUse` as a string field (`"true"` or `"false"`), but API contracts can change. `String()` coercion handles both `"false"` (string) and `false` (boolean) correctly, producing the string `"false"` in both cases.
- This is a defensive coding pattern against upstream API type instability. The BuyOnDemand API has shown inconsistencies in other fields (e.g., `storeAvailabeNow` is misspelled), suggesting the schema is not tightly controlled.

**Rejected — strict string equality (`=== "true"`):**
- If the API ever returns a boolean `true` instead of the string `"true"`, strict equality would fail silently, hiding stations that should be visible. `String()` coercion is a one-line insurance policy against this class of bug.

## 6. `parseTimeToMinutes()` Utility for Time Comparison

**Chosen:** A new `parseTimeToMinutes()` function in `date.ts` parses 12-hour time strings (e.g., `"3:00 pm"`) into minutes-since-midnight for numeric comparison.

**Why it's right:**
- The API returns times as human-readable 12-hour strings. Comparing them lexicographically would be incorrect (`"2:00 pm"` < `"8:00 am"` alphabetically). Converting to minutes enables correct numeric comparison.
- The function is used in `getCafeHoursForDate()` to find the earliest open and latest close across multiple stations, and in `isCurrentlyPastTime()` for the sync guard.
- Returns `null` for unparseable strings, allowing callers to handle malformed data gracefully.

## 7. Aggregating Cafe Hours from Per-Station Data

**Chosen:** `getCafeHoursForDate()` and `getAllCafeHoursForDate()` aggregate per-station hours into a single cafe-level `{ opensAt, closesAt }` by taking the earliest `opensAt` and latest `closesAt` across all stations.

**Why it's right:**
- The frontend needs a single "cafe opens at X, closes at Y" for display. Computing this from per-station data avoids storing redundant aggregate data.
- Taking min/max gives the overall operating window. A cafe with a breakfast station (8am–10am) and a lunch station (11am–2pm) correctly reports 8am–2pm at the cafe level.
- The `ICafeHours` interface in `common/src/models/http.ts` uses optional `opensAt`/`closesAt` strings, allowing cafes without hours data to simply omit the field.
