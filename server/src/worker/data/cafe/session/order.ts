import { ICartItem, IPaymentCardInfo, SubmitOrderStage } from '@msdining/common/models/cart';
import type { IWaitTimeResponse } from '@msdining/common/models/http';
import { getNamespaceLogger, logError } from '../../../../shared/util/log.js';

const orderLog = getNamespaceLogger('Order');
import { BuyOnDemandClient, JSON_HEADERS } from '../buy-ondemand/buy-ondemand-client.js';
import { createBuyOnDemandClient, getServices } from '../../../../main/services/registry.js';
import {
    IOrderLineItem,
} from '../../../../shared/models/buyondemand/cart.js';
import hat from 'hat';
import { IOrderingContext } from '../../../../shared/models/cart.js';
import { StringUtil } from '../../../../shared/util/string.js';
import { z } from 'zod';
import { fixed } from '../../../../shared/util/math.js';
import { ICafe, IMenuItemBase } from '../../../../shared/models/cafe.js';
import { PhoneValidResult } from 'phone';
import { MEAL_PERIOD } from '../../../../shared/constants/enum.js';
import { fetchWaitTimeWithCartItems } from '../buy-ondemand/wait-time.js';

const ORDER_TIMEZONE = 'PST8PDT';
const DEFAULT_BIR_CONFIG = {
    displayText:                         'OR#',
    acknowledgementReceiptDisplayText:  'AR#',
    acknowledgementReceiptIndicator:    'Acknowledgement Receipt#',
    officialReceiptIndicator:           'Official Receipt#',
};
const DEFAULT_CALORIE_CONFIG = {
    abbreviation: 'Cal',
    fullName:     'Calories',
};
const DEFAULT_STORE_ADDRESS = [' ', '  '];

const logOrderingDebugJson = (cafeName: string, label: string, data: unknown) => {
    orderLog.info(`{${cafeName}} ${label}: ${JSON.stringify(data, null, 2)}`);
};

/**
 * Formats `date` as a local ISO-8601 string with offset (e.g.
 * `"2026-04-23T11:51:56.923-07:00"`), matching the wire format the BoD UI
 * sends for billDate / userCurrentDate. `Date.toISOString()` would emit UTC
 * `Z` form, which the server appears to accept but differs from what the
 * official client sends — keeping the shape identical is cheap insurance.
 */
function toLocalIsoOffset(date: Date, timeZone: string = ORDER_TIMEZONE): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, fractionalSecondDigits: 3,
        timeZoneName: 'longOffset',
    }).formatToParts(date);

    const find = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find(p => p.type === type)?.value ?? '';

    // Intl's longOffset is `GMT-07:00` (or `GMT` for UTC). Strip the `GMT`
    // prefix; treat bare `GMT` as `+00:00`.
    const tzPart = find('timeZoneName');
    const offset = tzPart === 'GMT' ? '+00:00' : tzPart.slice(3);
    // Intl renders midnight as hour=24; normalize back to 00.
    const hour = find('hour') === '24' ? '00' : find('hour');

    return `${find('year')}-${find('month')}-${find('day')}T${hour}:${find('minute')}:${find('second')}.${find('fractionalSecond')}${offset}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

function buildBrowserStoreInfo(storeInfo: Record<string, unknown>): Record<string, unknown> {
    const storeInfoOptions = asRecord(storeInfo.storeInfoOptions) ?? {};

    return {
        ...storeInfo,
        storeInfoOptions: {
            ...storeInfoOptions,
            birConfig: storeInfoOptions.birConfig ?? DEFAULT_BIR_CONFIG,
            calories:  storeInfoOptions.calories ?? DEFAULT_CALORIE_CONFIG,
        },
        address: storeInfo.address ?? DEFAULT_STORE_ADDRESS,
    };
}

function formatReceiptDateTime(date: Date) {
    const receiptDate = new Intl.DateTimeFormat('en-US', {
        timeZone: ORDER_TIMEZONE,
        month:    'short',
        day:      'numeric',
        year:     'numeric',
    }).format(date);
    const receiptTime = new Intl.DateTimeFormat('en-US', {
        timeZone: ORDER_TIMEZONE,
        hour:     'numeric',
        minute:   '2-digit',
        hour12:   true,
    }).format(date);
    const dateTimeInReceipt = toLocalIsoOffset(date).replace(/\.\d{3}(?=[+-]\d{2}:\d{2}$)/, '');
    const offsetMatch = dateTimeInReceipt.match(/([+-])(\d{2}):(\d{2})$/);
    const timezoneOffsetMinutes = offsetMatch == null
        ? 0
        : (offsetMatch[1] === '-' ? 1 : -1) * ((Number(offsetMatch[2]) * 60) + Number(offsetMatch[3]));

    return {
        receiptDate,
        receiptTime,
        dateTimeInReceipt,
        timezoneOffsetMinutes,
        printDateTime: `${receiptDate} ${receiptTime} `,
    };
}

// Validates the POST /orders response. Uses passthrough() so the full object
// (including lineItems, financial totals, taxBreakdown, etc.) is preserved
// for echoing back in the close order request.
const orderDetailsSchema = z.object({
    orderId:               z.string(),
    orderNumber:           z.string(),
    created:               z.string().optional(),
    taxExcludedTotalAmount: z.object({ amount: z.string() }),
    taxTotalAmount:        z.object({ amount: z.string() }),
    totalDueAmount:        z.object({ amount: z.string() }),
    lineItems:             z.array(z.object({ lineItemId: z.string() }).passthrough()),
    properties:            z.record(z.unknown()).optional(),
}).passthrough();

const addToOrderResponseSchema = z.object({
    orderDetails: orderDetailsSchema,
});

type OrderDetails = z.infer<typeof orderDetailsSchema>;

const pickUpConfigSchema = z.object({
    kitchenText:             z.string().optional(),
    buttonText:              z.string().optional(),
    defaultConfirmationText: z.string().optional(),
}).passthrough();

const payConfigSchema = z.object({
    pay:                 z.object({ clientId: z.string() }),
    displayOptions:      z.record(z.unknown()),
    pickUpConfig:        pickUpConfigSchema.optional(),
    emailReceipt:        z.record(z.unknown()).optional(),
    checkTypeId:         z.string().optional(),
    taxBreakupEnabled:   z.boolean().optional(),
    hideVATInReceipts:   z.boolean().optional(),
    hideAllPrices:       z.boolean().optional(),
    hideZeroPrice:       z.boolean().optional(),
    specialInstructions: z.object({
        additionalSpecialInstructions: z.array(z.object({
            characterLimit: z.number(),
            instructionText: z.string(),
            kitchenText: z.string(),
        })).optional(),
    }).passthrough().optional(),
}).passthrough();

type PayConfig = z.infer<typeof payConfigSchema>;

const siteStoreInfoSchema = z.record(z.unknown());

const siteDataItemSchema = z.object({
    storePriceLevel: z.string(),
    displayOptions:  z.object({
        onDemandTerminalId: z.string(),
        onDemandEmployeeId: z.string(),
        'profit-center-id': z.string(),
        'check-type':       z.string().optional(),
    }).passthrough(),
    siteStoreInfo: siteStoreInfoSchema.optional(),
    pickUpConfig: pickUpConfigSchema.optional(),
}).passthrough();

// are preserved when we spread the response into the cart request body.
const kioskItemDetailSchema = z.object({
    id:                      z.string(),
    contextId:               z.string(),
    tenantId:                z.union([z.string(), z.number()]).transform(String),
    itemId:                  z.union([z.string(), z.number()]).transform(String),
    name:                    z.string(),
    displayText:             z.string(),
    amount:                  z.union([z.string(), z.number()]).transform(String),
    price:                   z.object({
        currencyUnit: z.string(),
        amount:       z.string(),
    }),
    menuId:                  z.string(),
    menuPriceLevelId:        z.union([z.string(), z.number()]).transform(String),
    menuPriceLevelApplied:   z.boolean(),
    receiptText:             z.string(),
    kpText:                  z.string(),
    kitchenDisplayText:      z.string(),
    // These are stripped before sending to the cart endpoint
    childGroups:             z.unknown().optional(),
    modifiers:               z.unknown().optional(),
    // Preserved and merged with cart-specific fields (e.g. calories)
    properties:              z.record(z.unknown()).optional(),
}).passthrough();

interface ISerializedModifier {
    // ID of selected option
    id: string;
    // ID of the modifier
    parentGroupId: string;
    description: string;
    selected: true;
    baseAmount: string;
    amount: string;
    childPriceLevelId: string;
    currencyUnit: 'USD';
    tagNames: [];
    tagIds: [];
    isModifierAvailableToGuests: true;
    // TODO: Support multiple of one thing
    //   I don't know of any menu items that support this, though
    quantity: 1;
    count: 1;
    properties: {
        applicableTargetMenuFilter: 'All'
    };
}

interface IIframeCloseOrderParams {
    alias: string;
    phoneData: PhoneValidResult;
    paymentToken: string;
    cardInfo: IPaymentCardInfo;
}

export class CafeOrderSession {
    #orderingContext: IOrderingContext = {
        onDemandTerminalId: '',
        onDemandEmployeeId: '',
        profitCenterId:     '',
        profitCenterName:   '',
        storePriceLevel:    '',
        payClientId:        '',
    };
    #orderId: string | null = null;
    #orderNumber: string | null = null;
    #orderTotalWithoutTax: number = 0;
    #orderTotalTax: number = 0;
    #orderTotalWithTax: number = 0;
    #lastCompletedStage: SubmitOrderStage = SubmitOrderStage.notStarted;
    #cardProcessorToken: string = '';
    // The full orderDetails from the last POST /orders response,
    // echoed back to the close order endpoint as-is.
    #lastOrderDetails: OrderDetails | null = null;
    // The full response from POST /sites/{contextId}/{displayProfileId},
    // used to populate igSettings, deliveryProperties, emailInfo, etc. in the close order.
    #payConfig: PayConfig | null = null;
    // The site data from GET /sites/{tenantId}, used for siteStoreInfo in locizeConfig.
    #siteStoreInfo: z.infer<typeof siteStoreInfoSchema> = {};
    // pickUpConfig from /sites/{tenantId}
    #sitePickUpConfig: z.infer<typeof pickUpConfigSchema> | null = null;
    readonly #cartItems: ICartItem[];
    readonly #lineItemsById = new Map<string, IOrderLineItem>();
    readonly #rawCartItemsForWaitTime: unknown[] = [];
    readonly #conceptIds = new Set<string>();
    // Per-concept schedule data, keyed by concept ID
    readonly #conceptDataById = new Map<string, { schedule: unknown[]; openScheduleExpression: string; closeScheduleExpression: string }>();

    constructor(public client: BuyOnDemandClient, cartItems: ICartItem[]) {
        this.#cartItems = cartItems;
    }

    public static async createAsync(cafe: ICafe, cartItems: ICartItem[]): Promise<CafeOrderSession> {
        orderLog.info(`{${cafe.name}} Creating order session with ${cartItems.length} item(s)`);
        const client = await createBuyOnDemandClient(cafe, { enableHar: true, translateErrors: true });
        orderLog.info(`{${cafe.name}} BuyOnDemand client created (login + config complete)`);
        return new CafeOrderSession(client, cartItems);
    }

    get lastCompletedStage() {
        return this.#lastCompletedStage;
    }

    public get orderNumber() {
        return this.#orderNumber;
    }

    public get orderTotalWithoutTax() {
        return this.#orderTotalWithoutTax;
    }

    public get orderTotalTax() {
        return this.#orderTotalTax;
    }

    public get orderTotalWithTax() {
        return this.#orderTotalWithTax;
    }

    public get orderId() {
        return this.#orderId;
    }

    public get cardProcessorToken() {
        return this.#cardProcessorToken;
    }

    public getCardProcessorUrl(iframeCssUrl?: string) {
        return this._getCardProcessorUrl(this.#cardProcessorToken, iframeCssUrl);
    }

    public get rawCartItemsForWaitTime(): readonly unknown[] {
        return this.#rawCartItemsForWaitTime;
    }

    private async _requestOrderingContextAsync(): Promise<IOrderingContext> {
        orderLog.info(`{${this.client.cafe.name}} Fetching ordering context (site data + pay client ID)`);
        const [siteData, payClientId] = await Promise.all([
            this._fetchSiteData(),
            this._fetchPayConfig(),
        ]);
        orderLog.info(`{${this.client.cafe.name}} Site data + pay client ID fetched`);

        const orderingContext: IOrderingContext = {
            onDemandTerminalId: siteData.displayOptions.onDemandTerminalId,
            onDemandEmployeeId: siteData.displayOptions.onDemandEmployeeId,
            profitCenterId:     siteData.displayOptions['profit-center-id'],
            storePriceLevel:    siteData.storePriceLevel,
            profitCenterName:   '',
            payClientId,
            checkTypeId:        siteData.displayOptions['check-type'],
        };

        orderingContext.profitCenterName = await this._retrieveProfitCenterName(orderingContext.profitCenterId);
        orderLog.info(`{${this.client.cafe.name}} Ordering context complete (profitCenter: ${orderingContext.profitCenterName})`);
        logOrderingDebugJson(this.client.cafe.name, 'Ordering context', orderingContext);

        return orderingContext;
    }

    private async _fetchSiteData() {
        // Tenant ID is the canonical path slot here, mirroring the official BoD
        // UI request. ContextId also works on the server today but is not
        // guaranteed to remain valid.
        const response = await this.client.requestAsync(`/sites/${this.client.config.tenantId}`, {
            method:  'GET',
            headers: JSON_HEADERS
        });

        const json = await response.json();

        const siteDataArray = z.array(siteDataItemSchema).parse(json);

        const siteData = siteDataArray[0];

        if (!siteData) {
            throw new Error('Site data is empty!');
        }

        this.#siteStoreInfo = siteData.siteStoreInfo ?? {};
        this.#sitePickUpConfig = siteData.pickUpConfig ?? null;

        logOrderingDebugJson(this.client.cafe.name, 'Site data response', {
            tenantId:           this.client.config.tenantId,
            contextId:          this.client.config.contextId,
            displayProfileId:   this.client.config.displayProfileId,
            storePriceLevel:    siteData.storePriceLevel,
            onDemandTerminalId: siteData.displayOptions.onDemandTerminalId,
            onDemandEmployeeId: siteData.displayOptions.onDemandEmployeeId,
            profitCenterId:     siteData.displayOptions['profit-center-id'],
            checkTypeId:        siteData.displayOptions['check-type'],
            siteStoreInfo:      this.#siteStoreInfo,
            pickUpConfig:       this.#sitePickUpConfig,
        });

        return siteData;
    }

    private async _fetchPayConfig(): Promise<string> {
        // BoD UI sends the full storeInfo block from /config here and does
        // NOT send a scheduleTime. The server appears to use storeInfo.timezone
        // to scope schedule resolution; missing it (or a hardcoded scheduleTime
        // window) can cause subsequent /concepts and /orders calls to behave as
        // if the cafe is closed, returning CONCEPTS_NOT_AVAILABLE.
        const storeInfo = this.client.config.storeInfo;
        if (storeInfo == null) {
            throw new Error(
                `_fetchPayConfig: storeInfo missing on client.config for ${this.client.cafe.id}. `
                + `Live /config fetch must have failed and the DB fallback path doesn't persist storeInfo yet.`,
            );
        }
        const browserStoreInfo = buildBrowserStoreInfo(storeInfo);

        logOrderingDebugJson(this.client.cafe.name, 'Pay config request identity', {
            path:              `/sites/${this.client.config.contextId}/${this.client.config.displayProfileId}`,
            tenantId:          this.client.config.tenantId,
            contextId:         this.client.config.contextId,
            displayProfileId:  this.client.config.displayProfileId,
            storeInfo:         browserStoreInfo,
            scheduledDay:      0,
            isEasyMenuEnabled: false,
        });

        const response = await this.client.requestAsync(
            `/sites/${this.client.config.contextId}/${this.client.config.displayProfileId}`,
            {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({
                    storeInfo:          browserStoreInfo,
                    scheduledDay:       0,
                    isEasyMenuEnabled:  false,
                })
            }
        );

        const json = await response.json();
        this.#payConfig = payConfigSchema.parse(json);

        logOrderingDebugJson(this.client.cafe.name, 'Pay config response summary', {
            payClientId:       this.#payConfig.pay.clientId,
            displayOptions:    this.#payConfig.displayOptions,
            pickUpConfig:      this.#payConfig.pickUpConfig,
            emailReceipt:      this.#payConfig.emailReceipt,
            responseCheckType: this.#payConfig.checkTypeId,
        });

        return this.#payConfig.pay.clientId;
    }

    private async _retrieveOrderingContextAsync(): Promise<IOrderingContext> {
        return this._requestOrderingContextAsync();
    }

    private _serializeModifiers(cartItem: ICartItem, localMenuItem: IMenuItemBase): Array<ISerializedModifier> {
        const modifiersById = new Map(localMenuItem.modifiers.map(modifier => [modifier.id, modifier]));

        const modifiers: ISerializedModifier[] = [];

        for (const [modifierId, choiceIds] of cartItem.choicesByModifierId) {
            const modifier = modifiersById.get(modifierId);

            if (modifier == null) {
                throw new Error(`Failed to find modifier with id "${modifierId}"`);
            }

            for (const choiceId of choiceIds) {
                const choice = modifier.choices.find(choice => choice.id === choiceId);

                if (choice == null) {
                    throw new Error(`Failed to find choice with id "${choiceId}" for modifier "${modifierId}"`);
                }

                const price = choice.price.toFixed(2);

                modifiers.push({
                    id:                          choiceId,
                    parentGroupId:               modifierId,
                    description:                 choice.description,
                    selected:                    true,
                    baseAmount:                  price,
                    amount:                      price,
                    childPriceLevelId:           this.#orderingContext.storePriceLevel,
                    currencyUnit:                'USD',
                    tagNames:                    [],
                    tagIds:                      [],
                    isModifierAvailableToGuests: true,
                    quantity:                    1,
                    count:                       1,
                    properties:                  {
                        applicableTargetMenuFilter: 'All'
                    }
                });
            }
        }

        return modifiers;
    }

    private async _fetchRawItemDetail(itemId: string, station: { menuId: string }) {
        const requestBody = {
            storePriceLevel:            this.#orderingContext.storePriceLevel,
            currencyUnit:               'USD',
            show86edModifiers:          false,
            terminalId:                 this.#orderingContext.onDemandTerminalId,
            profitCenterId:             this.#orderingContext.profitCenterId,
            useIgPosApi:                false,
            menuPriceLevelId:           this.#orderingContext.storePriceLevel,
            menuId:                     station.menuId,
            menuPriceLevelApplied:      false,
            modifierCountEnabled:       false,
            modifiersPriceLevelEnabled: false,
        };

        logOrderingDebugJson(this.client.cafe.name, 'Kiosk item detail request', {
            path: `/sites/${this.client.config.tenantId}/${this.client.config.contextId}/kiosk-items/${itemId}`,
            body: requestBody,
        });

        const response = await this.client.requestAsync(
            `/sites/${this.client.config.tenantId}/${this.client.config.contextId}/kiosk-items/${itemId}`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(requestBody)
            }
        );

        const rawItemDetail = kioskItemDetailSchema.parse(await response.json());

        logOrderingDebugJson(this.client.cafe.name, 'Kiosk item detail response summary', {
            id:                    rawItemDetail.id,
            itemId:                rawItemDetail.itemId,
            menuId:                rawItemDetail.menuId,
            tenantId:              rawItemDetail.tenantId,
            contextId:             rawItemDetail.contextId,
            menuPriceLevelId:      rawItemDetail.menuPriceLevelId,
            menuPriceLevelApplied: rawItemDetail.menuPriceLevelApplied,
            amount:                rawItemDetail.amount,
            displayText:           rawItemDetail.displayText,
        });

        return rawItemDetail;
    }

    private async _addItemToCart(cartItem: ICartItem) {
        orderLog.info(`{${this.client.cafe.name}} Adding item ${cartItem.itemId} (qty: ${cartItem.quantity}) to cart`);
        const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: cartItem.itemId });

        if (menuItem == null) {
            throw new Error(`Failed to find menu item with id "${cartItem.itemId}"`);
        }

        const station = await getServices().data.station.retrieveStation({ stationId: menuItem.stationId });

        if (station == null) {
            throw new Error(`Failed to find station for menu item "${cartItem.itemId}"`);
        }

        logOrderingDebugJson(this.client.cafe.name, 'Local cart item lookup', {
            cartItemId:        cartItem.itemId,
            quantity:          cartItem.quantity,
            stationId:         station.id,
            stationName:       station.name,
            stationMenuId:     station.menuId,
            localMenuItemId:   menuItem.id,
            localMenuItemName: menuItem.name,
            selectedModifiers: [...cartItem.choicesByModifierId].map(([modifierId, choiceIds]) => ({
                modifierId,
                choiceIds: [...choiceIds],
            })),
        });

        const rawItemDetail = await this._fetchRawItemDetail(cartItem.itemId, station);

        this.#conceptIds.add(station.id);

        const conceptData = this.#conceptDataById.get(station.id);
        if (conceptData == null) {
            throw new Error(`No concept schedule data found for concept "${station.id}" (${station.name}). Available: ${[...this.#conceptDataById.keys()].join(', ')}`);
        }

        const serializedModifiers = this._serializeModifiers(cartItem, menuItem);
        const cartItemId = hat();
        const cartGuid = `${menuItem.id}-${Date.now()}`;

        const instructions = cartItem.specialInstructions ? [
            { label: '', text: cartItem.specialInstructions }
        ] : [];

        const modifierTotal = serializedModifiers.reduce((sum, mod) => sum + Number(mod.amount), 0);

        // Build item by spreading the raw API response and adding/overriding cart-specific fields.
        // Remove childGroups and modifiers since the cart request uses selectedModifiers instead.
        const { childGroups: _, modifiers: __, ...rawItemFields } = rawItemDetail;

        const requestBody = {
            item:               {
                ...rawItemFields,
                properties:           {
                    ...rawItemFields.properties,
                    cartGuid,
                    scannedItem:  false,
                    priceLevelId: this.#orderingContext.storePriceLevel,
                },
                count:                cartItem.quantity,
                quantity:             cartItem.quantity,
                // BoD UI omits selectedModifiers entirely for items with no
                // modifiers. Always-present `[]` is most likely benign, but
                // matching the wire shape removes one more delta from the
                // request body the server validates against.
                ...(serializedModifiers.length > 0 ? { selectedModifiers: serializedModifiers } : {}),
                lineItemInstructions: instructions,
                conceptId:            station.id,
                conceptName:          station.name,
                holdAndFire:          false,
                hasModifiers:         serializedModifiers.length > 0,
                modifierTotal,
                mealPeriodId:         null,
                uniqueId:             cartGuid,
                cartItemId,
            },
            currencyDetails:    {
                currencyDecimalDigits: '2',
                currencyCultureName:   'en-US',
                currencyCode:          'USD',
                currencySymbol:        '$',
            },
            schedule:           conceptData.schedule,
            orderTimeZone:      ORDER_TIMEZONE,
            storePriceLevel:    this.#orderingContext.storePriceLevel,
            scheduledDay:       0,
            useIgOrderApi:      true,
            onDemandTerminalId: this.#orderingContext.onDemandTerminalId,
            properties:         {
                checkTypeId:               this.#orderingContext.checkTypeId,
                employeeId:                this.#orderingContext.onDemandEmployeeId,
                profitCenterId:            this.#orderingContext.profitCenterId,
                orderSourceSystem:         'onDemand',
                orderNumberSequenceLength: 4,
                orderNumberNameSpace:      this.#orderingContext.onDemandTerminalId,
                displayProfileId:          this.client.config.displayProfileId,
                voidReasonId:              '11',
                priceLevelId:              this.#orderingContext.storePriceLevel,
            },
            conceptSchedule:    {
                openScheduleExpression:  conceptData.openScheduleExpression,
                closeScheduleExpression: conceptData.closeScheduleExpression,
            },
            isMultiItem:        false,
            scannedOrder:       false,
        };

        logOrderingDebugJson(this.client.cafe.name, 'Add-to-cart request body', requestBody);

        // Store the built cart item for wait time API (needs full item data for accurate estimates)
        this.#rawCartItemsForWaitTime.push(requestBody.item);

        const response = await this.client.requestAsync(
            `/order/${this.client.config.tenantId}/${this.client.config.contextId}/orders`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(requestBody),
            }
        );

        const json = await response.json();
        const { orderDetails } = addToOrderResponseSchema.parse(json);
        logOrderingDebugJson(this.client.cafe.name, 'Add-to-cart response orderDetails', orderDetails);

        // Seems like the cart might be fake. We appear to get a new order number every time we add an item?
        this.#orderNumber = orderDetails.orderNumber;
        this.#orderId = orderDetails.orderId;
        this.#lastOrderDetails = orderDetails;

        // These seem to be incremental for some reason, despite the naming and structure of the response. /shrug
        this.#orderTotalTax += Number(orderDetails.taxTotalAmount.amount);
        this.#orderTotalWithoutTax += Number(orderDetails.taxExcludedTotalAmount.amount);
        this.#orderTotalWithTax += Number(orderDetails.totalDueAmount.amount);

        orderLog.info(`{${this.client.cafe.name}} Item ${cartItem.itemId} added — orderId: ${orderDetails.orderId}, orderNumber: ${orderDetails.orderNumber}, runningTotal: $${this.#orderTotalWithTax.toFixed(2)}`);

        for (const lineItem of orderDetails.lineItems) {
            this.#lineItemsById.set(lineItem.lineItemId, lineItem);
        }
    }

    private async _populateCart() {
        orderLog.info(`{${this.client.cafe.name}} Populating cart (${this.#cartItems.length} item(s))`);
        await this._fetchConceptSchedule();

        // Don't  parallelize, not sure what happens on the server if we do multiple concurrent adds
        for (const cartItem of this.#cartItems) {
            await this._addItemToCart(cartItem);
        }
        orderLog.info(`{${this.client.cafe.name}} Cart population complete — total: $${this.#orderTotalWithTax.toFixed(2)}`);
    }

    private async _fetchConceptSchedule() {
        orderLog.info(`{${this.client.cafe.name}} Fetching concept schedule`);
        const response = await this.client.requestAsync(
            `/sites/${this.client.config.tenantId}/${this.client.config.contextId}/concepts/${this.client.config.displayProfileId}`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                // BoD UI sends only { scheduledDay }. Adding a fixed scheduleTime
                // window asks the server "show me concepts available 11am-11:15pm"
                // which can legitimately return none (e.g. a cafe that closes at
                // 2pm), surfacing as CONCEPTS_NOT_AVAILABLE downstream. The menu
                // sync path in stations.ts still needs scheduleTime because it
                // fetches menus at non-now times (e.g. 11am menu at 9am).
                body:    JSON.stringify({
                    scheduledDay: 0,
                })
            }
        );

        const json = await response.json();

        const conceptSchema = z.object({
            id:                      z.string(),
            schedule:                z.array(z.unknown()),
            openScheduleExpression:  z.string(),
            closeScheduleExpression: z.string(),
        }).passthrough();

        const concepts = z.array(conceptSchema).parse(json);

        if (concepts.length === 0) {
            throw new Error('No concepts returned from API');
        }

        for (const concept of concepts) {
            this.#conceptDataById.set(concept.id, {
                schedule:                concept.schedule,
                openScheduleExpression:  concept.openScheduleExpression,
                closeScheduleExpression: concept.closeScheduleExpression,
            });
        }

        orderLog.info(`{${this.client.cafe.name}} Concept schedule fetched (${concepts.length} concept(s))`);
        logOrderingDebugJson(this.client.cafe.name, 'Concept schedule identities', concepts.map(concept => ({
            conceptId:               concept.id,
            scheduleEntryCount:      concept.schedule.length,
            openScheduleExpression:  concept.openScheduleExpression,
            closeScheduleExpression: concept.closeScheduleExpression,
        })));
    }

    private async _getCardProcessorSiteToken(iframeCssUrl?: string) {
        if (StringUtil.isNullOrWhitespace(this.#orderNumber)) {
            throw new Error('Order number is not set');
        }

        if (this.#orderTotalWithoutTax === 0 || this.#orderTotalWithTax === 0) {
            throw new Error('Order totals cannot be zero');
        }

        const billDate = this.#lastOrderDetails?.created ?? toLocalIsoOffset(new Date());
        const nowString = toLocalIsoOffset(new Date());

        const response = await this.client.requestAsync(`/iFrame/token/${this.client.config.tenantId}`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    taxAmount:              this.#orderTotalTax.toFixed(2),
                    invoiceId:              this.#orderNumber,
                    billDate,
                    userCurrentDate:        nowString,
                    currencyUnit:           'USD',
                    description:            `Order ${this.#orderNumber}`,
                    transactionAmount:      this.#orderTotalWithTax.toFixed(2),
                    remainingTipAmount:     '0.00',
                    tipAmount:              '0.00',
                    style:                  iframeCssUrl ?? `https://${this.client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.client.cafe.id}.buy-ondemand.com/false/false/false`,
                    multiPaymentAmount:     fixed(this.#orderTotalWithTax, 2),
                    isWindCave:             false,
                    isCyberSource:          false,
                    isCyberSourceWallets:   false,
                    language:               'en',
                    previousTransactionId:  null,
                    contextId:              this.client.config.contextId,
                    profileId:              this.client.config.displayProfileId,
                    conceptId:              this.#conceptIds.values().next().value,
                    profitCenterId:         this.#orderingContext.profitCenterId,
                    processButtonText:      'PROCESS',
                    terminalId:             this.#orderingContext.onDemandTerminalId
                })
            });

        const json = await response.json();
        const { token } = z.object({ token: z.string() }).parse(json);

        return token;
    }

    private _getCardProcessorUrl(token: string, iframeCssUrl?: string) {
        if (!this.client.config) {
            throw new Error('Config is required to get card processor url!');
        }

        const styleUrl = iframeCssUrl ?? `https://${this.client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.client.cafe.id}.buy-ondemand.com/false/false/false`;
        return `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/${this.client.config.tenantId}/${this.#orderingContext.payClientId}?apiToken=${token}&submit=PROCESS&style=${encodeURIComponent(styleUrl)}&language=en&doVerify=true&version=3`;
    }

    private async _sendPhoneConfirmation(phoneData: PhoneValidResult) {
        await this.client.requestAsync(`/communication/sendSMSReceipt`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    contextId:         this.client.config.contextId,
                    orderId:           this.#orderId,
                    sendOrderTo:       phoneData.phoneNumber,
                    smsConfig:         {
                        overrideFromStoreConfig: true,
                        introText:               '🐧 Thank you for placing your order with {{N}}',
                        isItemizedListEnabled:   true,
                        isTotalsEnabled:         true,
                        isIntroEnabled:          true,
                        showCompleteCheckNumber: true,
                        appReceipt:              {
                            introText:      '🐧 Thank you for placing your order with {{N}}. Your order number is {{O}}',
                            enableFallback: false,
                        },
                        linkIntroText:           '🐧 Thank you for placing your order with {{N}}. Please find your receipt here {{L}}'
                    },
                    isCateringEnabled: false,
                    textReceiptConfig: {
                        featureEnabled:  true,
                        headerText:      'Text receipt',
                        instructionText: 'Enter your phone number. Message & data rates may apply.',
                        autoSendEnabled: true
                    },
                    displayProfileId:  this.client.config.displayProfileId,
                })
            });
    }

    private async _retrieveProfitCenterName(profitCenterId: string): Promise<string> {
        const response = await this.client.requestAsync(`/sites/${this.client.config.tenantId}/${this.client.config.contextId}/profitCenter/${profitCenterId}`,
            {
                method: 'GET'
            });

        return response.text();
    }

    private async _logIframeData(paymentToken: string, cardInfo: IPaymentCardInfo) {
        await this.client.requestAsync(
            `/order/logIframeData`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    type:        'success',
                    data:        {
                        token:    paymentToken,
                        cardInfo: {
                            cardIssuer:          cardInfo.cardIssuer,
                            accountNumberMasked: cardInfo.accountNumberMasked,
                            expirationYearMonth: cardInfo.expirationYearMonth,
                            cardholderName:      cardInfo.cardHolderName,
                            postalCode:          cardInfo.postalCode,
                        }
                    },
                    orderId:     this.#orderId,
                    orderNumber: this.#orderNumber,
                    paymentType: 'rGuestIframe'
                })
            },
            false /*shouldValidateSuccess*/
        );
    }

    private async _closeOrderWithIframeTokenAsync(
        { alias, phoneData, paymentToken, cardInfo }: IIframeCloseOrderParams,
        readyTime: IWaitTimeResponse,
    ) {
        if (this.#orderId == null) {
            throw new Error('Order ID is not set!');
        }

        if (this.#lastOrderDetails == null) {
            throw new Error('Order details are not set!');
        }

        const now = new Date();
        const nowString = toLocalIsoOffset(now);
        const closedTime = now.toISOString();
        const receiptDateTime = formatReceiptDateTime(now);
        const additionalSpecialInstructions = this.#payConfig?.specialInstructions?.additionalSpecialInstructions ?? [];
        const currencyDetails = {
            currencyDecimalDigits: '2',
            currencyCultureName:   'en-US',
            currencyCode:          'USD',
            currencySymbol:        '$'
        };
        const deliveryProperties = {
            deliveryOption:     {
                id:                      'pickup',
                kitchenText:             this.#sitePickUpConfig?.kitchenText ?? 'PICKUP',
                displayText:             this.#sitePickUpConfig?.buttonText ?? 'PICKUP',
                defaultConfirmationText: this.#sitePickUpConfig?.defaultConfirmationText ?? 'Thank you!',
                conceptEntries:          {},
                isEnabled:               true,
                orderSequence:           1,
            },
            fulfillmentDetails: {
                fulfillmentType: 'pickupFormFields',
            },
            isCutleryEnabled:   false,
            nameCapture:        {
                firstName:   alias,
                lastInitial: ''
            },
            nameString:         `${alias} `
        };
        const readyTimeDetails = {
            minTime: {
                minutes:    readyTime.minTime,
                fieldType:  { name: 'minutes' },
                periodType: { name: 'Minutes' }
            },
            maxTime: {
                minutes:    readyTime.maxTime,
                fieldType:  { name: 'minutes' },
                periodType: { name: 'Minutes' }
            }
        };
        const browserStoreInfo = buildBrowserStoreInfo({
            ...this.#siteStoreInfo,
            businessContextId: this.client.config.contextId,
            tenantId:          this.client.config.tenantId,
            storeInfoId:       this.client.config.storeId,
            storeName:         this.client.config.externalName,
        });
        const browserStoreInfoOptions = asRecord(browserStoreInfo.storeInfoOptions) ?? {};
        const taxAmountValue = fixed(this.orderTotalTax, 2);
        const taxClassList = this.orderTotalTax > 0
            ? [{ amount: `$${taxAmountValue}`, amountValue: taxAmountValue }]
            : [];
        const selectedSMSCountry = phoneData.countryCode === '+1'
            ? { value: 'US', label: 'United States', phoneCode: '1' }
            : undefined;
        const orderMessage = `Your order will be ready for pickup at ${this.client.config.externalName} in about ${readyTime.minTime} to ${readyTime.maxTime} minutes\n\n`;
        const closeOrderDetails = {
            ...this.#lastOrderDetails,
            properties:   {
                ...this.#lastOrderDetails.properties,
                orderNumberSequenceLength: '4',
                profitCenterId:            this.#orderingContext.profitCenterId,
                displayProfileId:          this.client.config.displayProfileId,
                orderNumberNameSpace:      this.#orderingContext.onDemandTerminalId,
                openTerminalId:            this.#orderingContext.onDemandTerminalId,
                priceLevelId:              this.#orderingContext.storePriceLevel,
                employeeId:                this.#orderingContext.onDemandEmployeeId,
                mealPeriodId:              String(MEAL_PERIOD.lunch),
                closedTerminalId:          this.#orderingContext.onDemandTerminalId,
                voidReasonId:              '11',
                orderSourceSystem:         'onDemand',
                additionalGuestData:       '{}',
                useIgOrderApi:             'true',
            },
            ...(additionalSpecialInstructions.length > 0 ? { additionalSpecialInstructions } : {}),
        };
        const receiptItems = this.#rawCartItemsForWaitTime.map((cartItem, index) => ({
            ...(cartItem as Record<string, unknown>),
            languageCode: 'en',
            lineItemId:   this.#lastOrderDetails?.lineItems[index]?.lineItemId,
        }));

        logOrderingDebugJson(this.client.cafe.name, 'Close-order identity summary', {
            tenantId:          this.client.config.tenantId,
            contextId:         this.client.config.contextId,
            displayProfileId:  this.client.config.displayProfileId,
            orderId:           this.#orderId,
            orderNumber:       this.#orderNumber,
            conceptIds:        [...this.#conceptIds],
            storePriceLevel:   this.#orderingContext.storePriceLevel,
            terminalId:        this.#orderingContext.onDemandTerminalId,
            employeeId:        this.#orderingContext.onDemandEmployeeId,
            profitCenterId:    this.#orderingContext.profitCenterId,
            profitCenterName:  this.#orderingContext.profitCenterName,
            payClientId:       this.#orderingContext.payClientId,
            lineItemIds:       [...this.#lineItemsById.keys()],
            orderTotalWithTax: this.orderTotalWithTax,
            readyTime,
        });

        await this.client.requestAsync(
            `/order/${this.client.config.tenantId}/${this.client.config.contextId}/orderId/${this.#orderId}/processPaymentAndClosedOrder`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:   JSON.stringify({
                    amHereConfig:                    {
                        isCurbsidePickup: false,
                        lateTolerance:    5,
                        origin:           `https://${this.client.cafe.id}.buy-ondemand.com`
                    },
                    authorizedAmount:                this.orderTotalWithTax.toString(),
                    calorieTotal:                    {
                        baseCalorie: 0,
                        maxCalorie:  0
                    },
                    capacitySuggestionPerformed:     false,
                    conceptId:                       this.#conceptIds.values().next().value,
                    contextId:                       this.client.config.contextId,
                    currencyDetails,
                    currencyUnit:                    'USD',
                    customCardCodeMapping:           false,
                    customerAddress:                 [],
                    cyberSourcePaymentData:          null,
                    cyberSourceTransactionData:      null,
                    deliveryProperties,
                    discountInfo:                    [],
                    displayProfileId:                this.client.config.displayProfileId,
                    emailInfo:                       {
                        ...(this.#payConfig?.emailReceipt ?? {}),
                        customerAddress: [],
                    },
                    engageAccrualEnabled:            false,
                    engagePromotionAppliedPromotions: [],
                    engagePromotionCardNumber:       null,
                    engagePromotionLastName:         '',
                    firstName:                       alias,
                    giftCardSaleDataMap:             {},
                    graceCompletionTime:             false,
                    gratuityBreakupConfigEnabled:    false,
                    igOrderStatusConfig:             {},
                    igSettings:                      this.#payConfig?.displayOptions ?? {},
                    isGaPaymentAvailable:            false,
                    itemCountdown:                   {},
                    kitchenContextId:                null,
                    lastName:                        '',
                    locizeConfig:                    {
                        currentLanguage:     'en',
                        shouldUseLocizeText: false,
                        domain:              `${this.client.cafe.id}.buy-ondemand.com`,
                        storeInfo:           browserStoreInfo,
                        scheduledDay:        0,
                        dateTime:            'en',
                        readyTime:           readyTimeDetails,
                        deliveryProperties,
                        multiLanguageConfig: {},
                        locizeVersion:       'production',
                    },
                    loyaltyGuestInfo:                {},
                    loyaltyPayment:                  false,
                    mealPeriodId:                    String(MEAL_PERIOD.lunch),
                    mobileNumber:                    phoneData.phoneNumber,
                    mobileNumberCountryCode:         phoneData.countryCode,
                    multiPassEnabled:                false,
                    notifyGuestOnFailure:            false,
                    order:                           closeOrderDetails,
                    orderGuid:                       null,
                    orderVersion:                    1,
                    paymentType:                     null,
                    processPaymentAsExternalPayment: false,
                    profileId:                       this.client.config.displayProfileId,
                    profitCenterId:                  this.#orderingContext.profitCenterId,
                    profitCenterName:                this.#orderingContext.profitCenterName,
                    recallCheck:                     false,
                    receiptInfo:                     {
                        orderData:                           closeOrderDetails,
                        showConceptNameInEmailReceipt:      false,
                        showConceptNameInTextReceipt:       false,
                        showConceptNameInPrintReceipt:      false,
                        taxBreakupEnabled:                  this.#payConfig?.taxBreakupEnabled ?? false,
                        taxClassList,
                        hideVATInReceipts:                  this.#payConfig?.hideVATInReceipts ?? false,
                        items:                              receiptItems,
                        tip:                                0,
                        tipAmount:                          0,
                        etfEnabled:                         true,
                        dateTime:                           'en',
                        storePriceLevel:                    this.#orderingContext.storePriceLevel,
                        currencyDetails,
                        deliveryEnabled:                    false,
                        readyTime:                          readyTimeDetails,
                        deliveryProperties,
                        vatEntries:                         [],
                        taxIdentificationNumber:            '',
                        accountNumberLabelText:             'GA account number',
                        engageLoyaltyAccountNumberLabelText: 'Account number',
                        engageMemberAccountNumberLabelText:  'Account number',
                        gaAccountInfoList:                  [],
                        deliveryConfirmationText:           this.#sitePickUpConfig?.defaultConfirmationText ?? 'Thank you!',
                        orderPlacedTime:                    closedTime,
                        receiptDate:                        receiptDateTime.receiptDate,
                        receiptTime:                        receiptDateTime.receiptTime,
                        timeZone:                           ORDER_TIMEZONE,
                        terminalId:                         this.#orderingContext.onDemandTerminalId,
                        checkNumber:                        this.#orderNumber,
                        selectedSMSCountry,
                        mobileNumber:                       phoneData.phoneNumber,
                        scheduledDay:                       0,
                        hideAllPrices:                      this.#payConfig?.hideAllPrices ?? false,
                        hideZeroPrice:                      this.#payConfig?.hideZeroPrice ?? false,
                        complimentaryPayment:               false,
                        isPayLater:                         false,
                        payLaterConfig:                     {},
                        discountValues:                     [],
                        franceFiscalConfig:                 { isEnabled: false },
                        birConfig:                          browserStoreInfoOptions.birConfig,
                        multiPassEnabled:                   false,
                        receipientName:                     `${alias} `,
                        orderMessage,
                        dateTimeInReceipt:                  receiptDateTime.dateTimeInReceipt,
                        timezoneOffsetMinutes:              receiptDateTime.timezoneOffsetMinutes,
                        printDateTime:                      receiptDateTime.printDateTime,
                        closedTime,
                        gratuityWithLabelArray:             false,
                        serviceAmountWithLabelArray:        false,
                        displayProfileId:                   this.client.config.displayProfileId,
                        engagePayment:                      { engageAccountInfoList: [] },
                        engageLoyaltyPayment:               { engageLoyaltyAccountInfoList: [] },
                    },
                    saleTransactionData:             null,
                    scannedItemOrder:                false,
                    scheduledDay:                    0,
                    shouldRefundOnFailure:           false,
                    siteId:                          this.client.config.contextId,
                    storePriceLevel:                 this.#orderingContext.storePriceLevel,
                    stripeTransactionData:           null,
                    subtotal:                        this.orderTotalWithTax.toString(),
                    tenantId:                        this.client.config.tenantId,
                    terminalId:                      this.#orderingContext.onDemandTerminalId,
                    textReceiptConfig:               {
                        textMessageWithReceiptLink: false
                    },
                    tipAmount:                       0,
                    tipPercent:                      0,
                    tokenizedData:                   {
                        paymentDetails: {
                            taxAmount:              this.orderTotalTax.toString(),
                            invoiceId:              this.#orderNumber,
                            billDate:               this.#lastOrderDetails.created ?? nowString,
                            userCurrentDate:        nowString,
                            currencyUnit:           'USD',
                            description:            `Order ${this.#orderNumber}`,
                            transactionAmount:      this.orderTotalWithTax.toString(),
                            remainingTipAmount:     '0.00',
                            tipAmount:              '0.00',
                            style:                  `https://${this.client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.client.cafe.id}.buy-ondemand.com/false/false/false`,
                            multiPaymentAmount:     fixed(this.orderTotalWithTax, 2),
                            isWindCave:             false,
                            isCyberSource:          false,
                            isCyberSourceWallets:   false,
                            language:               'en',
                            apiToken:               this.#cardProcessorToken,
                            payTenantId:            this.client.config.tenantId,
                            previousTransactionId:  null,
                            accountNumberMasked:    cardInfo.accountNumberMasked,
                            cardIssuer:             cardInfo.cardIssuer,
                            expirationYearMonth:    cardInfo.expirationYearMonth,
                            cardHolderName:         cardInfo.cardHolderName,
                            postalCode:             cardInfo.postalCode,
                        },
                        saveCardFlag:   false,
                        token:          paymentToken
                    },
                    previousTransactionId:           null,
                    previousTransactionTokenInfo:     null,
                    use24HrTimeFormat:               false,
                    useIgPosApi:                     false,
                    walletPaymentData:               null,
                    walletSaleTransactionData:       null
                })
            },
        );
    }

    private async _runStages(requiredStage: SubmitOrderStage, callback: () => Promise<void>): Promise<void> {
        if (this.#lastCompletedStage !== requiredStage) {
            throw new Error(`Order is in the wrong stage! Expected: ${requiredStage}, actual: ${this.#lastCompletedStage}`);
        }

        orderLog.info(`{${this.client.cafe.name}} Running stage after ${requiredStage} — fetching ordering context`);
        this.#orderingContext = await this._retrieveOrderingContextAsync();
        orderLog.info(`{${this.client.cafe.name}} Ordering context ready, executing stage callback`);

        try {
            await callback();
            orderLog.info(`{${this.client.cafe.name}} Stage callback complete — now at stage ${this.#lastCompletedStage}`);
        } catch (err) {
            logError(`{${this.client.cafe.name}} Failed after stage ${this.#lastCompletedStage}:`, err);
            throw err;
        }
    }

    public async populateCart(): Promise<void> {
        await this._runStages(SubmitOrderStage.notStarted, async () => {
            await this._populateCart();
            this.#lastCompletedStage = SubmitOrderStage.addToCart;
        });
    }

    /**
     * Prepares the order for iframe-based payment.
     * Populates the cart and gets the site token + iframe URL.
     * Does NOT submit payment — the frontend iframe handles that.
     */
    public async prepareForIframe(iframeCssUrl: string): Promise<{ siteToken: string; iframeUrl: string; orderId: string; orderNumber: string }> {
        orderLog.info(`{${this.client.cafe.name}} Preparing for iframe payment`);
        await this._runStages(SubmitOrderStage.addToCart, async () => {
            this.#cardProcessorToken = await this._getCardProcessorSiteToken(iframeCssUrl);
            this.#lastCompletedStage = SubmitOrderStage.initializeCardProcessor;
        });

        if (!this.#orderId || !this.#orderNumber) {
            throw new Error('Order ID or order number is not set after cart population');
        }

        return {
            siteToken:   this.#cardProcessorToken,
            iframeUrl:   this._getCardProcessorUrl(this.#cardProcessorToken, iframeCssUrl),
            orderId:     this.#orderId,
            orderNumber: this.#orderNumber,
        };
    }

    /**
     * Completes an order using a payment token received from the rguest iframe.
     * Closes the order and sends phone confirmation.
     */
    public async completeOrderAfterIframePayment({
        alias,
        phoneData,
        paymentToken,
        cardInfo,
    }: IIframeCloseOrderParams): Promise<IWaitTimeResponse> {
        orderLog.info(`{${this.client.cafe.name}} Completing order ${this.#orderId} with iframe token`);
        let waitTime: IWaitTimeResponse = { minTime: 0, maxTime: 0 };
        try {
            await this._runStages(SubmitOrderStage.initializeCardProcessor, async () => {
                this.#lastCompletedStage = SubmitOrderStage.payment;

                try {
                    await this._logIframeData(paymentToken, cardInfo);
                } catch (err) {
                    logError('Unable to report iframe data (non-fatal, continuing anyway):', err);
                }

                const readyTime = await fetchWaitTimeWithCartItems(
                    this.client,
                    [...this.rawCartItemsForWaitTime],
                );
                waitTime = readyTime;
                orderLog.info(`{${this.client.cafe.name}} Refreshed close-order wait time: ${readyTime.minTime}-${readyTime.maxTime} min`);

                orderLog.info(`{${this.client.cafe.name}} Closing order ${this.#orderId}`);
                await this._closeOrderWithIframeTokenAsync({
                    alias,
                    phoneData,
                    paymentToken,
                    cardInfo,
                }, readyTime);

                this.#lastCompletedStage = SubmitOrderStage.closeOrder;
                orderLog.info(`{${this.client.cafe.name}} Order closed, sending phone confirmation`);

                await this._sendPhoneConfirmation(phoneData);

                this.#lastCompletedStage = SubmitOrderStage.complete;
                orderLog.info(`{${this.client.cafe.name}} Order ${this.#orderNumber} complete`);
            });
        } finally {
            await this.client.harCapture?.writeToFile(this.client.cafe.id);
        }
        return waitTime;
    }
}
