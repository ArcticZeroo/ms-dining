# Design Justification — feature/ingredients-ai

## 1. Server-Side AI Categorization vs Client-Side Only

**Chosen:** A server-side `ai-categorizer.ts` module sends menu item data to an AI text completion API with a structured prompt, receiving categorized items (starters, entrées, desserts, additional offerings) as a JSON response. The client fetches the result from `GET /:id/menu`.

**Why it's right:** The in.gredients cafe uses a "buy-on-demand" ordering system that encodes its prix fixe 3-course meal structure in non-obvious ways — entrées appear in a "3 Course Meal" category, starters/desserts are hidden inside modifier choices, and à la carte duplicates clutter the listing. Client-side string matching (the existing `parseIngredientsMenu`) works for predictable patterns but fails on human data entry inconsistencies: misspellings, inconsistent capitalization, creative dessert names like "Sweet" or "Savory", and structural changes when staff reorganize categories. AI categorization handles these variations robustly by understanding menu semantics, not just string patterns.

**Alternatives rejected:**
- **Client-side only:** The existing `parseIngredientsMenu` uses fragile string matching that breaks whenever staff change category names, add unexpected items, or use creative descriptions. Every menu change risks a broken categorization that requires a code update. Server-side AI adapts to content changes without code modifications.

## 2. Text Categorization vs PDF Vision Parsing

**Chosen:** The AI categorizer serializes station data as structured text (`serializeStationForPrompt`) and uses a text completion API to categorize items by name, description, price, and modifier structure.

**Why it's right:** The menu data is already available as structured JSON from the rguest API — item names, descriptions, prices, and modifier choices are all text fields. A text completion call is cheap (~$0.001–0.005 per request), fast, and the input format is deterministic. The prompt explicitly encodes domain knowledge about in.gredients' prix fixe structure (e.g., "Items in the '3 Course Meal' category are ENTRÉES", "Modifier choices named 'Starter Choice' contain the STARTER options").

**Alternatives rejected:**
- **PDF vision parsing:** Would require rendering the menu as an image or PDF first, then using a vision model to extract and categorize items. Vision API calls are 10–50x more expensive than text completion, slower (multi-second latency), and introduce OCR-like failure modes. The structured text data is already available from the API — converting it to an image to re-extract it via vision is wasteful and error-prone.

## 3. Unified /:id/menu Endpoint vs Separate /ingredients-menu

**Chosen:** A single `GET /api/dining/cafe/:id/menu` endpoint that returns the standard menu data plus an optional `ingredientsMenu` field when the cafe is in.gredients and AI categorization succeeds.

**Why it's right:** Only one cafe (in.gredients) uses this feature currently, so a dedicated endpoint would serve a single consumer. The unified endpoint follows the **pattern consistency** of the existing API — the menu route already handles per-cafe logic. It also sets up a clean extension point: future per-cafe metadata (hours, special instructions, dietary info) can be added to the same response without proliferating endpoints. From the client's perspective, a single request is simpler than coordinating two parallel fetches.

**Alternatives rejected:**
- **Separate `/ingredients-menu` endpoint:** Creates a one-off route for a single cafe, diverging from the existing pattern where cafe data flows through parameterized `/:id/` routes. The client would need to make two parallel requests and merge results, adding coordination complexity. If more cafes get custom metadata in the future, each would need its own endpoint, leading to route sprawl.

## 4. MD5 Content-Based Caching vs Time-Based

**Chosen:** `cache.ts` computes an MD5 hash of the menu content (item names, descriptions, prices, modifier choices) and uses it as a cache key. The cached AI categorization result is returned when the hash matches, bypassing the AI call entirely.

**Why it's right:** The in.gredients menu changes unpredictably — sometimes every 6 weeks, sometimes every 10 weeks, and occasionally mid-week for special events. A time-based cache (e.g., "refresh every 24 hours") would either waste AI calls when the menu hasn't changed or serve stale results when it has. Content hashing detects actual changes with zero false positives or negatives. The hash includes modifier choice prices to catch price-only changes that don't affect item names.

**Alternatives rejected:**
- **Time-based caching (TTL):** A fixed TTL has no way to know whether the menu actually changed. A 24-hour TTL would make ~365 AI calls/year when the menu only changes ~6–8 times. A 1-week TTL would serve stale categorizations for up to 7 days after a menu change. Content hashing makes exactly as many AI calls as there are actual menu changes — typically 6–8 per year.

## 5. Keeping Client-Side Parsing as Fallback vs Removing It

**Chosen:** `CafeMenuBody` tries the server-provided AI categorization first (`serverIngredientsMenu`). If the server fetch completed without a result (`serverFetchAttempted && !serverIngredientsMenu`), it falls back to the existing client-side `parseIngredientsMenu`. While the server fetch is in progress, it renders the raw station list with an `IngredientsInfoBanner`.

**Why it's right:** This implements **graceful degradation** — if the AI service is down, the API key is exhausted, or the server endpoint is unreachable, users still get the categorized menu experience via client-side parsing. The fallback path is already tested and proven. Removing it would create a single point of failure where an AI outage degrades the entire in.gredients experience to an uncategorized station list.

**Alternatives rejected:**
- **Removing client-side parsing:** Eliminates a working fallback for no benefit. The client-side code is ~50 lines, already tested, and has zero runtime cost when the server path succeeds (it's never called). Removing it means any server-side failure — network issues, API quota, AI model changes — would immediately degrade the user experience with no recovery path.

## 6. No Outer Retry Wrapper vs Adding Application-Level Retries

**Chosen:** The `ai-categorizer.ts` module calls `retrieveTextCompletion` without an outer retry wrapper. The AI provider client already implements 3 retries with exponential backoff internally.

**Why it's right:** Adding an application-level retry around a function that already retries 3x would create a **multiplicative retry storm** — 3 inner × 3 outer = 9 total attempts on a persistent failure. Each attempt costs money (AI API billing) and adds latency. If the AI service is genuinely down, 9 attempts won't help but will waste ~$0.01–0.05 and delay the response by 30+ seconds. The provider's built-in retry handles transient failures (network blips, rate limits); persistent failures (bad prompt, model unavailable) should fail fast and fall back to client-side parsing.

**Alternatives rejected:**
- **Application-level retry wrapper:** An earlier version included this (removed in commit `bc5a1c1`). The double retry caused 9 total attempts on persistent failures, wasting money and delaying fallback activation. The correct behavior is: retry transient failures (handled by the provider), fail fast on persistent failures (triggers client-side fallback). One retry layer achieves both.
