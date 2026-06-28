import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Live investigation script: dine-in validation controls.
 *
 * Self-contained — uses Node 18+ native fetch, no project imports.
 * It creates only PENDING orders, then calls close-order with obviously fake
 * payment data to observe validation behavior. Anonymous login needs no creds.
 *
 * Run: cd server && npx tsx src/adhoc/investigate-dinein-validation.ts
 */

interface SimpleCafe { id: string; name: string }
interface AuthTokens { accessToken: string; csrfToken: string }
interface ApiResponse<T = unknown> { ok: boolean; status: number; statusText: string; body: T; rawText: string }
interface ConfigResponse extends Record<string, unknown> {
    tenantID?: string;
    contextID?: string;
    storeList?: Array<{
        displayProfileId?: string[];
        storeInfo?: Record<string, unknown> & { storeInfoId?: string; storeName?: string; timezone?: string };
    }>;
}

const CAFES: SimpleCafe[] = [
    { id: 'cafe25', name: 'Café 25' },
    { id: 'bobae',  name: 'Bobae' },
];
let CAFE: SimpleCafe = CAFES[0]!;
const DEFAULT_SCHEDULE_TIME = { startTime: '11:00 AM', endTime: '11:15 PM' };
const RESULT_DATE = '2026-06-27';
const GARBAGE_VALUE = 'thisIsNotValid_zzz';
const GARBAGE_DELIVERY_TYPE = 'thisIsNotAValidDeliveryType_zzz';
const CURRENCY_DETAILS = {
    currencyDecimalDigits: '2',
    currencyCultureName:   'en-US',
    currencyCode:          'USD',
    currencySymbol:        '$',
};
const FAKE_ALIAS = 'BoD Test';
const FAKE_PHONE = '+15550101010';
const FAKE_PAYMENT_TOKEN = '4111111111111111';
const FAKE_API_TOKEN = '00000000-0000-0000-0000-000000000000';

const baseUrl = (cafe: SimpleCafe) => `https://${cafe.id}.buy-ondemand.com/api`;
const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value != null && !Array.isArray(value);
const asRecord = (value: unknown): Record<string, unknown> => isObjectRecord(value) ? value : {};
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const textOf = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const numberText = (value: unknown, fallback = '0.00') => {
    const text = textOf(value, '');
    return text.length > 0 ? text : fallback;
};
const jsonPreview = (value: unknown, max = 1400) => {
    const text = JSON.stringify(value, null, 2);
    return text.length > max ? `${text.slice(0, max)}…` : text;
};

async function anonymousLogin(cafe: SimpleCafe): Promise<AuthTokens> {
    const res = await fetch(`${baseUrl(cafe)}/login/anonymous`, {
        method:  'GET',
        headers: { 'User-Agent': 'PostmanRuntime/7.36.0' },
    });
    if (!res.ok) {
        throw new Error(`Login failed for ${cafe.id}: ${res.status}`);
    }
    const accessToken = res.headers.get('access-token');
    const body = await res.json() as { csrfToken?: string };
    if (!accessToken || !body.csrfToken) {
        throw new Error(`Anonymous login for ${cafe.id} did not return both auth tokens.`);
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

async function api<T = unknown>(
    cafe: SimpleCafe,
    auth: AuthTokens,
    path: string,
    options: { method?: string; body?: unknown } = {},
): Promise<ApiResponse<T>> {
    const res = await fetch(`${baseUrl(cafe)}${path}`, {
        method:  options.method ?? 'GET',
        headers: makeHeaders(auth),
        body:    options.body == null ? undefined : JSON.stringify(options.body),
    });
    const rawText = await res.text();
    let body: unknown = rawText;
    if (rawText.length > 0) {
        try {
            body = JSON.parse(rawText);
        } catch {
            body = rawText;
        }
    }
    return { ok: res.ok, status: res.status, statusText: res.statusText, body: body as T, rawText };
}

function buildStoreInfo(storeInfo: Record<string, unknown>) {
    const storeInfoOptions = asRecord(storeInfo.storeInfoOptions);
    return {
        ...storeInfo,
        storeInfoOptions: {
            ...storeInfoOptions,
            birConfig: storeInfoOptions.birConfig ?? {
                displayText:                        'OR#',
                acknowledgementReceiptDisplayText:  'AR#',
                acknowledgementReceiptIndicator:    'Acknowledgement Receipt#',
                officialReceiptIndicator:           'Official Receipt#',
            },
            calories: storeInfoOptions.calories ?? {
                abbreviation: 'Cal',
                fullName:     'Calories',
            },
        },
        address: storeInfo.address ?? [' ', '  '],
    };
}

function findMenuItemIds(menu: Record<string, unknown>) {
    const ids: string[] = [];
    for (const categoryValue of asArray(menu.categories)) {
        const category = asRecord(categoryValue);
        ids.push(...asArray(category.items).filter((itemId): itemId is string => typeof itemId === 'string'));
        for (const subCategoryValue of asArray(category.subCategories)) {
            const subCategory = asRecord(subCategoryValue);
            ids.push(...asArray(subCategory.items).filter((itemId): itemId is string => typeof itemId === 'string'));
        }
    }
    return [...new Set(ids)];
}

function buildCartItem(rawItem: Record<string, unknown>, station: Record<string, unknown>, context: {
    tenantId: string;
    contextId: string;
    storePriceLevel: string;
    menuId: string;
}) {
    const now = Date.now();
    const itemId = textOf(rawItem.id, textOf(rawItem.itemId, 'unknown-item'));
    const displayText = textOf(rawItem.displayText, textOf(rawItem.name, 'BoD Test Item'));
    const amount = numberText(rawItem.amount, numberText(asRecord(rawItem.price).amount, '0.00'));
    const receiptText = textOf(rawItem.receiptText, displayText);

    return {
        ...rawItem,
        id:                    itemId,
        contextId:             context.contextId,
        tenantId:              context.tenantId,
        itemId:                textOf(rawItem.itemId, itemId),
        name:                  textOf(rawItem.name, displayText),
        displayText,
        count:                 1,
        quantity:              1,
        amount,
        price:                 rawItem.price ?? { currencyUnit: 'USD', amount },
        menuId:                context.menuId,
        conceptId:             textOf(station.id),
        conceptName:           textOf(asRecord(station.conceptOptions).onDemandDisplayText, textOf(asRecord(station.conceptOptions).displayText, textOf(station.name, CAFE.name))),
        holdAndFire:           false,
        hasModifiers:          false,
        modifierTotal:         0,
        mealPeriodId:          null,
        uniqueId:              `${itemId}-${now + 1}`,
        cartItemId:            crypto.randomUUID(),
        menuPriceLevelId:      context.storePriceLevel,
        menuPriceLevelApplied: false,
        receiptText,
        kpText:                textOf(rawItem.kpText, receiptText),
        kitchenDisplayText:    textOf(rawItem.kitchenDisplayText, receiptText),
        isDeleted:             rawItem.isDeleted ?? false,
        isActive:              rawItem.isActive ?? false,
        isSoldByWeight:        rawItem.isSoldByWeight ?? false,
        tareWeight:            rawItem.tareWeight ?? 0,
        isDiscountable:        rawItem.isDiscountable ?? true,
        allowPriceOverride:    rawItem.allowPriceOverride ?? true,
        isTaxIncluded:         rawItem.isTaxIncluded ?? false,
        taxClasses:            rawItem.taxClasses ?? [],
        kitchenVideoId:        rawItem.kitchenVideoId ?? ' ',
        kitchenVideoCategoryId: rawItem.kitchenVideoCategoryId ?? 0,
        kitchenCookTimeSeconds: rawItem.kitchenCookTimeSeconds ?? 0,
        skus:                  rawItem.skus ?? [],
        itemType:              rawItem.itemType ?? 'ITEM',
        itemImages:            rawItem.itemImages ?? [],
        isAvailableToGuests:   rawItem.isAvailableToGuests ?? true,
        isPreselectedToGuests: rawItem.isPreselectedToGuests ?? false,
        tagNames:              rawItem.tagNames ?? [],
        tagIds:                rawItem.tagIds ?? [],
        substituteItemId:      rawItem.substituteItemId ?? '',
        isSubstituteItem:      rawItem.isSubstituteItem ?? false,
        sequence:              rawItem.sequence ?? 0,
        description:           rawItem.description ?? rawItem.longDescription ?? '',
        longDescription:       rawItem.longDescription ?? rawItem.description ?? '',
        options:               rawItem.options ?? [],
        attributes:            rawItem.attributes ?? [],
        selectedModifiers:     undefined,
        lineItemInstructions:  [],
        properties:            {
            ...asRecord(rawItem.properties),
            cartGuid:     `${itemId}-${now}`,
            scannedItem:  false,
            priceLevelId: context.storePriceLevel,
        },
    };
}

function findStationSchedule(station: Record<string, unknown>) {
    return {
        schedule:                asArray(station.schedule),
        openScheduleExpression:  textOf(station.openScheduleExpression),
        closeScheduleExpression: textOf(station.closeScheduleExpression),
    };
}

async function findOrderableCartItem(cafe: SimpleCafe, auth: AuthTokens, config: ConfigResponse, siteData: Record<string, unknown>) {
    const tenantId = textOf(config.tenantID);
    const contextId = textOf(config.contextID);
    const displayProfileId = textOf(config.storeList?.[0]?.displayProfileId?.[0]);
    const storePriceLevel = textOf(siteData.storePriceLevel);

    let conceptsResponse: ApiResponse<unknown[]> | null = null;
    let selectedScheduledDay = 0;
    const conceptProbes = [
        { name: 'scheduleTime + isEasyMenuEnabled=false day=0', body: { isEasyMenuEnabled: false, scheduleTime: DEFAULT_SCHEDULE_TIME, scheduledDay: 0 }, scheduledDay: 0 },
        { name: 'scheduleTime only day=0', body: { scheduleTime: DEFAULT_SCHEDULE_TIME, scheduledDay: 0 }, scheduledDay: 0 },
        { name: 'scheduledDay only day=0', body: { scheduledDay: 0 }, scheduledDay: 0 },
        ...[1, 2, 3, 4, 5, 6, 7].flatMap(scheduledDay => [
            { name: `scheduleTime + isEasyMenuEnabled=false day=${scheduledDay}`, body: { isEasyMenuEnabled: false, scheduleTime: DEFAULT_SCHEDULE_TIME, scheduledDay }, scheduledDay },
            { name: `scheduledDay only day=${scheduledDay}`, body: { scheduledDay }, scheduledDay },
        ]),
    ];
    for (const conceptProbe of conceptProbes) {
        conceptsResponse = await api<unknown[]>(cafe, auth, `/sites/${tenantId}/${contextId}/concepts/${displayProfileId}`, {
            method: 'POST',
            body:   conceptProbe.body,
        });
        console.log(`POST concepts (${conceptProbe.name}) => ${conceptsResponse.status} ${conceptsResponse.statusText}`);
        if (conceptsResponse.ok && Array.isArray(conceptsResponse.body)) {
            selectedScheduledDay = conceptProbe.scheduledDay;
            break;
        }
    }
    if (conceptsResponse == null || !conceptsResponse.ok || !Array.isArray(conceptsResponse.body)) {
        throw new Error(`Could not fetch concepts: ${jsonPreview(conceptsResponse?.body)}`);
    }

    for (const stationValue of conceptsResponse.body) {
        const station = asRecord(stationValue);
        const menuId = textOf(asRecord(station.priceLevelConfig).menuId);
        const menus = asArray(station.menus).map(asRecord);
        const menu = menus.find(candidate => candidate.id === menuId) ?? menus.find(candidate => findMenuItemIds(candidate).length > 0);
        if (!menu) {
            continue;
        }
        const itemIds = findMenuItemIds(menu).slice(0, 12);
        if (itemIds.length === 0) {
            continue;
        }
        const itemResponse = await api<unknown[]>(cafe, auth, `/sites/${tenantId}/${contextId}/kiosk-items/get-items`, {
            method: 'POST',
            body:   {
                conceptId:          station.id,
                currencyUnit:       'USD',
                isCategoryHasItems: true,
                menuPriceLevel:     { menuId: textOf(menu.id, menuId) },
                show86edItems:      false,
                useIgPosApi:        false,
                itemIds,
            },
        });
        console.log(`POST kiosk-items/get-items station="${station.name}" menu=${menu.id} => ${itemResponse.status} ${itemResponse.statusText}`);
        if (!itemResponse.ok || !Array.isArray(itemResponse.body)) {
            continue;
        }
        const rawItem = itemResponse.body
            .map(asRecord)
            .find(item => textOf(item.amount, textOf(asRecord(item.price).amount, '0.00')) !== '0.00' && asArray(item.childGroups).length === 0)
            ?? itemResponse.body.map(asRecord).find(item => textOf(item.amount, textOf(asRecord(item.price).amount, '0.00')) !== '0.00')
            ?? asRecord(itemResponse.body[0]);
        if (!rawItem.id) {
            continue;
        }
        return {
            station,
            cartItem: buildCartItem(rawItem, station, {
                tenantId,
                contextId,
                storePriceLevel,
                menuId: textOf(menu.id, menuId),
            }),
            scheduledDay: selectedScheduledDay,
            scheduleData: findStationSchedule(station),
        };
    }

    throw new Error('Could not find an orderable item in live concept/menu data.');
}

function makeOrderingContext(siteData: Record<string, unknown>, displayProfileId: string) {
    const displayOptions = asRecord(siteData.displayOptions);
    return {
        onDemandTerminalId: textOf(displayOptions.onDemandTerminalId),
        onDemandEmployeeId: textOf(displayOptions.onDemandEmployeeId),
        profitCenterId:     textOf(displayOptions['profit-center-id']),
        checkTypeId:        textOf(displayOptions['check-type']),
        storePriceLevel:    textOf(siteData.storePriceLevel),
        displayProfileId,
    };
}

function buildCreateOrderBody(params: {
    cartItem: Record<string, unknown>;
    scheduleData: { schedule: unknown[]; openScheduleExpression: string; closeScheduleExpression: string };
    orderingContext: ReturnType<typeof makeOrderingContext>;
    scheduledDay?: number;
    scheduledFields?: Record<string, unknown>;
}) {
    const scheduledDay = params.scheduledDay ?? 0;
    return {
        item:               params.cartItem,
        currencyDetails:    CURRENCY_DETAILS,
        schedule:           params.scheduleData.schedule,
        orderTimeZone:      'PST8PDT',
        storePriceLevel:    params.orderingContext.storePriceLevel,
        scheduledDay,
        useIgOrderApi:      true,
        onDemandTerminalId: params.orderingContext.onDemandTerminalId,
        properties:         {
            checkTypeId:               params.orderingContext.checkTypeId || undefined,
            employeeId:                params.orderingContext.onDemandEmployeeId,
            profitCenterId:            params.orderingContext.profitCenterId,
            orderSourceSystem:         'onDemand',
            orderNumberSequenceLength: 4,
            orderNumberNameSpace:      params.orderingContext.onDemandTerminalId,
            displayProfileId:          params.orderingContext.displayProfileId,
            voidReasonId:              '11',
            priceLevelId:              params.orderingContext.storePriceLevel,
        },
        conceptSchedule:    {
            openScheduleExpression:  params.scheduleData.openScheduleExpression,
            closeScheduleExpression: params.scheduleData.closeScheduleExpression,
        },
        isMultiItem:        false,
        scannedOrder:       false,
        ...(params.scheduledFields ?? {}),
    };
}

function buildDeliveryProperties(siteData: Record<string, unknown>, mode: 'pickup' | 'dineIn', includeDineInTable = true) {
    const config = asRecord(mode === 'pickup' ? siteData.pickUpConfig : siteData.dineInConfig);
    const text = mode === 'pickup' ? 'PICKUP' : 'DINE IN';
    const fulfillmentDetails: Record<string, unknown> = {
        fulfillmentType: mode === 'pickup' ? 'pickupFormFields' : 'dineInFormFields',
    };
    if (mode === 'dineIn' && includeDineInTable) {
        fulfillmentDetails.tableNumber = 'TEST-1';
    }
    return {
        deliveryOption:     {
            id:                      mode,
            kitchenText:             textOf(config.kitchenText, text),
            displayText:             textOf(config.buttonText, text),
            defaultConfirmationText: textOf(config.defaultConfirmationText, 'Thank you!'),
            conceptEntries:          {},
            isEnabled:               true,
            orderSequence:           1,
        },
        fulfillmentDetails,
        isCutleryEnabled:   false,
        nameCapture:        {
            firstName:   FAKE_ALIAS,
            lastInitial: '',
        },
        nameString:         `${FAKE_ALIAS} `,
        ...(mode === 'dineIn' && includeDineInTable ? { tableNumber: 'TEST-1' } : {}),
    };
}

function toLocalIsoOffset(date: Date, timeZone = 'America/Los_Angeles') {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, fractionalSecondDigits: 3,
        timeZoneName: 'longOffset',
    }).formatToParts(date);
    const find = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
    const tzPart = find('timeZoneName');
    const offset = tzPart === 'GMT' ? '+00:00' : tzPart.slice(3);
    const hour = find('hour') === '24' ? '00' : find('hour');
    return `${find('year')}-${find('month')}-${find('day')}T${hour}:${find('minute')}:${find('second')}.${find('fractionalSecond')}${offset}`;
}

function receiptDateTime(date: Date) {
    const receiptDate = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        month: 'short', day: 'numeric', year: 'numeric',
    }).format(date);
    const receiptTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(date);
    const dateTimeInReceipt = toLocalIsoOffset(date).replace(/\.\d{3}(?=[+-]\d{2}:\d{2}$)/, '');
    return { receiptDate, receiptTime, dateTimeInReceipt, timezoneOffsetMinutes: 420, printDateTime: `${receiptDate} ${receiptTime} ` };
}

function amount(orderDetails: Record<string, unknown>, key: string) {
    return Number(numberText(asRecord(orderDetails[key]).amount, '0.00'));
}

function buildCloseOrderBody(params: {
    config: ConfigResponse;
    siteData: Record<string, unknown>;
    orderDetails: Record<string, unknown>;
    receiptItems: Array<Record<string, unknown>>;
    orderingContext: ReturnType<typeof makeOrderingContext>;
    readyTime: { minTime: number; maxTime: number };
    deliveryMode: string;
    includeDineInTable?: boolean;
    deliveryProperties?: Record<string, unknown>;
    scheduledDay?: number;
    scheduledFields?: Record<string, unknown>;
}) {
    const now = new Date();
    const closedTime = now.toISOString();
    const nowString = toLocalIsoOffset(now);
    const dates = receiptDateTime(now);
    const tenantId = textOf(params.config.tenantID);
    const contextId = textOf(params.config.contextID);
    const scheduledDay = params.scheduledDay ?? 0;
    const displayProfileId = textOf(params.config.storeList?.[0]?.displayProfileId?.[0]);
    const storeInfo = buildStoreInfo(asRecord(params.config.storeList?.[0]?.storeInfo ?? params.siteData.storeInfo));
    const deliveryProperties = params.deliveryProperties ?? buildDeliveryProperties(
        params.siteData,
        params.deliveryMode === 'dineIn' ? 'dineIn' : 'pickup',
        params.includeDineInTable,
    );
    const subtotal = amount(params.orderDetails, 'subTotalAmount');
    const tax = amount(params.orderDetails, 'taxTotalAmount');
    const total = amount(params.orderDetails, 'totalDueAmount') || subtotal + tax;
    const readyTimeDetails = {
        minTime: { minutes: params.readyTime.minTime, fieldType: { name: 'minutes' }, periodType: { name: 'Minutes' } },
        maxTime: { minutes: params.readyTime.maxTime, fieldType: { name: 'minutes' }, periodType: { name: 'Minutes' } },
    };
    const orderNumber = textOf(params.orderDetails.orderNumber, textOf(params.orderDetails.checkNumber, 'FAKE-ORDER'));
    const closeOrderDetails = {
        ...params.orderDetails,
        properties: {
            ...asRecord(params.orderDetails.properties),
            orderNumberSequenceLength: '4',
            profitCenterId:            params.orderingContext.profitCenterId,
            displayProfileId,
            orderNumberNameSpace:      params.orderingContext.onDemandTerminalId,
            openTerminalId:            params.orderingContext.onDemandTerminalId,
            priceLevelId:              params.orderingContext.storePriceLevel,
            employeeId:                params.orderingContext.onDemandEmployeeId,
            mealPeriodId:              '2',
            closedTerminalId:          params.orderingContext.onDemandTerminalId,
            voidReasonId:              '11',
            orderSourceSystem:         'onDemand',
            additionalGuestData:       '{}',
            useIgOrderApi:             'true',
        },
    };

    return {
        amHereConfig:                    { isCurbsidePickup: false, lateTolerance: 5, origin: `https://${CAFE.id}.buy-ondemand.com` },
        authorizedAmount:                total.toFixed(2),
        calorieTotal:                    { baseCalorie: 0, maxCalorie: 0 },
        capacitySuggestionPerformed:     false,
        conceptId:                       textOf(params.receiptItems[0]?.conceptId),
        contextId,
        currencyDetails:                 CURRENCY_DETAILS,
        currencyUnit:                    'USD',
        customCardCodeMapping:           false,
        customerAddress:                 [],
        cyberSourcePaymentData:          null,
        cyberSourceTransactionData:      null,
        deliveryProperties,
        discountInfo:                    [],
        displayProfileId,
        emailInfo:                       { customerAddress: [] },
        engageAccrualEnabled:            false,
        engagePromotionAppliedPromotions: [],
        engagePromotionCardNumber:       null,
        engagePromotionLastName:         '',
        firstName:                       FAKE_ALIAS,
        giftCardSaleDataMap:             {},
        graceCompletionTime:             false,
        gratuityBreakupConfigEnabled:    false,
        igOrderStatusConfig:             {},
        igSettings:                      asRecord(params.siteData.displayOptions),
        isGaPaymentAvailable:            false,
        itemCountdown:                   {},
        kitchenContextId:                null,
        lastName:                        '',
        locizeConfig:                    {
            currentLanguage:     'en',
            shouldUseLocizeText: false,
            domain:              `${CAFE.id}.buy-ondemand.com`,
            storeInfo,
            scheduledDay,
            dateTime:            'en',
            readyTime:           readyTimeDetails,
            deliveryProperties,
            multiLanguageConfig: {},
            locizeVersion:       'production',
        },
        loyaltyGuestInfo:                {},
        loyaltyPayment:                  false,
        mealPeriodId:                    '2',
        mobileNumber:                    FAKE_PHONE,
        mobileNumberCountryCode:         '1',
        multiPassEnabled:                false,
        notifyGuestOnFailure:            false,
        order:                           closeOrderDetails,
        orderGuid:                       null,
        orderVersion:                    1,
        paymentType:                     null,
        processPaymentAsExternalPayment: false,
        profileId:                       displayProfileId,
        profitCenterId:                  params.orderingContext.profitCenterId,
        profitCenterName:                '',
        recallCheck:                     false,
        receiptInfo:                     {
            orderData:                     closeOrderDetails,
            showConceptNameInEmailReceipt: false,
            showConceptNameInTextReceipt:  false,
            showConceptNameInPrintReceipt: false,
            taxBreakupEnabled:             false,
            taxClassList:                  tax > 0 ? [{ amount: `$${tax.toFixed(2)}`, amountValue: tax.toFixed(2) }] : [],
            hideVATInReceipts:             false,
            items:                         params.receiptItems,
            tip:                           0,
            tipAmount:                     0,
            etfEnabled:                    true,
            dateTime:                      'en',
            storePriceLevel:               params.orderingContext.storePriceLevel,
            currencyDetails:               CURRENCY_DETAILS,
            deliveryEnabled:               false,
            readyTime:                     readyTimeDetails,
            deliveryProperties,
            vatEntries:                    [],
            taxIdentificationNumber:       '',
            deliveryConfirmationText:      'Thank you!',
            orderPlacedTime:               closedTime,
            receiptDate:                   dates.receiptDate,
            receiptTime:                   dates.receiptTime,
            timeZone:                      'PST8PDT',
            terminalId:                    params.orderingContext.onDemandTerminalId,
            checkNumber:                   orderNumber,
            selectedSMSCountry:            { value: 'US', label: 'United States', phoneCode: '1' },
            mobileNumber:                  FAKE_PHONE,
            scheduledDay,
            hideAllPrices:                 false,
            hideZeroPrice:                 false,
            complimentaryPayment:          false,
            isPayLater:                    false,
            payLaterConfig:                {},
            discountValues:                [],
            franceFiscalConfig:            { isEnabled: false },
            birConfig:                     asRecord(asRecord(storeInfo.storeInfoOptions).birConfig),
            multiPassEnabled:              false,
            receipientName:                `${FAKE_ALIAS} `,
            orderMessage:                  `Your order will be ready for ${params.deliveryMode} at ${textOf(asRecord(storeInfo).storeName, CAFE.name)} in about ${params.readyTime.minTime} to ${params.readyTime.maxTime} minutes\n\n`,
            dateTimeInReceipt:             dates.dateTimeInReceipt,
            timezoneOffsetMinutes:         dates.timezoneOffsetMinutes,
            printDateTime:                 dates.printDateTime,
            closedTime,
            gratuityWithLabelArray:        false,
            serviceAmountWithLabelArray:   false,
            displayProfileId,
            engagePayment:                 { engageAccountInfoList: [] },
            engageLoyaltyPayment:          { engageLoyaltyAccountInfoList: [] },
        },
        saleTransactionData:             null,
        scannedItemOrder:                false,
        scheduledDay,
        shouldRefundOnFailure:           false,
        siteId:                          contextId,
        storePriceLevel:                 params.orderingContext.storePriceLevel,
        stripeTransactionData:           null,
        subtotal:                        total.toFixed(2),
        tenantId,
        terminalId:                      params.orderingContext.onDemandTerminalId,
        textReceiptConfig:               { textMessageWithReceiptLink: false },
        tipAmount:                       0,
        tipPercent:                      0,
        tokenizedData:                   {
            paymentDetails: {
                taxAmount:             tax.toFixed(2),
                invoiceId:             orderNumber,
                billDate:              textOf(params.orderDetails.created, nowString),
                userCurrentDate:       nowString,
                currencyUnit:          'USD',
                description:           `Order ${orderNumber}`,
                transactionAmount:     total.toFixed(2),
                remainingTipAmount:    '0.00',
                tipAmount:             '0.00',
                style:                 `https://${CAFE.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${CAFE.id}.buy-ondemand.com/false/false/false`,
                multiPaymentAmount:    total,
                isWindCave:            false,
                isCyberSource:         false,
                isCyberSourceWallets:  false,
                language:              'en',
                apiToken:              FAKE_API_TOKEN,
                payTenantId:           tenantId,
                previousTransactionId: null,
                accountNumberMasked:   '411111xxxxxx1111',
                cardIssuer:            'visa',
                expirationYearMonth:   '203012',
                cardHolderName:        FAKE_ALIAS,
                postalCode:            '00000',
            },
            saveCardFlag: false,
            token:        FAKE_PAYMENT_TOKEN,
        },
        previousTransactionId:           null,
        previousTransactionTokenInfo:    null,
        use24HrTimeFormat:               false,
        useIgPosApi:                     false,
        walletPaymentData:               null,
        walletSaleTransactionData:       null,
        ...(params.scheduledFields ?? {}),
    };
}

async function createOrderForScenario(
    cafe: SimpleCafe,
    auth: AuthTokens,
    config: ConfigResponse,
    createBody: Record<string, unknown>,
    scenario: string,
) {
    const tenantId = textOf(config.tenantID);
    const contextId = textOf(config.contextID);
    const response = await api<Record<string, unknown>>(cafe, auth, `/order/${tenantId}/${contextId}/orders`, {
        method: 'POST',
        body:   createBody,
    });
    console.log(`\nCREATE ${scenario}: ${response.status} ${response.statusText}`);
    if (!response.ok) {
        console.log(jsonPreview(response.body));
        return null;
    }
    const orderDetails = asRecord(response.body.orderDetails);
    console.log(`  orderId=${orderDetails.orderId} orderNumber=${orderDetails.orderNumber}`);
    console.log(`  response top-level schedule-ish=${jsonPreview(Object.fromEntries(Object.entries(orderDetails).filter(([key]) => /sched|time|fulfill|delivery/i.test(key))))}`);
    console.log(`  response configuredBuyProperties=${jsonPreview(orderDetails.configuredBuyProperties ?? {})}`);
    console.log(`  response properties schedule-ish=${jsonPreview(Object.fromEntries(Object.entries(asRecord(orderDetails.properties)).filter(([key]) => /sched|time|fulfill|delivery/i.test(key))))}`);
    return response.body;
}

interface RecordedExchange {
    cafe: string;
    experiment: string;
    name: string;
    method: string;
    path: string;
    requestBody: unknown;
    responseStatus: number;
    responseStatusText: string;
    responseBody: unknown;
    responseRawText: string;
}

interface CafeContext {
    cafe: SimpleCafe;
    auth: AuthTokens;
    config: ConfigResponse;
    tenantId: string;
    contextId: string;
    siteData: Record<string, unknown>;
    orderingContext: ReturnType<typeof makeOrderingContext>;
    liveItem: Awaited<ReturnType<typeof findOrderableCartItem>>;
}

const exchanges: RecordedExchange[] = [];

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function buildControlDeliveryProperties(
    siteData: Record<string, unknown>,
    deliveryOptionId: string,
    fulfillmentType: string,
) {
    const pickupConfig = asRecord(siteData.pickUpConfig);
    return {
        deliveryOption:     {
            id:                      deliveryOptionId,
            kitchenText:             textOf(pickupConfig.kitchenText, 'PICKUP'),
            displayText:             textOf(pickupConfig.buttonText, 'PICKUP'),
            defaultConfirmationText: textOf(pickupConfig.defaultConfirmationText, 'Thank you!'),
            conceptEntries:          {},
            isEnabled:               true,
            orderSequence:           1,
        },
        fulfillmentDetails: {
            fulfillmentType,
        },
        isCutleryEnabled:   false,
        nameCapture:        {
            firstName:   FAKE_ALIAS,
            lastInitial: '',
        },
        nameString:         `${FAKE_ALIAS} `,
    };
}

async function recordPost<T = unknown>(
    ctx: CafeContext,
    experiment: string,
    name: string,
    path: string,
    requestBody: unknown,
) {
    const response = await api<T>(ctx.cafe, ctx.auth, path, {
        method: 'POST',
        body:   requestBody,
    });
    exchanges.push({
        cafe: ctx.cafe.id,
        experiment,
        name,
        method: 'POST',
        path,
        requestBody,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        responseBody: response.body,
        responseRawText: response.rawText,
    });
    console.log(`${ctx.cafe.id} ${experiment} ${name}: ${response.status} ${response.statusText} ${jsonPreview(response.body, 300)}`);
    return response;
}

async function prepareCafe(cafe: SimpleCafe): Promise<CafeContext> {
    CAFE = cafe;
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Preparing ${cafe.name} (${cafe.id})`);
    console.log(`${'─'.repeat(80)}`);

    const auth = await anonymousLogin(cafe);
    const configResponse = await api<ConfigResponse>(cafe, auth, '/config');
    if (!configResponse.ok) {
        throw new Error(`${cafe.id} GET /config failed: ${configResponse.status} ${jsonPreview(configResponse.body)}`);
    }
    const config = configResponse.body;
    const tenantId = textOf(config.tenantID);
    const contextId = textOf(config.contextID);
    const displayProfileId = textOf(config.storeList?.[0]?.displayProfileId?.[0]);
    const payConfigResponse = await api(cafe, auth, `/sites/${contextId}/${displayProfileId}`, {
        method: 'POST',
        body:   {
            storeInfo:         buildStoreInfo(asRecord(config.storeList?.[0]?.storeInfo)),
            scheduledDay:      0,
            isEasyMenuEnabled: false,
        },
    });
    console.log(`pay-config warmup => ${payConfigResponse.status} ${payConfigResponse.statusText}`);
    const siteResponse = await api<unknown[]>(cafe, auth, `/sites/${tenantId}`);
    if (!siteResponse.ok || !Array.isArray(siteResponse.body)) {
        throw new Error(`${cafe.id} GET /sites/${tenantId} failed: ${siteResponse.status} ${jsonPreview(siteResponse.body)}`);
    }
    const siteData = asRecord(siteResponse.body[0]);
    const orderingContext = makeOrderingContext(siteData, displayProfileId);
    const liveItem = await findOrderableCartItem(cafe, auth, config, siteData);
    console.log(`tenant=${tenantId} context=${contextId} profile=${displayProfileId}`);
    console.log(`selected item="${liveItem.cartItem.displayText}" station="${textOf(liveItem.station.name)}"`);
    return { cafe, auth, config, tenantId, contextId, siteData, orderingContext, liveItem };
}

async function createPendingOrder(ctx: CafeContext, experiment: string, name: string) {
    const createBody = buildCreateOrderBody({
        cartItem: ctx.liveItem.cartItem,
        scheduleData: ctx.liveItem.scheduleData,
        orderingContext: ctx.orderingContext,
        scheduledDay: ctx.liveItem.scheduledDay,
    });
    const response = await recordPost<Record<string, unknown>>(
        ctx,
        experiment,
        `${name} setup create-order`,
        `/order/${ctx.tenantId}/${ctx.contextId}/orders`,
        createBody,
    );
    if (!response.ok) {
        throw new Error(`${ctx.cafe.id} create pending order failed for ${name}: ${response.status} ${jsonPreview(response.body)}`);
    }
    const orderDetails = asRecord(response.body.orderDetails);
    console.log(`created orderId=${textOf(orderDetails.orderId)} orderNumber=${textOf(orderDetails.orderNumber)}`);
    return response.body;
}

function buildReceiptItems(ctx: CafeContext, orderDetails: Record<string, unknown>) {
    const lineItems = asArray(orderDetails.lineItems).map(asRecord);
    return [ctx.liveItem.cartItem].map((item, index) => ({
        ...item,
        languageCode: 'en',
        lineItemId:   textOf(lineItems[index]?.lineItemId),
    }));
}

function buildCloseBodyForOrder(
    ctx: CafeContext,
    createdOrder: Record<string, unknown>,
    deliveryProperties: Record<string, unknown>,
    deliveryMode: string,
) {
    const orderDetails = asRecord(createdOrder.orderDetails);
    return buildCloseOrderBody({
        config: ctx.config,
        siteData: ctx.siteData,
        orderDetails,
        receiptItems: buildReceiptItems(ctx, orderDetails),
        orderingContext: ctx.orderingContext,
        readyTime: { minTime: 11, maxTime: 12 },
        deliveryMode,
        deliveryProperties,
        scheduledDay: ctx.liveItem.scheduledDay,
    });
}

async function runWaitTimeControls(ctx: CafeContext) {
    const path = `/order/${ctx.tenantId}/${ctx.contextId}/getWaitTimeForItems`;
    const baseBody = {
        cartItems:          [ctx.liveItem.cartItem],
        varianceEnabled:    true,
        variancePercentage: 5,
        kitchenContextId:   null,
        ...(ctx.liveItem.scheduledDay === 0 ? {} : { scheduledDay: ctx.liveItem.scheduledDay }),
    };
    for (const deliveryType of ['pickup', 'dineIn', GARBAGE_DELIVERY_TYPE]) {
        await recordPost(ctx, 'wait-time deliveryType control', `deliveryType=${deliveryType}`, path, {
            ...baseBody,
            deliveryType,
        });
    }
}

async function runDeliveryOptionControls(ctx: CafeContext) {
    const createdOrder = await createPendingOrder(ctx, 'close-order deliveryOption control', 'shared pending order');
    const orderDetails = asRecord(createdOrder.orderDetails);
    const path = `/order/${ctx.tenantId}/${ctx.contextId}/orderId/${textOf(orderDetails.orderId)}/processPaymentAndClosedOrder`;
    const variants = [
        { name: 'pickup', id: 'pickup', fulfillmentType: 'pickupFormFields' },
        { name: 'dineIn', id: 'dineIn', fulfillmentType: 'dineInFormFields' },
        { name: 'garbage', id: GARBAGE_VALUE, fulfillmentType: GARBAGE_VALUE },
    ];
    for (const variant of variants) {
        const deliveryProperties = buildControlDeliveryProperties(ctx.siteData, variant.id, variant.fulfillmentType);
        const closeBody = buildCloseBodyForOrder(ctx, createdOrder, deliveryProperties, variant.id);
        await recordPost(
            ctx,
            'close-order deliveryOption control',
            `${variant.name} id=${variant.id} fulfillmentType=${variant.fulfillmentType}`,
            path,
            closeBody,
        );
    }
}

async function runSchemaBreakControls(ctx: CafeContext) {
    const createdOrder = await createPendingOrder(ctx, 'close-order schema-break control', 'shared pending order');
    const orderDetails = asRecord(createdOrder.orderDetails);
    const path = `/order/${ctx.tenantId}/${ctx.contextId}/orderId/${textOf(orderDetails.orderId)}/processPaymentAndClosedOrder`;
    const baseCloseBody = buildCloseBodyForOrder(
        ctx,
        createdOrder,
        buildControlDeliveryProperties(ctx.siteData, 'pickup', 'pickupFormFields'),
        'pickup',
    );

    const missingOrderBody = cloneJson(baseCloseBody);
    delete (missingOrderBody as Record<string, unknown>).order;

    const malformedOrderBody = cloneJson(baseCloseBody);
    (malformedOrderBody as Record<string, unknown>).order = GARBAGE_VALUE;

    const omittedDeliveryPropertiesBody = cloneJson(baseCloseBody);
    delete (omittedDeliveryPropertiesBody as Record<string, unknown>).deliveryProperties;
    const locizeConfig = asRecord(omittedDeliveryPropertiesBody.locizeConfig);
    const receiptInfo = asRecord(omittedDeliveryPropertiesBody.receiptInfo);
    delete locizeConfig.deliveryProperties;
    delete receiptInfo.deliveryProperties;

    const variants = [
        { name: 'missing top-level order', body: missingOrderBody },
        { name: 'malformed top-level order string', body: malformedOrderBody },
        { name: 'omitted deliveryProperties', body: omittedDeliveryPropertiesBody },
    ];
    for (const variant of variants) {
        await recordPost(ctx, 'close-order schema-break control', variant.name, path, variant.body);
    }
}

function writeResults() {
    const output = {
        runAt: new Date().toISOString(),
        resultDate: RESULT_DATE,
        cafes: CAFES.map(cafe => cafe.id),
        garbageDeliveryType: GARBAGE_DELIVERY_TYPE,
        garbageDeliveryOptionAndFulfillmentType: GARBAGE_VALUE,
        exchanges,
    };
    const outputDirectory = new URL('./results/', import.meta.url);
    mkdirSync(outputDirectory, { recursive: true });
    const outputPath = new URL(`dine-in-validation-control-results-${RESULT_DATE}.json`, outputDirectory);
    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(`\nWrote exact request/response log to ${fileURLToPath(outputPath)}`);
}

async function run() {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`LIVE DINE-IN VALIDATION CONTROL PROBE — ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}`);

    for (const cafe of CAFES) {
        const ctx = await prepareCafe(cafe);
        await runWaitTimeControls(ctx);
        await runDeliveryOptionControls(ctx);
        await runSchemaBreakControls(ctx);
    }

    writeResults();
}

run().catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
});
