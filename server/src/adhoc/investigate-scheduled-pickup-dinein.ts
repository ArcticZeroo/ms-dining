/**
 * Live investigation script: scheduled pickup + dine-in request params.
 *
 * Self-contained — uses Node 18+ native fetch, no project imports.
 * It creates only PENDING orders, then calls close-order with obviously fake
 * payment data to observe validation behavior. Anonymous login needs no creds.
 *
 * Run: cd server && npx tsx src/adhoc/investigate-scheduled-pickup-dinein.ts
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

const CAFE: SimpleCafe = { id: 'cafe25', name: 'Café 25' };
const DEFAULT_SCHEDULE_TIME = { startTime: '11:00 AM', endTime: '11:15 PM' };
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

    const conceptsResponse = await api<unknown[]>(cafe, auth, `/sites/${tenantId}/${contextId}/concepts/${displayProfileId}`, {
        method: 'POST',
        body:   {
            scheduleTime: DEFAULT_SCHEDULE_TIME,
            scheduledDay: 0,
        },
    });
    console.log(`POST concepts with scheduleTime => ${conceptsResponse.status} ${conceptsResponse.statusText}`);
    if (!conceptsResponse.ok || !Array.isArray(conceptsResponse.body)) {
        throw new Error(`Could not fetch concepts: ${jsonPreview(conceptsResponse.body)}`);
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
    scheduledFields?: Record<string, unknown>;
}) {
    return {
        item:               params.cartItem,
        currencyDetails:    CURRENCY_DETAILS,
        schedule:           params.scheduleData.schedule,
        orderTimeZone:      'PST8PDT',
        storePriceLevel:    params.orderingContext.storePriceLevel,
        scheduledDay:       0,
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
    deliveryMode: 'pickup' | 'dineIn';
    includeDineInTable?: boolean;
    scheduledFields?: Record<string, unknown>;
}) {
    const now = new Date();
    const closedTime = now.toISOString();
    const nowString = toLocalIsoOffset(now);
    const dates = receiptDateTime(now);
    const tenantId = textOf(params.config.tenantID);
    const contextId = textOf(params.config.contextID);
    const displayProfileId = textOf(params.config.storeList?.[0]?.displayProfileId?.[0]);
    const storeInfo = buildStoreInfo(asRecord(params.config.storeList?.[0]?.storeInfo ?? params.siteData.storeInfo));
    const deliveryProperties = buildDeliveryProperties(params.siteData, params.deliveryMode, params.includeDineInTable);
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
            scheduledDay:        0,
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
            scheduledDay:                  0,
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
        scheduledDay:                    0,
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

async function run() {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`LIVE SCHEDULED PICKUP / DINE-IN PROBE — ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}`);

    const auth = await anonymousLogin(CAFE);
    console.log('Anonymous login OK');

    const configResponse = await api<ConfigResponse>(CAFE, auth, '/config');
    if (!configResponse.ok) {
        throw new Error(`GET /config failed: ${configResponse.status}`);
    }
    const config = configResponse.body;
    const tenantId = textOf(config.tenantID);
    const contextId = textOf(config.contextID);
    const displayProfileId = textOf(config.storeList?.[0]?.displayProfileId?.[0]);
    console.log(`config tenant=${tenantId} context=${contextId} profile=${displayProfileId}`);

    const siteResponse = await api<unknown[]>(CAFE, auth, `/sites/${tenantId}`);
    if (!siteResponse.ok || !Array.isArray(siteResponse.body)) {
        throw new Error(`GET /sites/${tenantId} failed: ${siteResponse.status} ${jsonPreview(siteResponse.body)}`);
    }
    const siteData = asRecord(siteResponse.body[0]);
    const orderingContext = makeOrderingContext(siteData, displayProfileId);
    console.log(`site flags: dineIn=${jsonPreview(siteData.dineInConfig)} pickup=${jsonPreview(siteData.pickUpConfig)} table=${jsonPreview(siteData.tableNumberConfig)}`);

    const liveItem = await findOrderableCartItem(CAFE, auth, config, siteData);
    console.log(`Selected item="${liveItem.cartItem.displayText}" station="${textOf(liveItem.station.name)}"`);

    const scheduledFields = {
        scheduleType:       'laterToday',
        scheduleTime:       '11:15 AM - 11:30 AM',
        daysToAdd:          0,
        timezone:           'PST8PDT',
        calendarDaysToAdd:  0,
    };
    console.log(`Candidate scheduled fields: ${jsonPreview(scheduledFields)}`);

    for (const waitProbe of [
        { name: 'pickup ASAP', body: { cartItems: [liveItem.cartItem], varianceEnabled: true, variancePercentage: 5, kitchenContextId: null, deliveryType: 'pickup' } },
        { name: 'pickup scheduled', body: { cartItems: [liveItem.cartItem], varianceEnabled: true, variancePercentage: 5, kitchenContextId: null, deliveryType: 'pickup', ...scheduledFields, scheduledDay: 0 } },
        { name: 'dineIn ASAP', body: { cartItems: [liveItem.cartItem], varianceEnabled: true, variancePercentage: 5, kitchenContextId: null, deliveryType: 'dineIn' } },
        { name: 'dineIn scheduled', body: { cartItems: [liveItem.cartItem], varianceEnabled: true, variancePercentage: 5, kitchenContextId: null, deliveryType: 'dineIn', ...scheduledFields, scheduledDay: 0 } },
    ]) {
        const response = await api(CAFE, auth, `/order/${tenantId}/${contextId}/getWaitTimeForItems`, {
            method: 'POST',
            body:   waitProbe.body,
        });
        console.log(`\nWAIT ${waitProbe.name}: ${response.status} ${response.statusText}`);
        console.log(jsonPreview(response.body, 900));
    }

    const scheduledCreate = buildCreateOrderBody({
        cartItem: liveItem.cartItem,
        scheduleData: liveItem.scheduleData,
        orderingContext,
        scheduledFields,
    });
    const scheduledOrderResponse = await createOrderForScenario(CAFE, auth, config, scheduledCreate, 'scheduled pickup candidate');

    const scheduledTimeCreate = buildCreateOrderBody({
        cartItem: liveItem.cartItem,
        scheduleData: liveItem.scheduleData,
        orderingContext,
        scheduledFields: {
            scheduledTime:     scheduledFields.scheduleTime,
            daysToAdd:         scheduledFields.daysToAdd,
            timezone:          scheduledFields.timezone,
            calendarDaysToAdd: scheduledFields.calendarDaysToAdd,
        },
    });
    await createOrderForScenario(CAFE, auth, config, scheduledTimeCreate, 'scheduledTime-name candidate');

    const dineInCreate = buildCreateOrderBody({
        cartItem: liveItem.cartItem,
        scheduleData: liveItem.scheduleData,
        orderingContext,
    });
    const dineInOrderResponse = await createOrderForScenario(CAFE, auth, config, dineInCreate, 'dine-in close candidate');

    const closeScenarios = [
        { name: 'scheduled pickup (scheduleTime fields)', created: scheduledOrderResponse, mode: 'pickup' as const, fields: scheduledFields, includeDineInTable: undefined },
        { name: 'scheduled pickup (scheduledTime fields)', created: scheduledOrderResponse, mode: 'pickup' as const, fields: {
            scheduledTime:     scheduledFields.scheduleTime,
            scheduledDay:      0,
            daysToAdd:         scheduledFields.daysToAdd,
            timezone:          scheduledFields.timezone,
            calendarDaysToAdd: scheduledFields.calendarDaysToAdd,
        }, includeDineInTable: undefined },
        { name: 'dine-in with tableNumber', created: dineInOrderResponse, mode: 'dineIn' as const, fields: {}, includeDineInTable: true },
        { name: 'dine-in without tableNumber', created: dineInOrderResponse, mode: 'dineIn' as const, fields: {}, includeDineInTable: false },
    ];
    for (const scenario of closeScenarios) {
        if (!scenario.created) {
            console.log(`\nCLOSE ${scenario.name}: skipped because create-order failed.`);
            continue;
        }
        const orderDetails = asRecord(scenario.created.orderDetails);
        const lineItems = asArray(orderDetails.lineItems).map(asRecord);
        const receiptItems = [liveItem.cartItem].map((item, index) => ({
            ...item,
            languageCode: 'en',
            lineItemId:   textOf(lineItems[index]?.lineItemId),
        }));
        const closeBody = buildCloseOrderBody({
            config,
            siteData,
            orderDetails,
            receiptItems,
            orderingContext,
            readyTime: { minTime: 11, maxTime: 12 },
            deliveryMode: scenario.mode,
            includeDineInTable: scenario.includeDineInTable,
            scheduledFields: scenario.fields,
        });
        const closeResponse = await api(CAFE, auth, `/order/${tenantId}/${contextId}/orderId/${orderDetails.orderId}/processPaymentAndClosedOrder`, {
            method: 'POST',
            body:   closeBody,
        });
        console.log(`\nCLOSE ${scenario.name} with FAKE payment: ${closeResponse.status} ${closeResponse.statusText}`);
        console.log(jsonPreview(closeResponse.body, 1800));
    }
}

run().catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
});
