/**
 * Probe script: discover BuyOnDemand priceLevel IDs and their names.
 *
 * READ-ONLY. Anonymous login, then fetch a station's items and dump every
 * entry in each item's `priceLevels` map (id -> name -> amount). The `name`
 * field encodes the year (e.g. "MS_2024", "MS_2025", "MS_2026"), which is
 * what we need to update the PRICE_YEAR_BY_LEVEL map in price-history.ts.
 *
 * Self-contained (raw fetch, no BuyOnDemandClient / services registry / DB).
 *
 * Run: cd server && npx tsx src/adhoc/probe-price-levels.ts
 */

interface SimpleCafe { id: string; name: string }

// A few cafes to sample — different concepts may expose different price levels.
const CAFES: SimpleCafe[] = [
    { id: 'foodhall4', name: 'Food Hall 4' },
    { id: 'cafe25',    name: 'Café 25' },
    { id: 'cafe16',    name: 'Café 16' },
];

const MAX_ITEMS_PER_STATION = 12;

const baseUrl = (cafe: SimpleCafe) => `https://${cafe.id}.buy-ondemand.com/api`;

interface AuthTokens { accessToken: string; csrfToken: string }

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

async function anonymousLogin(cafe: SimpleCafe): Promise<AuthTokens> {
    const res = await fetch(`${baseUrl(cafe)}/login/anonymous`, {
        method:  'GET',
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

const makeHeaders = (auth: AuthTokens): Record<string, string> => ({
    'Authorization': `Bearer ${auth.accessToken}`,
    'User-Agent':    'PostmanRuntime/7.36.0',
    'Csrf-Token':    auth.csrfToken,
    'Cookie':        `csrf-token=${auth.csrfToken}`,
    'Content-Type':  'application/json',
});

async function apiGet<T>(cafe: SimpleCafe, auth: AuthTokens, path: string): Promise<T> {
    const res = await fetch(`${baseUrl(cafe)}${path}`, { headers: makeHeaders(auth) });
    if (!res.ok) {
        throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
    }
    return await res.json() as T;
}

async function apiPost<T>(cafe: SimpleCafe, auth: AuthTokens, path: string, body: object): Promise<T> {
    const res = await fetch(`${baseUrl(cafe)}${path}`, {
        method:  'POST',
        headers: makeHeaders(auth),
        body:    JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
    }
    return await res.json() as T;
}

interface ConfigResponse {
    tenantID?: string;
    contextID?: string;
    storeList?: Array<{ displayProfileId?: string[] }>;
}

interface StationListItem {
    id: string;
    name?: string;
    priceLevelConfig?: { menuId?: string };
    menus?: Array<{
        id: string;
        categories?: Array<{
            name?: string;
            items?: string[];
            subCategories?: Array<{ items?: string[] }>;
        }>;
    }>;
}

interface PriceLevelData {
    priceLevelId?: string;
    name?: string;
    price?: { amount?: string; currencyUnit?: string };
}

interface GetItemsResponseItem {
    id: string;
    displayText?: string;
    priceLevels?: Record<string, PriceLevelData>;
}

const collectItemIds = (station: StationListItem): string[] => {
    const menuId = station.priceLevelConfig?.menuId;
    const menu = station.menus?.find(candidate => candidate.id === menuId) ?? station.menus?.[0];
    const itemIds: string[] = [];
    for (const category of menu?.categories ?? []) {
        for (const itemId of category.items ?? []) {
            itemIds.push(itemId);
        }
        for (const subCategory of category.subCategories ?? []) {
            for (const itemId of subCategory.items ?? []) {
                itemIds.push(itemId);
            }
        }
    }
    return Array.from(new Set(itemIds));
};

// Aggregated across every cafe: priceLevelId -> { name, sample amounts }
const globalLevels = new Map<string, { name: string; amounts: Set<string> }>();

const recordLevel = (id: string, data: PriceLevelData) => {
    const name = data.name ?? '(no name)';
    const amount = data.price?.amount;
    if (!globalLevels.has(id)) {
        globalLevels.set(id, { name, amounts: new Set() });
    }
    const entry = globalLevels.get(id)!;
    entry.name = name;
    if (amount != null) {
        entry.amounts.add(amount);
    }
};

const probeCafe = async (cafe: SimpleCafe) => {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`CAFE: ${cafe.name} (${cafe.id})`);
    console.log(`${'─'.repeat(70)}`);

    const auth = await anonymousLogin(cafe);
    console.log('✅ Anonymous login OK');

    const config = await apiGet<ConfigResponse>(cafe, auth, '/config');
    const tenantId = config.tenantID;
    const contextId = config.contextID;
    const displayProfileId = config.storeList?.[0]?.displayProfileId?.[0];

    if (!tenantId || !contextId || !displayProfileId) {
        console.log(`  ⚠️ Missing tenant/context/displayProfile — skipping (${tenantId}/${contextId}/${displayProfileId})`);
        return;
    }

    const stations = await apiPost<StationListItem[]>(
        cafe,
        auth,
        `/sites/${tenantId}/${contextId}/concepts/${displayProfileId}`,
        { scheduleTime: { startTime: '11:00 AM', endTime: '11:15 PM' }, scheduledDay: 0 },
    );

    const station = stations.find(candidate => collectItemIds(candidate).length > 0);
    if (!station) {
        console.log('  ⚠️ No station with items found');
        return;
    }

    const menuId = station.priceLevelConfig?.menuId ?? station.menus?.[0]?.id;
    const itemIds = collectItemIds(station).slice(0, MAX_ITEMS_PER_STATION);
    console.log(`  Station: ${station.name ?? station.id} (menuId ${menuId}) — sampling ${itemIds.length} items`);

    const items = await apiPost<GetItemsResponseItem[]>(
        cafe,
        auth,
        `/sites/${tenantId}/${contextId}/kiosk-items/get-items`,
        {
            conceptId:          station.id,
            currencyUnit:       'USD',
            isCategoryHasItems: true,
            menuPriceLevel:     { menuId },
            show86edItems:      false,
            useIgPosApi:        false,
            itemIds,
        },
    );

    for (const item of items) {
        const levels = item.priceLevels ?? {};
        const summary = Object.entries(levels)
            .map(([id, data]) => `${id}=${data.name ?? '?'}($${data.price?.amount ?? '?'})`)
            .join('  ');
        console.log(`    • ${item.displayText ?? item.id}: ${summary || '(no priceLevels)'}`);
        for (const [id, data] of Object.entries(levels)) {
            recordLevel(id, data);
        }
    }
};

console.log(`\n${'='.repeat(70)}`);
console.log(`PRICE LEVEL PROBE — ${new Date().toISOString()}`);
console.log(`${'='.repeat(70)}`);

for (const cafe of CAFES) {
    try {
        await probeCafe(cafe);
    } catch (err) {
        console.log(`  ❌ ${cafe.id} failed: ${getErrorMessage(err)}`);
    }
}

console.log(`\n${'='.repeat(70)}`);
console.log('DISTINCT PRICE LEVELS FOUND (id → name → sample amounts)');
console.log(`${'='.repeat(70)}`);
const sortedLevels = Array.from(globalLevels.entries()).sort(([a], [b]) => Number(a) - Number(b));
for (const [id, { name, amounts }] of sortedLevels) {
    const sampleAmounts = Array.from(amounts).slice(0, 5).join(', ');
    console.log(`  ${id.padStart(4)}  ${name.padEnd(16)}  $${sampleAmounts}`);
}
console.log('');
