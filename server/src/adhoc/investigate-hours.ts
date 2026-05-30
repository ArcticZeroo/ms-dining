/**
 * Investigation script: How does the BuyOnDemand API provide cafe operating hours?
 *
 * Self-contained — uses Node 18+ native fetch, no project dependencies.
 * Run: cd server && npx tsx src/adhoc/investigate-hours.ts
 *      — or —  node --experimental-strip-types src/adhoc/investigate-hours.ts
 */

// ── inline cafe list (no project imports needed) ─────────────────────────────

interface SimpleCafe { id: string; name: string }

const CAFES: SimpleCafe[] = [
    { id: 'foodhall4',   name: 'Food Hall 4' },
    { id: 'fh4mila',     name: 'MiLa (FH4)' },
    { id: 'cafe16',      name: 'Café 16' },
    { id: 'cafe25',      name: 'Café 25' },
    { id: 'cafe40-41',   name: 'Café 40/41' },
    { id: 'chandys',     name: "Chandy's (Commons)" },
    { id: 'boardwalk',   name: 'Boardwalk' },
    { id: 'foodhall6',   name: 'Food Hall 6' },
];

function baseUrl(cafe: SimpleCafe) {
    return `https://${cafe.id}.buy-ondemand.com/api`;
}

// ── helpers ──────────────────────────────────────────────────────────────────

interface AuthTokens { accessToken: string; csrfToken: string }
interface ApiErrorResponse { _error: true; _status: number; _statusText: string }
interface ConfigResponse extends Record<string, unknown> {
    tenantID?: string;
    contextID?: string;
    storeList?: Array<{
        displayProfileId?: string[];
        storeInfo?: { storeInfoId?: string };
    }>;
    properties?: Record<string, unknown> & {
        scheduledOrdering?: unknown;
        streamLinedHomepage?: unknown;
    };
}
interface ConceptScheduleEntry {
    scheduledExpression?: string;
    '@c'?: string;
    properties?: Record<string, string>;
}
interface ConceptResponse {
    name?: string;
    availableAt?: unknown;
    openScheduleExpression?: unknown;
    closeScheduleExpression?: unknown;
    schedule?: ConceptScheduleEntry[];
}

type ApiResult<T> = T | ApiErrorResponse;

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const isApiErrorResponse = <T>(value: ApiResult<T>): value is ApiErrorResponse =>
    typeof value === 'object' && value != null && '_error' in value;
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value != null;

async function anonymousLogin(cafe: SimpleCafe): Promise<AuthTokens> {
    const res = await fetch(`${baseUrl(cafe)}/login/anonymous`, {
        method: 'GET',
        headers: { 'User-Agent': 'PostmanRuntime/7.36.0' },
    });
    if (!res.ok) {
        throw new Error(`Login failed for ${cafe.id}: ${res.status}`);
    }
    const accessToken = res.headers.get('access-token');
    if (!accessToken) {
        throw new Error(`No access-token header for ${cafe.id}`);
    }
    const body = (await res.json()) as { csrfToken?: string };
    if (!body.csrfToken) {
        throw new Error(`No csrfToken for ${cafe.id}`);
    }
    return { accessToken, csrfToken: body.csrfToken };
}

function makeHeaders(auth: AuthTokens): Record<string, string> {
    return {
        'Authorization': `Bearer ${auth.accessToken}`,
        'User-Agent': 'PostmanRuntime/7.36.0',
        'Csrf-Token': auth.csrfToken,
        'Cookie': `csrf-token=${auth.csrfToken}`,
        'Content-Type': 'application/json',
    };
}

async function apiGet<T>(cafe: SimpleCafe, auth: AuthTokens, path: string): Promise<ApiResult<T>> {
    const res = await fetch(`${baseUrl(cafe)}${path}`, { headers: makeHeaders(auth) });
    if (!res.ok) {
        return { _error: true, _status: res.status, _statusText: res.statusText };
    }
    return await res.json() as T;
}

async function apiPost<T>(cafe: SimpleCafe, auth: AuthTokens, path: string, body: object): Promise<ApiResult<T>> {
    const res = await fetch(`${baseUrl(cafe)}${path}`, {
        method: 'POST',
        headers: makeHeaders(auth),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        return { _error: true, _status: res.status, _statusText: res.statusText };
    }
    return await res.json() as T;
}

// Recursively find keys whose names hint at schedule/hours data
function findScheduleFields(obj: unknown, path = ''): Record<string, unknown> {
    const results: Record<string, unknown> = {};
    if (!isObjectRecord(obj)) {
        return results;
    }

    const KEYWORDS = [
        'schedul', 'hour', 'time', 'open', 'close', 'cron',
        'days', 'operating', 'available', 'meal', 'period',
    ];

    for (const key of Object.keys(obj)) {
        const lowercaseKey = key.toLowerCase();
        const fullPath = path ? `${path}.${key}` : key;
        const child = obj[key];
        if (KEYWORDS.some(keyword => lowercaseKey.includes(keyword))) {
            results[fullPath] = child;
        }
        if (isObjectRecord(child) && !Array.isArray(child)) {
            Object.assign(results, findScheduleFields(child, fullPath));
        }
        // For arrays, inspect only the first element to avoid huge output
        if (Array.isArray(child) && child.length > 0 && isObjectRecord(child[0])) {
            Object.assign(results, findScheduleFields(child[0], `${fullPath}[0]`));
        }
    }
    return results;
}

// ── main ─────────────────────────────────────────────────────────────────────

const dayOfWeek = new Date().toLocaleString('en-US', { weekday: 'long' });
console.log(`\n${'='.repeat(80)}`);
console.log(`CAFE HOURS INVESTIGATION — ${dayOfWeek}, ${new Date().toISOString()}`);
console.log(`${'='.repeat(80)}\n`);

for (const cafe of CAFES) {

    console.log(`\n${'─'.repeat(80)}`);
    console.log(`CAFE: ${cafe.name} (${cafe.id})`);
    console.log(`${'─'.repeat(80)}`);

    let auth: AuthTokens;
    try {
        auth = await anonymousLogin(cafe);
        console.log('✅ Anonymous login OK');
    } catch (err: unknown) {
        console.log(`❌ Login failed: ${getErrorMessage(err)}`);
        continue;
    }

    // ── 1. /config ──────────────────────────────────────────────────────────
    console.log('\n📋 GET /config');
    const config = await apiGet<ConfigResponse>(cafe, auth, '/config');
    if (isApiErrorResponse(config)) {
        console.log(`  ❌ Error: ${config._status}`);
        continue;
    }

    const tenantId = config.tenantID;
    const contextId = config.contextID;
    const storeList = config.storeList ?? [];
    const displayProfileId = storeList[0]?.displayProfileId?.[0];
    const storeId = storeList[0]?.storeInfo?.storeInfoId;

    console.log(`  tenantId=${tenantId}  contextId=${contextId}  displayProfileId=${displayProfileId}  storeId=${storeId}`);
    console.log('  Top-level keys:', Object.keys(config).join(', '));

    // Dump all schedule-related fields from config
    const configScheduleFields = findScheduleFields(config);
    if (Object.keys(configScheduleFields).length > 0) {
        console.log('  Schedule-related fields in /config:');
        for (const [k, value] of Object.entries(configScheduleFields)) {
            console.log(`    ${k}:`, JSON.stringify(value).substring(0, 200));
        }
    }

    // Dump config.properties fully (it contains scheduledOrdering, streamLinedHomepage, etc.)
    if (config.properties) {
        console.log('  config.properties keys:', Object.keys(config.properties).join(', '));
        if (config.properties.scheduledOrdering) {
            console.log('  config.properties.scheduledOrdering:', JSON.stringify(config.properties.scheduledOrdering));
        }
        if (config.properties.streamLinedHomepage) {
            console.log('  config.properties.streamLinedHomepage:', JSON.stringify(config.properties.streamLinedHomepage));
        }
    }

    if (!tenantId || !displayProfileId) {
        console.log('  ⚠️  Missing tenantId or displayProfileId, skipping further endpoints');
        continue;
    }

    // ── 2. /sites/{tenantId} (site-level hours) ─────────────────────────────
    console.log(`\n📋 GET /sites/${tenantId}`);
    const siteData = await apiGet<unknown>(cafe, auth, `/sites/${tenantId}`);
    if (isApiErrorResponse(siteData)) {
        console.log(`  ❌ Error: ${siteData._status}`);
    } else {
        const site = Array.isArray(siteData) ? siteData[0] : siteData;
        if (site) {
            console.log('  Top-level keys:', Object.keys(site).join(', '));
            // Key fields
            console.log('  availableAt:', JSON.stringify(site.availableAt));
            console.log('  allAvailableList:', JSON.stringify(site.allAvailableList));
            console.log('  nextAvailableAt:', JSON.stringify(site.nextAvailableAt));
            console.log('  timeZone:', site.timeZone);
            console.log('  todaySchedulingEnabled:', site.todaySchedulingEnabled);
            console.log('  isScheduleOrderEnabled:', site.isScheduleOrderEnabled);
        }
    }

    // ── 3. /sites/{tenantId}/{contextId} (detailed site config) ──────────────
    if (contextId) {
        console.log(`\n📋 GET /sites/${tenantId}/${contextId}`);
        const siteDetail = await apiGet<unknown>(cafe, auth, `/sites/${tenantId}/${contextId}`);
        if (isApiErrorResponse(siteDetail)) {
            console.log(`  ❌ Error: ${siteDetail._status} ${siteDetail._statusText}`);
        } else {
            // Dump schedule-related fields
            const schedFields = findScheduleFields(siteDetail);
            if (Object.keys(schedFields).length > 0) {
                console.log('  Schedule-related fields:');
                for (const [k, value] of Object.entries(schedFields)) {
                    console.log(`    ${k}:`, JSON.stringify(value).substring(0, 200));
                }
            }
        }
    }

    // ── 4. concepts endpoint (with scheduledDay=0) ──────────────────────────
    console.log(`\n📋 POST /sites/${tenantId}/${contextId}/concepts/${displayProfileId}  (scheduledDay=0)`);
    const conceptsToday = await apiPost<ConceptResponse[]>(
        cafe, auth,
        `/sites/${tenantId}/${contextId}/concepts/${displayProfileId}`,
        { scheduledDay: 0 },
    );
    if (isApiErrorResponse(conceptsToday)) {
        console.log(`  ❌ Error: ${conceptsToday._status} ${conceptsToday._statusText}`);
        console.log('  (This likely means the cafe is closed today)');
    } else if (Array.isArray(conceptsToday)) {
        console.log(`  ✅ Got ${conceptsToday.length} concepts`);
        for (let i = 0; i < Math.min(conceptsToday.length, 4); i++) {
            const concept = conceptsToday[i]!;
            console.log(`  concept[${i}] name="${concept.name}"`);
            console.log(`    availableAt:`, JSON.stringify(concept.availableAt));
            console.log(`    openScheduleExpression:`, concept.openScheduleExpression);
            console.log(`    closeScheduleExpression:`, concept.closeScheduleExpression);
            if (concept.schedule) {
                console.log(`    schedule (${concept.schedule.length} entries):`);
                for (const scheduleEntry of concept.schedule.slice(0, 5)) {
                    console.log(`      ${scheduleEntry.scheduledExpression}  (${scheduleEntry['@c']})  meal-period=${scheduleEntry.properties?.['meal-period-id'] || 'N/A'}`);
                }
            }
        }
    }

    // ── 5. concepts with scheduleTime to see if it changes results ───────────
    console.log(`\n📋 POST concepts (with scheduleTime + scheduledDay=0)`);
    const conceptsWithTime = await apiPost<ConceptResponse[]>(
        cafe, auth,
        `/sites/${tenantId}/${contextId}/concepts/${displayProfileId}`,
        {
            isEasyMenuEnabled: false,
            scheduleTime: { startTime: '11:00 AM', endTime: '11:15 PM' },
            scheduledDay: 0,
        },
    );
    if (isApiErrorResponse(conceptsWithTime)) {
        console.log(`  ❌ Error: ${conceptsWithTime._status} — same as without scheduleTime`);
    } else if (Array.isArray(conceptsWithTime)) {
        console.log(`  ✅ Got ${conceptsWithTime.length} concepts (same count? ${conceptsWithTime.length === (Array.isArray(conceptsToday) ? conceptsToday.length : -1)})`);
        // Compare availableAt
        if (Array.isArray(conceptsToday)) {
            for (let i = 0; i < Math.min(conceptsWithTime.length, 3); i++) {
                const withTime = conceptsWithTime[i]!;
                const withoutTime = conceptsToday[i];
                const same = JSON.stringify(withTime.availableAt) === JSON.stringify(withoutTime?.availableAt);
                console.log(`    concept[${i}] "${withTime.name}" availableAt same as without scheduleTime? ${same}`);
                if (!same) {
                    console.log(`      without: ${JSON.stringify(withoutTime?.availableAt)}`);
                    console.log(`      with:    ${JSON.stringify(withTime.availableAt)}`);
                }
            }
        }
    }

    // ── 6. concepts for tomorrow (scheduledDay=1) to see schedule patterns ──
    console.log(`\n📋 POST concepts (scheduledDay=1, tomorrow)`);
    const conceptsTomorrow = await apiPost<ConceptResponse[]>(
        cafe, auth,
        `/sites/${tenantId}/${contextId}/concepts/${displayProfileId}`,
        { scheduledDay: 1 },
    );
    if (isApiErrorResponse(conceptsTomorrow)) {
        console.log(`  ❌ Error: ${conceptsTomorrow._status} — tomorrow might also be closed`);
    } else if (Array.isArray(conceptsTomorrow)) {
        console.log(`  ✅ Got ${conceptsTomorrow.length} concepts for tomorrow`);
        for (let i = 0; i < Math.min(conceptsTomorrow.length, 3); i++) {
            const concept = conceptsTomorrow[i]!;
            console.log(`    concept[${i}] "${concept.name}"`);
            console.log(`      availableAt:`, JSON.stringify(concept.availableAt));
            console.log(`      openScheduleExpression:`, concept.openScheduleExpression);
            console.log(`      closeScheduleExpression:`, concept.closeScheduleExpression);
        }
    }

    // ── 7. concepts for Monday (scheduledDay=2 if Saturday) ─────────────────
    const today = new Date().getDay(); // 0=Sun, 6=Sat
    const daysUntilMonday = today === 0 ? 1 : today === 6 ? 2 : (8 - today);
    console.log(`\n📋 POST concepts (scheduledDay=${daysUntilMonday}, next Monday)`);
    const conceptsMonday = await apiPost<ConceptResponse[]>(
        cafe, auth,
        `/sites/${tenantId}/${contextId}/concepts/${displayProfileId}`,
        { scheduledDay: daysUntilMonday },
    );
    if (isApiErrorResponse(conceptsMonday)) {
        console.log(`  ❌ Error: ${conceptsMonday._status}`);
    } else if (Array.isArray(conceptsMonday)) {
        console.log(`  ✅ Got ${conceptsMonday.length} concepts for Monday`);
        for (let i = 0; i < Math.min(conceptsMonday.length, 3); i++) {
            const concept = conceptsMonday[i]!;
            console.log(`    concept[${i}] "${concept.name}"`);
            console.log(`      availableAt:`, JSON.stringify(concept.availableAt));
            console.log(`      openScheduleExpression:`, concept.openScheduleExpression);
            console.log(`      closeScheduleExpression:`, concept.closeScheduleExpression);
        }
    }

    console.log('');
}

console.log('\n' + '='.repeat(80));
console.log('INVESTIGATION COMPLETE');
console.log('='.repeat(80));
