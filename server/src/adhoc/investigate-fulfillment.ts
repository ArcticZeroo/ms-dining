/**
 * Investigation script: scheduled pickup + dine-in fulfillment config.
 *
 * READ-ONLY. Only hits config/site-data/lead-time endpoints — it never creates
 * an order or sends payment. Anonymous login requires no credentials.
 *
 * Run: cd server && npx tsx src/adhoc/investigate-fulfillment.ts
 */

interface SimpleCafe { id: string; name: string }

const CAFES: SimpleCafe[] = [
    { id: 'cafe25',    name: 'Café 25' },
    { id: 'bobae',     name: 'Bobae' },
    { id: 'foodhall4', name: 'Food Hall 4' },
    { id: 'cafe16',    name: 'Café 16' },
];

const baseUrl = (cafe: SimpleCafe) => `https://${cafe.id}.buy-ondemand.com/api`;

interface AuthTokens { accessToken: string; csrfToken: string }
interface ApiErrorResponse { _error: true; _status: number; _statusText: string }
type ApiResult<T> = T | ApiErrorResponse;

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const isApiErrorResponse = <T>(value: ApiResult<T>): value is ApiErrorResponse =>
    typeof value === 'object' && value != null && '_error' in value;
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value != null;

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

async function apiGet<T>(cafe: SimpleCafe, auth: AuthTokens, path: string): Promise<ApiResult<T>> {
    const res = await fetch(`${baseUrl(cafe)}${path}`, { headers: makeHeaders(auth) });
    if (!res.ok) {
        return { _error: true, _status: res.status, _statusText: res.statusText };
    }
    return await res.json() as T;
}

async function apiPost<T>(cafe: SimpleCafe, auth: AuthTokens, path: string, body: object): Promise<ApiResult<T>> {
    const res = await fetch(`${baseUrl(cafe)}${path}`, {
        method:  'POST',
        headers: makeHeaders(auth),
        body:    JSON.stringify(body),
    });
    if (!res.ok) {
        return { _error: true, _status: res.status, _statusText: res.statusText };
    }
    return await res.json() as T;
}

const print = (label: string, value: unknown) => {
    console.log(`  ${label}: ${JSON.stringify(value)}`);
};

interface ConfigResponse extends Record<string, unknown> {
    tenantID?: string;
    contextID?: string;
    storeList?: Array<{ storeInfo?: { timezone?: string } }>;
    properties?: Record<string, unknown> & {
        scheduledOrdering?: unknown;
        streamLinedHomepage?: { featureEnabled?: boolean; filters?: { fulfillmentType?: unknown } };
    };
}

console.log(`\n${'='.repeat(80)}`);
console.log(`FULFILLMENT INVESTIGATION — ${new Date().toISOString()}`);
console.log(`${'='.repeat(80)}`);

for (const cafe of CAFES) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`CAFE: ${cafe.name} (${cafe.id})`);
    console.log(`${'─'.repeat(80)}`);

    let auth: AuthTokens;
    try {
        auth = await anonymousLogin(cafe);
        console.log('✅ Anonymous login OK');
    } catch (err) {
        console.log(`❌ Login failed: ${getErrorMessage(err)}`);
        continue;
    }

    console.log('\n📋 GET /config');
    const config = await apiGet<ConfigResponse>(cafe, auth, '/config');
    if (isApiErrorResponse(config)) {
        console.log(`  ❌ Error: ${config._status} ${config._statusText}`);
        continue;
    }

    const tenantId = config.tenantID;
    print('tenantID', tenantId);
    print('contextID', config.contextID);
    print('properties.scheduledOrdering', config.properties?.scheduledOrdering);
    print('streamLinedHomepage.featureEnabled', config.properties?.streamLinedHomepage?.featureEnabled);
    print('streamLinedHomepage.filters.fulfillmentType', config.properties?.streamLinedHomepage?.filters?.fulfillmentType);

    if (!tenantId) {
        console.log('  ⚠️ No tenantID — skipping site-data/lead-time probes');
        continue;
    }

    console.log(`\n📋 GET /sites/${tenantId}`);
    const siteData = await apiGet<Array<Record<string, unknown>>>(cafe, auth, `/sites/${tenantId}`);
    let siteTimeZone = config.storeList?.[0]?.storeInfo?.timezone ?? 'PST8PDT';
    if (isApiErrorResponse(siteData)) {
        console.log(`  ❌ Error: ${siteData._status} ${siteData._statusText}`);
    } else if (Array.isArray(siteData) && isObjectRecord(siteData[0])) {
        const site = siteData[0]!;
        const storeInfo = isObjectRecord(site.storeInfo) ? site.storeInfo : {};
        siteTimeZone = typeof storeInfo.timezone === 'string' ? storeInfo.timezone : siteTimeZone;
        print('dineInConfig', site.dineInConfig);
        print('pickUpConfig', site.pickUpConfig);
        print('tableNumberConfig', site.tableNumberConfig);
        print('deliveryConfig', site.deliveryConfig);
        print('availableAt', site.availableAt);
        print('storeInfo.timezone', siteTimeZone);
        const displayOptions = isObjectRecord(site.displayOptions) ? site.displayOptions : {};
        print('displayOptions.check-type', displayOptions['check-type']);
        print('displayOptions.onDemandTerminalId', displayOptions.onDemandTerminalId);
        print('displayOptions.onDemandEmployeeId', displayOptions.onDemandEmployeeId);
        print('displayOptions.profit-center-id', displayOptions['profit-center-id']);
        print('storePriceLevel', site.storePriceLevel);
        print('todaySchedulingEnabled', site.todaySchedulingEnabled);
        print('isScheduleOrderEnabled', site.isScheduleOrderEnabled);
        print('isAsapOrderDisabled', site.isAsapOrderDisabled);
        print('isFutureSchedulingEnabled', site.isFutureSchedulingEnabled);
        print('isCalendarSchedulingEnabled', site.isCalendarSchedulingEnabled);
        print('futureScheduledDays', site.futureScheduledDays);
        print('siteScheduleConfig keys', Object.keys(site).filter(key => /schedul|fulfil|delivery|pickup|dine|order/i.test(key)));
    } else {
        print('site-data (unexpected shape)', siteData);
    }

    const leadTimeBody = [{ id: config.contextID, timeZone: siteTimeZone }];
    console.log(`\n📋 POST /sites/${tenantId}/getKitchenLeadTimesForHomePage ${JSON.stringify(leadTimeBody)}`);
    const leadTimes = await apiPost<Array<Record<string, unknown>>>(cafe, auth, `/sites/${tenantId}/getKitchenLeadTimesForHomePage`, leadTimeBody);
    if (isApiErrorResponse(leadTimes)) {
        console.log(`  ❌ Error: ${leadTimes._status} ${leadTimes._statusText}`);
    } else if (Array.isArray(leadTimes)) {
        const capacityDetail = (leadTimes[0]?.kitchenLeadTimeForStores as Array<Record<string, unknown>> | undefined)?.[0]?.capacityDetail;
        print('capacityDetail', capacityDetail);
        if (isObjectRecord(capacityDetail)) {
            print('leadTime', capacityDetail.leadTime);
            print('minimumItemPreparationTimeInMinutes', capacityDetail.minimumItemPreparationTimeInMinutes);
        }
    } else {
        print('leadTimes (unexpected shape)', leadTimes);
    }
}

console.log(`\n${'='.repeat(80)}\nDONE\n${'='.repeat(80)}`);
