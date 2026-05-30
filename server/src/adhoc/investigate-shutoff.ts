/**
 * Investigation: What does the BuyOnDemand API return for a shut-off cafe (cafe25)?
 *
 * Checks:
 *   1. /config → applicationShutOffConfig
 *   2. concepts → does it 410 for today? for future days?
 *   3. Compare with an open cafe (cafe16) to see normal applicationShutOffConfig
 *
 * Self-contained — uses Node 18+ native fetch, no project dependencies.
 * Run: cd server && npx tsx src/adhoc/investigate-shutoff.ts
 */

interface SimpleCafe { id: string; name: string }

const CAFES: SimpleCafe[] = [
    { id: 'cafe25',    name: 'Café 25 (shut off)' },
    { id: 'cafe16',    name: 'Café 16 (open)' },
    { id: 'foodhall4', name: 'Food Hall 4 (open)' },
];

function baseUrl(cafe: SimpleCafe) {
    return `https://${cafe.id}.buy-ondemand.com/api`;
}

interface AuthTokens { accessToken: string; csrfToken: string }
interface ConfigResponse {
    tenantID?: string;
    contextID?: string;
    enabledLocation?: unknown;
    isConfigurationComplete?: unknown;
    properties?: {
        applicationShutOffConfig?: {
            isShutOffEnabled?: boolean;
            instructionText?: string;
        };
    } & Record<string, unknown>;
    storeList?: Array<{ displayProfileId?: string[] }>;
}
interface ConceptSummary {
    name?: string;
    availableAt?: unknown;
    availableNow?: unknown;
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

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

const dayOfWeek = new Date().toLocaleString('en-US', { weekday: 'long' });
console.log(`\n${'='.repeat(80)}`);
console.log(`SHUT-OFF CONFIG INVESTIGATION — ${dayOfWeek}, ${new Date().toISOString()}`);
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

    const headers = makeHeaders(auth);

    // ── 1. /config — focus on applicationShutOffConfig ──────────────────────
    console.log('\n📋 GET /config');
    const configRes = await fetch(`${baseUrl(cafe)}/config`, { headers });
    if (!configRes.ok) {
        console.log(`  ❌ Error: ${configRes.status}`);
        continue;
    }
    const config = await configRes.json() as ConfigResponse;

    console.log('  config.properties keys:', Object.keys(config.properties ?? {}).join(', '));

    const shutOff = config.properties?.applicationShutOffConfig;
    if (shutOff) {
        console.log('  applicationShutOffConfig:');
        console.log(`    isShutOffEnabled: ${shutOff.isShutOffEnabled}`);
        console.log(`    instructionText: "${shutOff.instructionText}"`);
    } else {
        console.log('  applicationShutOffConfig: NOT PRESENT');
    }

    // Also check enabledLocation — might be related
    console.log(`  enabledLocation: ${config.enabledLocation}`);
    console.log(`  isConfigurationComplete: ${config.isConfigurationComplete}`);

    const tenantId = config.tenantID;
    const contextId = config.contextID;
    const storeList = config.storeList ?? [];
    const displayProfileId = storeList[0]?.displayProfileId?.[0];

    if (!tenantId || !displayProfileId) {
        console.log('  ⚠️  Missing tenantId or displayProfileId');
        continue;
    }

    // ── 2. Concepts for today (scheduledDay=0) ──────────────────────────────
    for (const day of [0, 1, 2, 3]) {
        const label = day === 0 ? 'today' : `day+${day}`;
        const conceptsRes = await fetch(
            `${baseUrl(cafe)}/sites/${tenantId}/${contextId}/concepts/${displayProfileId}`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    scheduleTime: { startTime: '11:00 AM', endTime: '11:15 PM' },
                    scheduledDay: day,
                }),
            },
        );

        if (conceptsRes.status === 410) {
            console.log(`  📋 concepts (${label}): 410 Gone — cafe unavailable`);
        } else if (!conceptsRes.ok) {
            console.log(`  📋 concepts (${label}): ${conceptsRes.status} ${conceptsRes.statusText}`);
            const text = await conceptsRes.text();
            console.log(`    Body: ${text.substring(0, 100)}`);
        } else {
            const body = await conceptsRes.json() as ConceptSummary[];
            console.log(`  📋 concepts (${label}): ${body.length} station(s)`);
            for (const station of body.slice(0, 2)) {
                console.log(`    - "${station.name}" availableAt=${JSON.stringify(station.availableAt)} availableNow=${station.availableNow}`);
            }
        }
    }

    console.log('');
}

console.log('\n' + '='.repeat(80));
console.log('INVESTIGATION COMPLETE');
console.log('='.repeat(80));
