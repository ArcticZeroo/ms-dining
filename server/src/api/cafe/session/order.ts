import { ICartItem, IRguestCardInfo, SubmitOrderStage } from '@msdining/common/models/cart';
import { logError } from '../../../util/log.js';
import { BuyOnDemandClient, JSON_HEADERS } from '../buy-ondemand/buy-ondemand-client.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import {
	IAddToOrderResponse,
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

// Validates the kiosk-items/{id} response. Uses passthrough() so all extra fields
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
    };
    #orderId: string | null = null;
    #orderNumber: string | null = null;
    #orderTotalWithoutTax: number = 0;
    #orderTotalTax: number = 0;
    #orderTotalWithTax: number = 0;
    #lastCompletedStage: SubmitOrderStage = SubmitOrderStage.notStarted;
    #cardProcessorToken: string = '';
    readonly #cartItems: ICartItem[];
    readonly #lineItemsById = new Map<string, IOrderLineItem>();
    readonly #rawCartItemsForWaitTime: unknown[] = [];

    constructor(public client: BuyOnDemandClient, cartItems: ICartItem[]) {
        this.#cartItems = cartItems;
    }

    public static async createAsync(cafe: ICafe, cartItems: ICartItem[]): Promise<CafeOrderSession> {
        const client = await BuyOnDemandClient.createAsync(cafe);
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
        const response = await this.client.requestAsync(`/sites/${this.client.config.contextId}`,
            {
                method:  'GET',
                headers: JSON_HEADERS
            });

        const json = await response.json();

        if (!isDuckTypeArray<ISiteDataResponseItem>(json, {
            storePriceLevel: 'string',
            displayOptions:  'object'
        })) {
            throw new Error('Data is not in the correct format');
        }

        const [siteData] = json;

        if (!siteData) {
            throw new Error('Site data is empty!');
        }

        const orderingContext = {
            onDemandTerminalId: siteData.displayOptions.onDemandTerminalId,
            onDemandEmployeeId: siteData.displayOptions.onDemandEmployeeId,
            profitCenterId:     siteData.displayOptions['profit-center-id'],
            storePriceLevel:    siteData.storePriceLevel,
            profitCenterName:   ''
        };

        orderingContext.profitCenterName = await this._retrieveProfitCenterName(orderingContext.profitCenterId);

        return orderingContext;
    }

    private async _retrieveOrderingContextAsync(): Promise<IOrderingContext> {
        const existingOrderingContext = await OrderingClient.retrieveOrderingContextAsync(this.client.cafe.id);
        if (existingOrderingContext != null) {
            return existingOrderingContext;
        }

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
        const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(cartItem.itemId);

        if (menuItem == null) {
            throw new Error(`Failed to find menu item with id "${cartItem.itemId}"`);
        }

        const station = await StationStorageClient.retrieveStationAsync(menuItem.stationId);

        if (station == null) {
            throw new Error(`Failed to find station for menu item "${cartItem.itemId}"`);
        }

        const rawItemDetail = await this._fetchRawItemDetail(cartItem.itemId, station);

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
            schedule:           [
                {
                    '@c':                '.DisplayProfileTask',
                    scheduledExpression: '0 0 0 * * *',
                    properties:          {
                        'meal-period-id': '1',
                    },
                    displayProfileState: {
                        displayProfileId: this.client.config.displayProfileId,
                        conceptStates:    [
                            {
                                conceptId: station.id,
                                menuId:    station.menuId,
                            }
                        ],
                    },
                }
            ],
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
                priceLevelId:              this.#orderingContext.storePriceLevel,
            },
            conceptSchedule:    {
                openScheduleExpression:  '0 0 0 * * *',
                closeScheduleExpression: '0 0 0 * * *',
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

        if (!isDuckType<IAddToOrderResponse>(json, {
            orderDetails: 'object'
        })) {
            throw new Error('Data is not in the correct format');
        }

        // Seems like the cart might be fake. We appear to get a new order number every time we add an item?
        this.#orderNumber = json.orderDetails.orderNumber;
        this.#orderId = json.orderDetails.orderId;

        // These seem to be incremental for some reason, despite the naming and structure of the response. /shrug
        this.#orderTotalTax += Number(json.orderDetails.taxTotalAmount.amount);
        this.#orderTotalWithoutTax += Number(json.orderDetails.taxExcludedTotalAmount.amount);
        this.#orderTotalWithTax += Number(json.orderDetails.totalDueAmount.amount);

        for (const lineItem of json.orderDetails.lineItems) {
            this.#lineItemsById.set(lineItem.lineItemId, lineItem);
        }
    }

    private async _populateCart() {
        // Don't  parallelize, not sure what happens on the server if we do multiple concurrent adds
        for (const cartItem of this.#cartItems) {
            await this._addItemToCart(cartItem);
        }
    }

    private async _getCardProcessorSiteToken(iframeCssUrl?: string) {
        if (StringUtil.isNullOrWhitespace(this.#orderNumber)) {
            throw new Error('Order number is not set');
        }

        if (this.#orderTotalWithoutTax === 0 || this.#orderTotalWithTax === 0) {
            throw new Error('Order totals cannot be zero');
        }

        const nowString = (new Date()).toISOString();

        const response = await this.client.requestAsync(`/iFrame/token/${this.client.config.tenantId}`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    taxAmount:            this.#orderTotalTax.toFixed(2),
                    invoiceId:            this.#orderNumber,
                    billDate:             nowString,
                    userCurrentDate:      nowString,
                    currencyUnit:         'USD',
                    description:          `Order ${this.#orderNumber}`,
                    transactionAmount:    this.#orderTotalWithTax.toFixed(2),
                    remainingTipAmount:   '0.00',
                    tipAmount:            '0.00',
                    style:                iframeCssUrl ?? `https://${this.client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.client.cafe.id}.buy-ondemand.com/false/false`,
                    multiPaymentAmount:   fixed(this.#orderTotalWithTax, 2),
                    isWindCave:           false,
                    isCyberSource:        false,
                    isCyberSourceWallets: false,
                    language:             'en',
                    contextId:            this.client.config.contextId,
                    profileId:            this.client.config.displayProfileId,
                    profitCenterId:       this.#orderingContext.profitCenterId,
                    processButtonText:    'PROCESS',
                    terminalId:           this.#orderingContext.onDemandTerminalId
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

        const styleUrl = iframeCssUrl ?? `https://${this.client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.client.cafe.id}.buy-ondemand.com/false/false`;
        // "6564d6cadc5f9d30a2cf76b3" appears to be hardcoded in the JS. Client ID?
        return `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/${this.client.config.tenantId}/6564d6cadc5f9d30a2cf76b3?apiToken=${token}&submit=PROCESS&style=${encodeURIComponent(styleUrl)}&language=en&doVerify=true&version=3`;
    }

    private async _sendPhoneConfirmation(phoneData: PhoneValidResult) {
        await this.client.requestAsync(`/communication/sendSMSReceipt`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    contextId:         this.client.config.contextId,
                    orderId:           this.#orderNumber,
                    sendOrderTo:       phoneData.phoneNumber,
                    storeInfo:         {
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
                    smsConfig:         {
                        overrideFromStoreConfig: true,
                        introText:               '🐧 Thank you for placing your order on with {{N}}',
                        isItemizedListEnabled:   true,
                        isTotalsEnabled:         true,
                        isIntroEnabled:          true,
                        showCompleteCheckNumber: true,
                        appReceipt:              {
                            introText:  '🐧 Thank you for placing your order with {{N}}. Your order number is {{O}}',
                            fromNumber: ''
                        }
                    },
                    isCateringEnabled: false,
                    textReceiptConfig: {
                        featureEnabled:  true,
                        headerText:      'Text receipt',
                        instructionText: 'Enter your phone number. Message & data rates may apply.',
                        autoSendEnabled: true
                    }
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

    private async _closeOrderWithIframeTokenAsync({ alias, phoneData, paymentToken, cardInfo }: IIframeCloseOrderParams) {
        if (this.#orderId == null) {
            throw new Error('Order ID is not set!');
        }

        const nowString = (new Date()).toISOString();

        await this.client.requestAsync(
            `/order/${this.#orderId}/processPaymentAndClosedOrder`,
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
                            fulfillmentTYpe: 'pickupFormFields',
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
                    firstName:                       alias,
                    giftCardSaleDataMap:             {},
                    graceCompletionTime:             false,
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
                    notifyGuestOnFailure:            true,
                    order:                           {
                        orderId:      this.#orderId,
                        version:      1,
                        tenantId:     this.client.config.tenantId,
                        contextId:    this.client.config.contextId,
                        created:      nowString,
                        lastUpdated:  nowString,
                        orderState:   'OPEN',
                        currencyUnit: 'USD',
                        orderNumber:  this.#orderNumber,
                        properties:   {
                            orderNumberSequenceLength: '4',
                            profitCenterId:            this.#orderingContext.profitCenterId,
                            displayProfileId:          this.client.config.displayProfileId,
                            orderNumberNameSpace:      this.#orderingContext.onDemandTerminalId,
                            priceLevelId:              this.#orderingContext.storePriceLevel,
                            employeeId:                this.#orderingContext.onDemandEmployeeId,
                            mealPeriodId:              MEAL_PERIOD.lunch,
                            closedTerminalId:          this.#orderingContext.onDemandTerminalId,
                            orderSourceSystem:         'onDemand',
                            openScheduleExpression:    '0 0 0 * * *',
                            useIgOrderApi:             true,
                        }
                    },
                    orderGuid:                       null,
                    orderVersion:                    1,
                    paymentType:                     null,
                    processPaymentAsExternalPayment: false,
                    profileId:                       this.client.config.displayProfileId,
                    profitCenterId:                  this.#orderingContext.profitCenterId,
                    profitCenterName:                this.#orderingContext.profitCenterName,
                    receiptInfo:                     {
                        orderData: {
                            orderId:      this.#orderId,
                            version:      1,
                            tenantId:     this.client.config.tenantId,
                            contextId:    this.client.config.contextId,
                            created:      nowString,
                            lastUpdated:  nowString,
                            orderState:   'OPEN',
                            orderNumber:  this.orderNumber,
                            currencyUnit: 'USD',
                            lineItems:    Array.from(this.#lineItemsById.values())
                        }
                    },
                    salesTransactionData:            null,
                    scannedItemOrder:                false,
                    scheduledDay:                    0,
                    shouldRefundOnFailure:           true,
                    siteId:                          this.client.config.contextId,
                    storePriceLevel:                 this.#orderingContext.storePriceLevel,
                    stripeTransactionData:           null,
                    subtotal:                        this.#orderTotalWithoutTax.toString(),
                    tenantId:                        this.client.config.tenantId,
                    terminalId:                      this.#orderingContext.onDemandTerminalId,
                    tipAmount:                       0,
                    tipPercent:                      0,
                    tokenizedData:                   {
                        paymentDetails: {
                            taxAmount:            this.orderTotalTax.toString(),
                            invoiceId:            this.#orderNumber,
                            billDate:             nowString,
                            userCurrentDate:      nowString,
                            currencyUnit:         'USD',
                            description:          `Order ${this.#orderNumber}`,
                            transactionAmount:    this.orderTotalWithTax.toString(),
                            multiPaymentAmount:   fixed(this.orderTotalWithTax, 2),
                            isWindCave:           false,
                            isCyberSource:        false,
                            isCyberSourceWallets: false,
                            language:             'en',
                            apiToken:             this.#cardProcessorToken,
                            payTenantId:          this.client.config.tenantId,
                            accountNumberMasked:  cardInfo.accountNumberMasked,
                            cardIssuer:           cardInfo.cardIssuer,
                            expirationYearMonth:  cardInfo.expirationYearMonth,
                            cardHolderName:       cardInfo.cardHolderName,
                            postalCode:           cardInfo.postalCode,
                        },
                        saveCardFlag:   false,
                        token:          paymentToken
                    },
                    use24HrTimeFormat:               false,
                    useIgPosApi:                     false,
                    walletPaymentData:               null,
                    walletSaleTransactionData:       null
                })
            }
        );
    }

    private async _runStages(requiredStage: SubmitOrderStage, callback: () => Promise<void>): Promise<void> {
        if (this.#lastCompletedStage !== requiredStage) {
            throw new Error(`Order is in the wrong stage! Expected: ${requiredStage}, actual: ${this.#lastCompletedStage}`);
        }

        this.#orderingContext = await this._retrieveOrderingContextAsync();

        try {
            await callback();
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
        await this._runStages(SubmitOrderStage.initializeCardProcessor, async () => {
            this.#lastCompletedStage = SubmitOrderStage.payment;

            await this._closeOrderWithIframeTokenAsync({
                alias,
                phoneData,
                paymentToken,
                cardInfo,
            });

            this.#lastCompletedStage = SubmitOrderStage.closeOrder;

            await this._sendPhoneConfirmation(phoneData);

            this.#lastCompletedStage = SubmitOrderStage.complete;
        });
    }
}