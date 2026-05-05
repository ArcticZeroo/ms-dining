import { ICartItem, IRguestCardInfo, SubmitOrderStage } from '@msdining/common/models/cart';
import { getNamespaceLogger, logError } from '../../../util/log.js';

const orderLog = getNamespaceLogger('Order');
import { BuyOnDemandClient, DEFAULT_SCHEDULE_TIME, JSON_HEADERS } from '../buy-ondemand/buy-ondemand-client.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import {
    IOrderLineItem,
    IRetrieveCardProcessorTokenResponse,
} from '../../../models/buyondemand/cart.js';
import hat from 'hat';
import { ISiteDataResponseItem } from '../../../models/buyondemand/config.js';
import { IOrderingContext } from '../../../models/cart.js';
import { OrderingClient } from '../../storage/clients/ordering.js';
import { StationStorageClient } from '../../storage/clients/station.js';
import { StringUtil } from '../../../util/string.js';
import { z } from 'zod';
import { fixed } from '../../../util/math.js';
import { ICafe, IMenuItemBase } from '../../../models/cafe.js';
import { PhoneValidResult } from 'phone';
import { MEAL_PERIOD } from '../../../constants/enum.js';

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
    cardInfo: IRguestCardInfo;
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
    #conceptSchedule: Array<unknown> = [];
    #openScheduleExpression: string = '0 0 0 * * *';
    #closeScheduleExpression: string = '0 0 0 * * *';
    readonly #cartItems: ICartItem[];
    readonly #lineItemsById = new Map<string, IOrderLineItem>();
    readonly #rawCartItemsForWaitTime: unknown[] = [];
    readonly #conceptIds = new Set<string>();

    constructor(public client: BuyOnDemandClient, cartItems: ICartItem[]) {
        this.#cartItems = cartItems;
    }

    public static async createAsync(cafe: ICafe, cartItems: ICartItem[]): Promise<CafeOrderSession> {
        orderLog.info(`{${cafe.name}} Creating order session with ${cartItems.length} item(s)`);
        const client = await BuyOnDemandClient.createAsync(cafe, true /*enableHar*/);
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

    public get rawCartItemsForWaitTime(): readonly unknown[] {
        return this.#rawCartItemsForWaitTime;
    }

    private async _requestOrderingContextAsync(): Promise<IOrderingContext> {
        orderLog.info(`{${this.client.cafe.name}} Fetching ordering context (site data + pay client ID)`);
        const [siteData, payClientId] = await Promise.all([
            this._fetchSiteData(),
            this._fetchPayClientId(),
        ]);
        orderLog.info(`{${this.client.cafe.name}} Site data + pay client ID fetched`);

        const orderingContext: IOrderingContext = {
            onDemandTerminalId: siteData.displayOptions.onDemandTerminalId,
            onDemandEmployeeId: siteData.displayOptions.onDemandEmployeeId,
            profitCenterId:     siteData.displayOptions['profit-center-id'],
            storePriceLevel:    siteData.storePriceLevel,
            profitCenterName:   '',
            payClientId,
        };

        orderingContext.profitCenterName = await this._retrieveProfitCenterName(orderingContext.profitCenterId);
        orderLog.info(`{${this.client.cafe.name}} Ordering context complete (profitCenter: ${orderingContext.profitCenterName})`);

        return orderingContext;
    }

    private async _fetchSiteData(): Promise<ISiteDataResponseItem> {
        const response = await this.client.requestAsync(`/sites/${this.client.config.contextId}`, {
            method:  'GET',
            headers: JSON_HEADERS
        });

        const json = await response.json();

        if (!isDuckTypeArray<ISiteDataResponseItem>(json, {
            storePriceLevel: 'string',
            displayOptions:  'object'
        })) {
            throw new Error('Site data is not in the correct format');
        }

        const [siteData] = json;

        if (!siteData) {
            throw new Error('Site data is empty!');
        }

        return siteData;
    }

    private async _fetchPayClientId(): Promise<string> {
        const response = await this.client.requestAsync(
            `/sites/${this.client.config.contextId}/${this.client.config.displayProfileId}`,
            {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({
                    scheduleTime: DEFAULT_SCHEDULE_TIME,
                    scheduledDay: 0,
                })
            }
        );

        const json = await response.json();
        const result = z.object({
            pay: z.object({
                clientId: z.string(),
            }),
        }).parse(json);

        return result.pay.clientId;
    }

    private async _retrieveOrderingContextAsync(): Promise<IOrderingContext> {
        const existingOrderingContext = await OrderingClient.retrieveOrderingContextAsync(this.client.cafe.id);
        if (existingOrderingContext != null) {
            orderLog.info(`{${this.client.cafe.name}} Using cached ordering context`);
            return existingOrderingContext;
        }

        orderLog.info(`{${this.client.cafe.name}} No cached ordering context, fetching fresh`);
        const orderingContext = await this._requestOrderingContextAsync();

        await OrderingClient.createOrderingContextAsync(this.client.cafe.id, orderingContext);

        return orderingContext;
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
        const response = await this.client.requestAsync(
            `/sites/${this.client.config.tenantId}/${this.client.config.contextId}/kiosk-items/${itemId}`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
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
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Unable to retrieve item detail for item ${itemId}: ${response.status}`);
        }

        return kioskItemDetailSchema.parse(await response.json());
    }

    private async _addItemToCart(cartItem: ICartItem) {
        orderLog.info(`{${this.client.cafe.name}} Adding item ${cartItem.itemId} (qty: ${cartItem.quantity}) to cart`);
        const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(cartItem.itemId);

        if (menuItem == null) {
            throw new Error(`Failed to find menu item with id "${cartItem.itemId}"`);
        }

        const station = await StationStorageClient.retrieveStationAsync(menuItem.stationId);

        if (station == null) {
            throw new Error(`Failed to find station for menu item "${cartItem.itemId}"`);
        }

        const rawItemDetail = await this._fetchRawItemDetail(cartItem.itemId, station);

        this.#conceptIds.add(station.id);

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
                    cartGuid,
                    scannedItem:  false,
                    priceLevelId: this.#orderingContext.storePriceLevel,
                },
                count:                cartItem.quantity,
                quantity:             cartItem.quantity,
                selectedModifiers:    serializedModifiers,
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
            schedule:           this.#conceptSchedule,
            orderTimeZone:      'PST8PDT',
            storePriceLevel:    this.#orderingContext.storePriceLevel,
            scheduledDay:       0,
            useIgOrderApi:      true,
            onDemandTerminalId: this.#orderingContext.onDemandTerminalId,
            properties:         {
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
                openScheduleExpression:  this.#openScheduleExpression,
                closeScheduleExpression: this.#closeScheduleExpression,
            },
            isMultiItem:        false,
            scannedOrder:       false,
        };

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
                body:    JSON.stringify({
                    scheduleTime: DEFAULT_SCHEDULE_TIME,
                    scheduledDay: 0,
                })
            }
        );

        const json = await response.json();

        const conceptSchema = z.object({
            schedule:                z.array(z.unknown()),
            openScheduleExpression:  z.string(),
            closeScheduleExpression: z.string(),
        }).passthrough();

        const concepts = z.array(conceptSchema).parse(json);
        const firstConcept = concepts[0];

        if (firstConcept == null) {
            throw new Error('No concepts returned from API');
        }

        this.#conceptSchedule = firstConcept.schedule;
        this.#openScheduleExpression = firstConcept.openScheduleExpression;
        this.#closeScheduleExpression = firstConcept.closeScheduleExpression;
        orderLog.info(`{${this.client.cafe.name}} Concept schedule fetched (${concepts.length} concept(s))`);
    }

    private async _getCardProcessorSiteToken(iframeCssUrl?: string) {
        if (StringUtil.isNullOrWhitespace(this.#orderNumber)) {
            throw new Error('Order number is not set');
        }

        if (this.#orderTotalWithoutTax === 0 || this.#orderTotalWithTax === 0) {
            throw new Error('Order totals cannot be zero');
        }

        const billDate = this.#lastOrderDetails?.created ?? (new Date()).toISOString();
        const nowString = (new Date()).toISOString();

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

        if (!isDuckType<IRetrieveCardProcessorTokenResponse>(json, {
            token: 'string'
        })) {
            throw new Error('Data is not in the correct format');
        }

        return json.token;
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

    private async _logIframeData(paymentToken: string, cardInfo: IRguestCardInfo) {
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

    private async _closeOrderWithIframeTokenAsync({ alias, phoneData, paymentToken, cardInfo }: IIframeCloseOrderParams) {
        if (this.#orderId == null) {
            throw new Error('Order ID is not set!');
        }

        if (this.#lastOrderDetails == null) {
            throw new Error('Order details are not set!');
        }

        const nowString = (new Date()).toISOString();

        const response = await this.client.requestAsync(
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
                    currencyDetails:                 {
                        currencyCode:          'USD',
                        currencyCultureName:   'en-US',
                        currencyDecimalDigits: '2',
                        currencySymbol:        '$'
                    },
                    currencyUnit:                    'USD',
                    customCardCodeMapping:           false,
                    customerAddress:                 [],
                    cyberSourcePaymentData:          null,
                    cyberSourceTransactionData:      null,
                    deliveryProperties:              {
                        deliveryOption:     {
                            conceptEntries:          {},
                            defaultConfirmationText: 'Thank you for your order! You will be notified when your order is ready for pick-up at the Mobile Order Pick-Up station.',
                            displayText:             'PICKUP',
                            id:                      'pickup',
                            isEnabled:               true,
                            kitchenText:             'PICKUP'
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
                    },
                    discountInfo:                    [],
                    displayProfileId:                this.client.config.displayProfileId,
                    emailInfo:                       {
                        featureEnabled:     true,
                        customerAddress:    [],
                        headerText:         'Email receipt',
                        instructionText:    'Please use your MICROSOFT email for receipt & reception ',
                        receiptFooter:      'Thanks for using dining.frozor.io!',
                        receiptFromAddress: 'noreply@rguest.com',
                        receiptFromName:    this.client.cafe.name,
                        receiptSubject:     `Receipt from ${this.client.cafe.name}`,
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
                    igSettings:                      {
                        'discountStateTitle':              'Check for loyalty discounts',
                        'timezone':                        'PST8PDT',
                        'LOYALTY/uiNoTendersAvailableMsg': 'You do not have available points or vouchers to apply. \nPlease use a different payment entityType or cancel this order.',
                        'isSmsEnabled':                    'true',
                        'greetingText':                    'Select to begin',
                        'currency/currencyCultureName':    'en-US',
                        'smsInstructionText':              'You\'ll receive a text when order is ready for PICK-UP.',
                        'isMobileNumberRequired':          'true',
                        'isProfileValid':                  'true',
                        'limitGaTenderIds':                '11,111,12,13,9',
                        'currency/currencyCode':           'USD',
                        'onDemandIgVerificationCodeId':    'MSFT152',
                        'useIgOrderApi':                   'true',
                        'roomCharge/paymentIds':           '',
                        'LOYALTY/bannedPlayerMessage':     'Please see cashier.',
                        'LOYALTY/pinNumberLength':         '4',
                        'currency/currencySymbol':         '$',
                        'gaPaymentName':                   'Badge / Coupon',
                        'onDemandTenderId':                '94',
                        'onDemandEmployeeId':              this.#orderingContext.onDemandEmployeeId,
                        'profit-center-id':                this.#orderingContext.profitCenterId,
                        'LOYALTY/uiSystemBrandingLabel':   'Player card',
                        'currency/currencyDecimalDigits':  '2',
                        'LOYALTY/restrictBannedPlayers':   'true',
                        'useIgPosApi':                     'false',
                        'onDemandTerminalId':              this.#orderingContext.onDemandTerminalId,
                        'smsHeaderText':                   'Text order status requires mobile number.'
                    },
                    isGaPaymentAvailable:            false,
                    itemCountdown:                   {},
                    kitchenContextId:                null,
                    lastName:                        '',
                    locizeConfig:                    {
                        currentLanguage:     'en',
                        shouldUseLocizeText: false,
                        domain:              `${this.client.cafe.id}.buy-ondemand.com`,
                        storeInfo:           {
                            businessContextId:       this.client.config.contextId,
                            tenantId:                this.client.config.tenantId,
                            storeInfoId:             this.client.config.storeId,
                            storeName:               this.client.cafe.name,
                            timezone:                'PST8PDT',
                            properties:              {
                                selectedLanguage:        'en_US',
                                taxIdentificationNumber: ''
                            },
                            storeInfoOptions:        {
                                calories:  {
                                    abbreviation: 'Cal',
                                    fullName:     'Calories'
                                },
                                birConfig: {
                                    displayText:                       'OR#',
                                    acknowledgementReceiptDisplayText: 'AR#',
                                    acknowledgementReceiptIndicator:   'Acknowledgement Receipt#',
                                    officialReceiptIndicator:          'Official Receipt#'
                                }
                            },
                            receiptConfigProperties: {
                                smsBody:                      'true',
                                smsHeader:                    'true',
                                smsFooter:                    'true',
                                showCompleteCheckNumberInSms: 'true'
                            },
                            address:                 [
                                ' ',
                                '  '
                            ]
                        },
                        scheduledDay:        0,
                        dateTime:            'en',
                        readyTime:           {
                            minTime: {
                                minutes:    0,
                                fieldType:  {
                                    name: 'minutes'
                                },
                                periodType: {
                                    name: 'Minutes'
                                }
                            },
                            maxTime: {
                                minutes:    0,
                                fieldType:  {
                                    name: 'minutes'
                                },
                                periodType: {
                                    name: 'Minutes'
                                }
                            }
                        },
                        deliveryProperties:  {
                            deliveryOption:     {
                                id:                      'pickup',
                                kitchenText:             'PICKUP',
                                displayText:             'PICKUP',
                                defaultConfirmationText: 'Thank you for your order! You will be notified when your order is ready for pick-up at the Mobile Order Pick-Up station.',
                                conceptEntries:          {},
                                isEnabled:               true
                            },
                            fulfillmentDetails: {
                                fulfillmentType: 'pickupFormFields'
                            },
                            isCutleryEnabled:   false,
                            nameCapture:        {
                                firstName:   alias,
                                lastInitial: ''
                            },
                            nameString:         `${alias} `
                        },
                        multiLanguageConfig: {}
                    },
                    loyaltyGuestInfo:                {},
                    loyaltyPayment:                  false,
                    mealPeriodId:                    MEAL_PERIOD.lunch,
                    mobileNumber:                    phoneData.phoneNumber,
                    mobileNumberCountryCode:         phoneData.countryCode,
                    multiPassEnabled:                false,
                    notifyGuestOnFailure:            false,
                    order:                           {
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
                            mealPeriodId:              MEAL_PERIOD.lunch,
                            closedTerminalId:          this.#orderingContext.onDemandTerminalId,
                            voidReasonId:              '11',
                            orderSourceSystem:         'onDemand',
                            additionalGuestData:       '{}',
                            useIgOrderApi:             'true',
                        }
                    },
                    orderGuid:                       null,
                    orderVersion:                    1,
                    paymentType:                     null,
                    processPaymentAsExternalPayment: false,
                    profileId:                       this.client.config.displayProfileId,
                    profitCenterId:                  this.#orderingContext.profitCenterId,
                    profitCenterName:                this.#orderingContext.profitCenterName,
                    recallCheck:                     false,
                    receiptInfo:                     {
                        orderData: this.#lastOrderDetails
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
                            billDate:               nowString,
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
            false /*shouldValidateSuccess*/
        );

        if (!response.ok) {
            const body = await response.text();
            logError(`{${this.client.cafe.name}} closeOrder failed (${response.status}):`, body);
            throw new Error(`Close order failed with status ${response.status}: ${body}`);
        }
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
    public async completeWithIframeToken({
        alias,
        phoneData,
        paymentToken,
        cardInfo,
    }: IIframeCloseOrderParams): Promise<void> {
        orderLog.info(`{${this.client.cafe.name}} Completing order ${this.#orderId} with iframe token`);
        try {
            await this._runStages(SubmitOrderStage.initializeCardProcessor, async () => {
                this.#lastCompletedStage = SubmitOrderStage.payment;

                try {
                    await this._logIframeData(paymentToken, cardInfo);
                } catch (err) {
                    logError('Unable to report iframe data (non-fatal, continuing anyway):', err);
                }

                orderLog.info(`{${this.client.cafe.name}} Closing order ${this.#orderId}`);
                await this._closeOrderWithIframeTokenAsync({
                    alias,
                    phoneData,
                    paymentToken,
                    cardInfo,
                });

                this.#lastCompletedStage = SubmitOrderStage.closeOrder;
                orderLog.info(`{${this.client.cafe.name}} Order closed, sending phone confirmation`);

                await this._sendPhoneConfirmation(phoneData);

                this.#lastCompletedStage = SubmitOrderStage.complete;
                orderLog.info(`{${this.client.cafe.name}} Order ${this.#orderNumber} complete`);
            });
        } finally {
            await this.client.harCapture?.writeToFile(this.client.cafe.id);
        }
    }
}