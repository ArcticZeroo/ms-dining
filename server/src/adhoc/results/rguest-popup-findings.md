# rguest Popup/Iframe Payment Protocol — Findings

## 1. Problem Statement

The current server-side ordering flow (`server/src/api/cafe/session/order.ts`, ~1200 lines) handles the entire payment process on the backend by:

1. Fetching a **site token** from rguest
2. Loading the iframe HTML and scraping an **XSS/CSRF token** via regex
3. Submitting raw card data directly to the rguest payment API

**This no longer works** because rguest has enabled **reCAPTCHA verification** (`enableCaptcha`/`doVerify`), and the captcha doesn't recognize our server's domain. The current code has `enableCaptcha: false` and `doVerify: 'false'` as a workaround, with a TODO:

```typescript
if (!submittedPaymentToken) {
    logDebug('Card processor response is missing payment token:', json);
    throw new Error('TODO: Handle this by enabling the captcha and trying again');
}
```

The solution is to load the rguest iframe on the **frontend** (where the captcha can run in a real browser context), let it handle card collection + captcha, and return a payment token via `postMessage`.

---

## 2. Current Server-Side Token Flow (What Exists Today)

### Stage Progression
```
notStarted → addToCart → initializeCardProcessor → payment → closeOrder → complete
```

### Detailed Flow

```
┌──────────────────────────────────────────────────────────────┐
│  1. populateCart()                                            │
│     └─> POST /order/{tenantId}/{contextId}/orders             │
│         Body: item details, modifiers, quantities             │
│         Returns: orderNumber, orderId, lineItems, totals      │
│                                                              │
│  2. prepareBeforeOrder()                                      │
│     ├─> _getCardProcessorSiteToken()                          │
│     │   └─> POST /iFrame/token/{tenantId}                     │
│     │       Body: taxAmount, invoiceId, transactionAmount,     │
│     │             contextId, profileId, profitCenterId,        │
│     │             terminalId, style URL, etc.                  │
│     │       Returns: { token: string }  ← "site token"       │
│     │                                                         │
│     └─> _retrieveCardProcessorXssToken()                      │
│         └─> GET {iframe URL with site token}                   │
│             Headers: Api-Key-Token: {siteToken}                │
│             Returns: HTML page containing:                     │
│               <input entityType="hidden" id="token"            │
│                      name="token" value="{xssToken}" />        │
│             Extracted via regex → "XSS token"                  │
│                                                              │
│  3. submitOrder()                                             │
│     ├─> _submitPaymentToCardProcessor(siteToken, cardData)    │
│     │   └─> POST .../iFrame/tenants/107/token/{clientId}       │
│     │       Headers: Api-Key-Token: {siteToken}                │
│     │       Body: {                                            │
│     │         cardholderName, cardNumber, expirationMonth,      │
│     │         expirationYear, cvv, postalCode, dateTimeZone,   │
│     │         doVerify: 'false', enableCaptcha: false,          │
│     │         browserInfo: JSON.stringify({userAgent}),         │
│     │         token: {xssToken}   ← CSRF protection           │
│     │       }                                                  │
│     │       Returns: {                                         │
│     │         token: string,  ← payment token                  │
│     │         transactionReferenceData: { token: string },     │
│     │         cardInfo: {                                       │
│     │           accountNumberMasked: "****1234",                │
│     │           cardIssuer: "visa",                             │
│     │           expirationYearMonth: "202501",                  │
│     │           cardHolderName, postalCode                      │
│     │         },                                               │
│     │         gatewayResponseData: { decision: "ACCEPT" }      │
│     │       }                                                  │
│     │                                                         │
│     ├─> _closeOrderAsync()                                    │
│     │   └─> POST /order/{orderId}/processPaymentAndClosedOrder │
│     │       Body includes tokenizedData: {                     │
│     │         paymentDetails: { taxAmount, invoiceId, ... },   │
│     │         token: {paymentToken},                           │
│     │         saveCardFlag: false                               │
│     │       }                                                  │
│     │                                                         │
│     └─> _sendPhoneConfirmation()                              │
│         └─> POST /communication/sendSMSReceipt                 │
└──────────────────────────────────────────────────────────────┘
```

### Three Critical Tokens

| Token | Source | Purpose | Used In |
|-------|--------|---------|---------|
| **Site Token** (`#cardProcessorToken`) | `POST /iFrame/token/{tenantId}` | Authenticate with card processor, construct iframe URL | iframe URL query param, `Api-Key-Token` header, `tokenizedData.paymentDetails.apiToken` |
| **XSS Token** (`#xssToken`) | Scraped from iframe HTML via regex | CSRF protection for payment submission | `token` field in payment POST body |
| **Payment Token** | Response from payment submission | Proves payment was authorized | `tokenizedData.token` in close order request |

---

## 3. Key URLs and Constants

### Iframe URL Pattern
```
https://pay.rguest.com/pay-iframe-service/iFrame/tenants/{tenantId}/{clientId}
    ?apiToken={siteToken}
    &submit=PROCESS
    &style=https://{cafeId}.buy-ondemand.com/api/payOptions/getIFrameCss/en/{cafeId}.buy-ondemand.com/false/false
    &language=en
    &doVerify=true
    &version=3
```

### Payment Submission URL
```
https://pay.rguest.com/pay-iframe-service/iFrame/tenants/107/token/6564d6cadc5f9d30a2cf76b3
```

### Constants
| Constant | Value | Notes |
|----------|-------|-------|
| Client ID | `6564d6cadc5f9d30a2cf76b3` | Hardcoded in JS; appears in both URLs |
| Tenant ID | `107` | From `client.config.tenantId` |
| CSS Style URL | `https://{cafeId}.buy-ondemand.com/api/payOptions/getIFrameCss/...` | Per-cafe styling |
| Version | `3` | API version parameter |
| Currency | `USD` | Hardcoded throughout |
| Timezone | `PST8PDT` | Hardcoded for all orders |

### XSS Token Regex
```typescript
const CARD_PROCESSOR_XSS_TOKEN_REGEX = /<input\s+entityType="hidden"\s+id="token"\s+name="token"\s+value="(?<xssToken>.+?)"\s+\/>/;
```
Matches: `<input entityType="hidden" id="token" name="token" value="{TOKEN}" />`

Note: Uses `entityType` instead of `type` — this is rguest's custom attribute naming.

---

## 4. Response Interfaces

### Payment Success Response (`ICardProcessorPaymentSuccessResponse`)
```typescript
{
    token?: string;                        // Primary payment token
    transactionReferenceData?: {
        token: string;                     // Alternative token location
    };
    cardInfo: {
        cardIssuer: string;                // e.g. "visa"
        accountNumberMasked: string;       // e.g. "123456xxxxxx1234"
        expirationYearMonth: string;       // e.g. "202501"
        cardHolderName: string;
        postalCode: string;
    };
    gatewayResponseData: {
        decision: 'ACCEPT' | string;
    };
}
```

### Payment Failure Response (`ICardProcessorPaymentFailureResponse`)
```typescript
{
    code: number;
    reason: string;
    message: string;
}
```

### Payment token extraction logic
```typescript
const submittedPaymentToken = json.token || json.transactionReferenceData?.token;
```

---

## 5. The rguest Iframe — Actual Behavior (from iframe.js source)

> **Source**: `iframe.js` — the full HTML+JS served by `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/...`. This is a server-rendered page (not a separate `.js` file) containing inline `<script>` with all payment logic.

### What the iframe renders

1. **Card entry form** (`#agisForm`) — cardholder name, card number, expiration month/year dropdowns, CVV, zip/postal code
2. **Optional billing address section** (`#billingAddress`, hidden by default) — address line 1/2, city, country dropdown, state dropdown, postal code
3. **reCAPTCHA Enterprise widget** — site key `6LfGtAUeAAAAADbI4E6WQz4B8KI3MzPwcbQ_Tfbt`, `enableCaptcha = true` by default
4. **Hidden CSRF token** — `<input type="hidden" id="token" name="token" value="{uuid}" />` (server-generated per session, e.g. `8bf10d8c-0a88-4d83-859e-0075522f3b93`)
5. **Hidden doVerify flag** — `<input type="hidden" id="doVerify" name="doVerify" value="true" />`
6. **Submit button** — `<input class="btn submitBtn" id="btnSubmit" type="submit" value="PROCESS">`
7. **Clear button** — resets form + reCAPTCHA (note: NOT a cancel that posts to parent)
8. **3DS container** — `<div id="3dsstripe">` hidden div for 3D Secure child iframes

### Key hardcoded values in the rendered HTML
| Value | Location | Example |
|-------|----------|---------|
| AJAX submission URL | `$.ajax({ url: ... })` | `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/107/token/6564d6cadc5f9d30a2cf76b3` |
| Api-Key-Token header | `$.ajax({ headers: ... })` | `c3cd880c-fe1a-4ca5-81c8-c87c061c37af` (= the site token baked in at render time) |
| reCAPTCHA site key | `data-sitekey` attribute | `6LfGtAUeAAAAADbI4E6WQz4B8KI3MzPwcbQ_Tfbt` |
| CSRF token | `#token` hidden input | UUID generated per session |
| CSS URL | `<link rel="stylesheet">` | `https://foodhall4.buy-ondemand.com/api/payOptions/getIFrameCss/en/foodhall4.buy-ondemand.com/false/false` |

---

## 5a. Actual postMessage Protocol (verified from iframe.js source)

### ⚠️ CRITICAL FINDING: All postMessage calls use target origin `"*"`

Every single `window.parent.postMessage(...)` call in iframe.js uses `"*"` as the target origin. **There are no origin restrictions.** This means the iframe can be embedded on ANY domain and the parent will receive messages regardless of its origin.

### Messages: iframe → parent

There are **6 distinct postMessage calls**, covering 5 different scenarios:

#### 1. Payment Success (no 3DS required)
```javascript
// iframe.js line ~948 — inside $.ajax success callback
// Condition: data.token || data.transactionReferenceData exists, AND no redirectUrl/issuerUrl
window.parent.postMessage(data, "*");
```
`data` is the full API JSON response:
```typescript
{
    token?: string;                         // Primary payment token
    transactionReferenceData?: {
        token: string;                      // Alternative token location
    };
    cardInfo?: {
        cardIssuer: string;                 // e.g. "visa"
        accountNumberMasked: string;        // e.g. "123456xxxxxx1234"
        expirationYearMonth: string;        // e.g. "202501"
        cardHolderName: string;
        postalCode: string;
    };
    gatewayResponseData?: {
        decision: string;                   // e.g. "ACCEPT"
        referenceCode?: string;
        invoiceId?: string;
    };
    // 3DS fields (absent in non-3DS flow):
    redirectUrl?: string;                   // Stripe 3DS — triggers child iframe
    issuerUrl?: string;                     // Adyen 3DS — triggers child iframe
    paRequest?: string;                     // Adyen 3DS PaReq
    md?: string;                            // Adyen 3DS MD
    termUrl?: string;                       // Adyen 3DS TermUrl
    transactionResponseData?: {
        tipAmount?: number;
        subTotalAmount?: number;
    };
}
```

#### 2. Payment Success (after 3DS authentication)
```javascript
// iframe.js line ~1011 — on3DSComplete() function
// Augments the 3DS response with saved fields before posting
data.transactionResponseData.tipAmount = tipAmount;
data.transactionResponseData.subTotalAmount = subTotalAmount;
if (referenceCode != null) data.gatewayResponseData.referenceCode = referenceCode;
if (invoiceId != null) data.gatewayResponseData.invoiceId = invoiceId;
window.parent.postMessage(data, "*");
```
Same shape as #1, but with `transactionResponseData.tipAmount/subTotalAmount` and `gatewayResponseData.referenceCode/invoiceId` fields populated from the initial pre-3DS response.

#### 3. 3DS Authentication Failure
```javascript
// iframe.js line ~1019 — on3DSFailure() function
window.parent.postMessage(data, "*");
```
`data` has at minimum `{ code: 9300, ... }` (the 3DS failure code).

#### 4. AJAX Error (payment submission failed)
```javascript
// iframe.js line ~981 — inside $.ajax error callback
window.parent.postMessage(data.responseText, "*");
```
**Note: `data.responseText` is a raw string**, not a parsed object. It could be a JSON string or an error message. The parent must `JSON.parse()` it to get structured error data. Before posting, the iframe also dynamically toggles captcha if the error response contains `captchaEnabled`.

#### 5. Empty Token Response (AJAX succeeds but no token)
```javascript
// iframe.js line ~953 — success callback, no token in response
window.parent.postMessage(null, "*");
```
Posted when the AJAX call succeeds (HTTP 200) but the response contains neither `data.token` nor `data.transactionReferenceData`. The form is re-enabled so the user can try again.

#### 6. Duplicate Submission (form already succeeded)
```javascript
// iframe.js line ~988 — isSuccess is already true
window.parent.postMessage("", "*");
```
If the user somehow triggers a second submit after a successful payment, an empty string is posted.

#### 7. Cancel Payment (function defined but NOT currently wired to UI)
```javascript
// iframe.js line ~611 — cancelPayment() function
window.parent.postMessage({"cancel": true}, "*");
```
**Important**: This function exists in the code but the cancel button's `onclick` is set to `clearForm()` (which just resets the form), NOT `cancelPayment()`. The HTML has: `<div class="btn cancelBtn" onclick="clearForm()">Clear</div>`. The `cancelPayment()` function is defined but unreachable via the UI.

### Messages: parent → iframe

**NONE.** The iframe does not have any `addEventListener('message', ...)` handler for messages from the parent window. Communication is strictly one-way: iframe → parent.

The only `addEventListener('message', ...)` in the iframe (line ~1040) listens for messages from **3DS child iframes** that the rguest iframe itself creates:
```javascript
var f = function(ev) {
    if (ev.data.stripe3dsauthenticated != null) {
        // Stripe 3DS complete — merge token and call on3DSComplete
        if (token) ev.data.stripe3dsauthenticated.transactionReferenceData.token = token;
        on3DSComplete(ev.data.stripe3dsauthenticated);
    } else if (ev.data.adyen3dsauthenticated != null) {
        // Adyen 3DS complete
        on3DSComplete(ev.data.adyen3dsauthenticated);
    } else if (ev.data.code === 9300 || ev.data.code === '9300') {
        // 3DS failure
        on3DSFailure(ev.data);
    }
};
window.addEventListener('message', f, false);
```

### Origin Restrictions Summary

| Direction | Origin Check | Target Origin |
|-----------|-------------|---------------|
| iframe → parent | N/A | `"*"` (unrestricted) |
| parent → iframe | N/A | **No messages sent** |
| 3DS child → iframe | **None** (no origin validation) | N/A |

**Conclusion**: There are **zero origin restrictions** in the postMessage protocol. The iframe can be embedded on any domain.

---

## 5b. Iframe Internal Submission Flow (from iframe.js source)

### Form Submission Sequence

When the user clicks "PROCESS" in the iframe:

```
1. jQuery validate runs on #agisForm
   ├── cardholderName: required
   ├── cardNumber: required + creditcard validation
   ├── cvv: required, minlength 3, maxlength 4
   └── postalCode: required, minlength 4

2. If enableCaptcha === true:
   └── grecaptcha.enterprise.getResponse() must be non-empty
       └── If empty → show "Please Verify Captcha" error, abort

3. If validation passes:
   ├── Disable submit button + cancel button
   ├── Serialize form to JSON via $.fn.serializeObject()
   │   └── Strips spaces from cardNumber during serialization
   ├── Append fields:
   │   ├── browserInfo: JSON.stringify({ userAgent: <from ThreedDS2Utils> })
   │   ├── customerId: "" (empty string, from var)
   │   ├── googleCaptcha: grecaptcha.enterprise.getResponse()
   │   ├── enableCaptcha: true/false
   │   ├── dateTimeZone: ISO 8601 with timezone offset (from timeZoneOffset())
   │   └── billingAddress: { addressLine1, addressLine2, city, country, postalCode, stateOrProvince }
   │       (only if billing address fields are filled)
   │
   └── POST via $.ajax to the hardcoded payment URL
```

### AJAX Request (what the iframe sends to rguest)
```javascript
$.ajax({
    type: "POST",
    crossDomain: true,
    url: 'https://pay.rguest.com/pay-iframe-service/iFrame/tenants/107/token/6564d6cadc5f9d30a2cf76b3',
    headers: {
        'Api-Key-Token': 'c3cd880c-fe1a-4ca5-81c8-c87c061c37af',  // site token (baked in at render)
        'Content-Type': 'application/json'
    },
    data: JSON.stringify({
        cardholderName: string,
        cardNumber: string,          // spaces stripped
        expirationMonth: string,     // "01"-"12"
        expirationYear: string,      // "2024"-"2038"
        cvv: string,
        postalCode: string,
        doVerify: "true",            // from hidden input
        token: string,               // CSRF token from hidden input
        browserInfo: string,         // JSON.stringify({ userAgent: "..." })
        customerId: string,          // empty string
        googleCaptcha: string,       // reCAPTCHA response token
        enableCaptcha: boolean,      // true
        dateTimeZone: string,        // ISO 8601 e.g. "2024-01-15T14:30:00.000-08:00"
        billingAddress?: {           // only if billing fields filled
            addressLine1?: string,
            addressLine2?: string,
            city?: string,
            country?: string,        // ISO 3166-1 alpha-2
            postalCode?: string,
            stateOrProvince?: string
        }
    })
});
```

### 3D Secure Flow (when applicable)

If the AJAX response contains `redirectUrl` (Stripe) or `issuerUrl` (Adyen), the iframe:
1. Saves `tipAmount`, `subTotalAmount`, `referenceCode`, `invoiceId`, and `token` from the initial response
2. Removes the card form
3. Creates a child iframe inside `#3dsstripe`:
   - **Stripe**: Sets child iframe `src = data.redirectUrl`
   - **Adyen**: Creates a form with hidden fields (`PaReq`, `MD`, `TermUrl`), submits it to `data.issuerUrl` targeting the child iframe
4. Listens for postMessage from the child iframe:
   - `ev.data.stripe3dsauthenticated` → augments with saved token → `on3DSComplete()`
   - `ev.data.adyen3dsauthenticated` → `on3DSComplete()`
   - `ev.data.code === 9300` → `on3DSFailure()`
5. `on3DSComplete()` augments data with saved `tipAmount/subTotalAmount/referenceCode/invoiceId` then posts to parent
6. `on3DSFailure()` posts failure data directly to parent

### Error Response Handling

On AJAX error, the iframe inspects `data.responseJSON`:
```javascript
if (data.responseJSON.captchaEnabled === "true") {
    // Show reCAPTCHA, set enableCaptcha = true
} else if (data.responseJSON.captchaEnabled === "false") {
    // Hide reCAPTCHA, set enableCaptcha = false
}
// Re-enable form for retry
// Post data.responseText (raw string!) to parent
window.parent.postMessage(data.responseText, "*");
```

This means the server can dynamically force captcha on/off via error responses. Our current server-side approach sets `enableCaptcha: false` to bypass this, which is why it stopped working when rguest enforced captcha server-side.

---

## 6. Current Frontend Architecture

### Card Collection (`payment-info-form.tsx`)
- Collects **7 fields**: phone number, alias, name on card, card number, expiration, CVV, postal code
- **All card data is sent in plaintext** to our backend via `POST /api/dining/order`
- Stores card number in `CardNumberContext` (React context, in-memory only)
- Persists non-sensitive fields (phone, alias, name, postal code) in `InternalSettings` (localStorage)

### Order Submission (`client/src/api/order.ts`)
```typescript
// Current: sends raw card data to our server
const response = await makeJsonRequest({
    path: '/api/dining/order',
    options: {
        method: 'POST',
        body: JSON.stringify({
            itemsByCafeId: serializedCart,
            phoneNumberWithCountryCode,
            alias,
            cardData  // ← Raw card number, CVV, etc.
        })
    }
});
```

### Payment Context (`client/src/context/payment.ts`)
```typescript
// In-memory only, never persisted
export const CardNumberContext = React.createContext(new ValueNotifier<string>(''));
export const CardSecurityCodeContext = React.createContext(new ValueNotifier<string>(''));
```

### Existing Popup System
The codebase already has a popup/modal system:
- `PopupContext` (`client/src/context/modal.ts`) — manages modal state
- `PopupContainer` (`client/src/components/popup/popup-container.tsx`) — renders overlays
- `usePopupOpener` / `usePopupCloser` hooks

No existing iframe or `postMessage` handling exists in the payment flow.

---

## 7. Proposed Frontend Architecture for Popup Approach

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend                                                           │
│                                                                     │
│  1. User fills out: phone, alias (no card fields needed)            │
│  2. User clicks "Pay"                                               │
│  3. Frontend calls backend: POST /api/dining/order/prepare          │
│     Body: { itemsByCafeId, alias }                                  │
│     Returns: { siteToken, iframeUrl, orderNumber }                  │
│                                                                     │
│  4. Frontend opens popup/modal with <iframe src={iframeUrl}>        │
│  5. User enters card data + completes captcha inside iframe         │
│  6. iframe fires postMessage with payment token + card info         │
│  7. Frontend catches message, validates origin (pay.rguest.com)     │
│  8. Frontend calls backend: POST /api/dining/order/complete         │
│     Body: { paymentToken, cardInfo, phoneNumber, alias }            │
│     Returns: order confirmation                                     │
│  9. Frontend closes popup, shows confirmation                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### New React Component: `RguestPaymentIframe`

```typescript
// Conceptual structure (not implementation)
interface RguestPaymentIframeProps {
    iframeUrl: string;
    onPaymentComplete: (data: PaymentResult) => void;
    onPaymentError: (error: PaymentError) => void;
    onClose: () => void;
}

// Uses existing PopupContext to render in a modal overlay
// Listens for postMessage events from the iframe
// Validates event.origin === 'https://pay.rguest.com'
```

### Message Listener (revised based on actual iframe.js protocol)

```typescript
useEffect(() => {
    const handler = (event: MessageEvent) => {
        // Validate origin — the iframe posts from pay.rguest.com
        if (event.origin !== 'https://pay.rguest.com') return;
        
        const data = event.data;
        
        // Case 1: null or empty string — no token / duplicate submit
        // The iframe re-enables the form for retry; we can ignore or log these
        if (data === null || data === '') return;
        
        // Case 2: string — AJAX error, data.responseText was posted as raw string
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                onPaymentError(parsed);
            } catch {
                onPaymentError({ message: data });
            }
            return;
        }
        
        // Case 3: object with cancel flag (defined in code but NOT wired to UI)
        if (data.cancel) {
            onClose();
            return;
        }
        
        // Case 4: success — has token or transactionReferenceData
        if (data.token || data.transactionReferenceData?.token) {
            onPaymentComplete({
                token: data.token || data.transactionReferenceData.token,
                cardInfo: data.cardInfo,
                gatewayResponseData: data.gatewayResponseData,
                transactionResponseData: data.transactionResponseData
            });
            return;
        }
        
        // Case 5: 3DS failure or other error object
        if (data.code) {
            onPaymentError(data);
            return;
        }
        
        // Unknown message shape — log for debugging
        console.warn('Unknown postMessage from rguest iframe:', data);
    };
    
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
}, []);
```

---

## 8. Proposed Backend Changes

### Keep
- `_populateCart()` — still need to build the order server-side
- `_getCardProcessorSiteToken()` — still need the site token to construct iframe URL
- `_getCardProcessorUrl()` — still need to construct the URL for the frontend
- `_closeOrderAsync()` — still need to close the order with the payment token
- `_sendPhoneConfirmation()` — still need SMS receipts
- All the ordering context, menu item, and cart logic

### Remove
- `_retrieveCardProcessorXssToken()` — no longer scraping HTML; iframe handles this internally
- `_submitPaymentToCardProcessor()` — the iframe does this now
- `CARD_PROCESSOR_XSS_TOKEN_REGEX` — no longer needed
- `_makeCardProcessorRequest()` — no longer needed (was only for card processor calls)
- `_parseCreditProcessorResponse()` — no longer needed
- All raw card data handling on the server (cardNumber, CVV never touch our server)

### Add/Modify

#### New endpoint: `POST /api/dining/order/prepare`
```typescript
// Request
{
    itemsByCafeId: Record<string, ISerializedCartItem[]>,
    alias: string
}

// Response
{
    iframeUrl: string,      // Full rguest iframe URL with site token
    siteToken: string,      // For tokenizedData.paymentDetails.apiToken
    orderNumber: string,    // For reference
    orderTotal: number      // For display
}
```

This endpoint:
1. Populates the cart (`_populateCart()`)
2. Gets the site token (`_getCardProcessorSiteToken()`)
3. Constructs the iframe URL (`_getCardProcessorUrl()`)
4. Returns the URL and token to the frontend

#### New endpoint: `POST /api/dining/order/complete`
```typescript
// Request
{
    paymentToken: string,           // From iframe postMessage
    cardInfo: {
        accountNumberMasked: string,
        cardIssuer: string,
        expirationYearMonth: string,
        cardHolderName: string,
        postalCode: string
    },
    alias: string,
    phoneNumberWithCountryCode: string
}

// Response
{
    success: boolean,
    orderNumber: string,
    // ... confirmation details
}
```

This endpoint:
1. Receives the payment token from the frontend (originally from rguest iframe)
2. Calls `_closeOrderAsync()` with the token data
3. Sends SMS confirmation

#### Modified: `_closeOrderAsync()`
- Instead of receiving `cardData` (raw card details), receives only `cardInfo` (masked/tokenized info from iframe response)
- The `tokenizedData` section already expects exactly this format

---

## 9. Security Considerations

### Improvements over current approach
1. **No raw card data on our server** — Card numbers, CVVs never leave the browser or touch our backend. Only masked data and tokens are transmitted.
2. **reCAPTCHA works properly** — The iframe runs in a real browser context where reCAPTCHA can validate the user.
3. **PCI compliance** — By not handling card data server-side, we significantly reduce PCI scope.
4. **No HTML scraping** — Eliminates the fragile regex-based XSS token extraction.

### Risks to mitigate
1. **Origin validation** — The `postMessage` listener MUST validate `event.origin === 'https://pay.rguest.com'`. The iframe itself uses `"*"` for target origin, so our listener will receive messages — but we must still validate to reject spoofed messages from other iframes.
2. **Message type handling** — The iframe sends **5 different data types** via postMessage: objects (success/3DS), `null` (no token), `""` (duplicate submit), raw strings (AJAX errors), and `{cancel: true}` (unused). The listener must handle all of these gracefully.
3. **Token exposure** — The `siteToken` is returned to the frontend. It's already baked into the iframe's HTML as the `Api-Key-Token` header value, so this is by design.
4. **Order session management** — Need to handle the case where the user closes the popup without completing payment (cart is already created server-side).
5. **Replay attacks** — The payment token should be single-use. The backend should validate this.
6. **iframe CSP / X-Frame-Options** — The iframe.js source itself has no restrictions, but the **HTTP response headers** from `pay.rguest.com` may set `X-Frame-Options` or `Content-Security-Policy: frame-ancestors`. This must be tested in a browser. If restricted to `*.buy-ondemand.com`, we'd need either a proxy or to contact rguest for whitelisting.
7. **Popup blockers** — Using an embedded `<iframe>` in a modal overlay (rather than `window.open`) avoids this.

### Answered Questions (from iframe.js analysis)

| # | Question | Answer |
|---|----------|--------|
| 1 | Does the iframe `postMessage` to `'*'` or specific origin? | **`'*'` — unrestricted.** All 6 postMessage calls use `"*"`. |
| 2 | Does the iframe receive messages from parent? | **No.** Communication is strictly one-way: iframe → parent. No `addEventListener` for parent messages. |
| 3 | What is the exact postMessage data shape? | **See Section 5a above.** Multiple shapes: object (success), string (error), null (no token), empty string (duplicate). |
| 4 | Is the client ID tenant-specific? | **Yes, it's baked into the rendered HTML.** The URL `tenants/107/token/6564d6cadc5f9d30a2cf76b3` and the `Api-Key-Token` header are rendered server-side per session. |
| 5 | How does cancellation work? | **`cancelPayment()` exists but is NOT wired to UI.** The "Cancel" button actually calls `clearForm()` which just resets the form. There is no cancel postMessage in normal usage. |
| 6 | How does 3DS work? | **Stripe 3DS**: child iframe via `redirectUrl`. **Adyen 3DS**: child iframe with form POST to `issuerUrl`. Both post back via `stripe3dsauthenticated`/`adyen3dsauthenticated` message keys. |
| 7 | How does captcha toggle work? | **Server-driven.** If a payment error response includes `captchaEnabled: "true"/"false"`, the iframe dynamically shows/hides the reCAPTCHA. Default is enabled. |

### Remaining Open Questions
1. **HTTP headers from pay.rguest.com** — Does the iframe response include `X-Frame-Options` or CSP `frame-ancestors`? Must test in browser.
2. **How long is the site token valid?** If there's a timeout, the user needs to complete payment within that window.
3. **reCAPTCHA Enterprise key scope** — The key `6LfGtAUeAAAAADbI4E6WQz4B8KI3MzPwcbQ_Tfbt` is hardcoded. Is it domain-restricted in Google's reCAPTCHA console to only `*.buy-ondemand.com`? If so, reCAPTCHA would fail when the iframe is embedded on our domain. However, since the reCAPTCHA runs **inside** the iframe (which is served from `pay.rguest.com`), the reCAPTCHA's domain check would be against `pay.rguest.com`, not our domain. This should work.

---

## 10. Verification Steps

The postMessage protocol is now **verified** from iframe.js source. Remaining verification:

1. **HTTP header check**: Load the iframe URL in Chrome DevTools → Network tab. Check the response headers for `X-Frame-Options`, `Content-Security-Policy`, and `Access-Control-Allow-Origin`. This determines if embedding is restricted.
2. **reCAPTCHA domain check**: Embed the iframe on a test page served from our domain. If reCAPTCHA fails, the key may be domain-restricted (though since it runs inside the iframe on `pay.rguest.com`, this is unlikely to be an issue).
3. **End-to-end test**: Create a minimal HTML page that:
   - Embeds the iframe in a `<div>` 
   - Listens for `window.addEventListener('message', handler)`
   - Logs all received messages to verify the data shapes match our analysis
4. **3DS test**: Use a test card that triggers 3DS to verify the child iframe flow works when embedded in our popup.

---

## 11. Summary

| Aspect | Current (Server-Side) | Proposed (Frontend Iframe) |
|--------|----------------------|---------------------------|
| Card data handling | Raw card data sent to our server, then to rguest | Card data entered directly in rguest iframe, never touches our server |
| Captcha | Disabled (broken) | Handled natively by iframe; enabled by default, server can toggle via error response |
| Token flow | 3-step: site token → XSS token → payment token | 2-step: site token → payment token (from iframe postMessage) |
| Server complexity | ~1200 lines, HTML scraping, regex parsing | Simplified: prepare + close order only |
| PCI scope | High (card data on server) | Minimal (only tokens and masked data) |
| Fragility | Regex scraping breaks if HTML changes | Standard postMessage API (verified `"*"` target origin) |
| User experience | All server-side, no user interaction | User completes captcha and card entry in popup |
| 3DS support | Not supported | Built into iframe — handles Stripe + Adyen 3DS automatically |
| postMessage origin | N/A | All calls use `"*"` — no origin restriction on iframe side |
| Cancel mechanism | N/A | `cancelPayment()` defined but NOT wired to UI; "Clear" button only resets form |
