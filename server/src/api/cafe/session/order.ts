import { ICardData, ICartItem, SubmitOrderStage } from '@msdining/common/dist/models/cart.js';
import { getPaymentProcessorTimezoneOffset } from '../../../util/date.js';
import { logDebug, logError } from '../../../util/log.js';
import { CafeDiscoverySession, JSON_HEADERS } from './discovery.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import {
    IAddToOrderResponse, ICardProcessorPaymentFailureResponse,
    ICardProcessorPaymentSuccessResponse,
    IOrderLineItem,
    IRetrieveCardProcessorTokenResponse, isCardProcessorPaymentFailureResponse
} from '../../../models/buyondemand/cart.js';
import hat from 'hat';
import { ISiteDataResponseItem } from '../../../models/buyondemand/config.js';
import { IOrderingContext } from '../../../models/cart.js';
import { OrderingClient } from '../../storage/clients/ordering.js';
import { StringUtil } from '../../../util/string.js';
import { fixed } from '../../../util/math.js';
import { makeRequestWithRetries } from '../../../util/request.js';
import fetch from 'node-fetch';
import { ICafe, IMenuItem } from '../../../models/cafe.js';
import { phone, PhoneValidResult } from 'phone';
import { MEAL_PERIOD } from '../../../constants/enum.js';

const CARD_PROCESSOR_XSS_TOKEN_REGEX = /<input\s+type="hidden"\s+id="token"\s+name="token"\s+value="(?<xssToken>.+?)"\s+\/>/;

// TODO: Maybe just directly call get-items for each item instead of dealing with a bunch of extra data storage?

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

interface ISubmitOrderProcessedParams {
    alias: string;
    cardData: ICardData;
    phoneData: PhoneValidResult;
}

interface ISubmittedPaymentData {
    token: string;
    cardIssuer: string;
    accountNumberMasked: string;
}

interface ICloseOrderParams extends ISubmitOrderProcessedParams {
    submittedPaymentData: ISubmittedPaymentData;
}

export class CafeOrderSession extends CafeDiscoverySession {
    #orderingContext: IOrderingContext = {
        onDemandTerminalId: '',
        onDemandEmployeeId: '',
        profitCenterId:     '',
        profitCenterName:   '',
        storePriceLevel:    '',
    };
    #cartGuid = hat();
    #orderId: string | null = null;
    #orderNumber: string | null = null;
    #orderTotalWithoutTax: number = 0;
    #orderTotalTax: number = 0;
    #orderTotalWithTax: number = 0;
    #lastCompletedStage: SubmitOrderStage = SubmitOrderStage.notStarted;
    #cardProcessorToken: string = '';
    #xssToken: string = '';
    readonly #cartItems: ICartItem[];
    readonly #lineItemsById = new Map<string, IOrderLineItem>();

    constructor(cafe: ICafe, cartItems: ICartItem[]) {
        super(cafe);
        this.#cartItems = cartItems;
    }

    get lastCompletedStage() {
        return this.#lastCompletedStage;
    }

    public get isReadyForSubmit() {
        return this.#lastCompletedStage === SubmitOrderStage.initializeCardProcessor;
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

    private async _requestOrderingContextAsync(): Promise<IOrderingContext> {
        if (!this.config) {
            throw new Error('Config is not set!');
        }

        const response = await this._requestAsync(`/sites/${this.config.contextId}`,
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
        const existingOrderingContext = await OrderingClient.retrieveOrderingContextAsync(this.cafe.id);
        if (existingOrderingContext != null) {
            return existingOrderingContext;
        }

        const orderingContext = await this._requestOrderingContextAsync();

        await OrderingClient.createOrderingContextAsync(this.cafe.id, orderingContext);

        return orderingContext;
    }

    private _serializeModifiers(cartItem: ICartItem, localMenuItem: IMenuItem): Array<ISerializedModifier> {
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

    private _assertMatch(errorMessage: string, existingValue: string | null, newValue: string) {
        if (existingValue != null && existingValue !== newValue) {
            throw new Error(errorMessage);
        }
    }

    private async _addItemToCart(cartItem: ICartItem) {
        if (!this.config) {
            throw new Error('Config is required to add items to the cart!');
        }

        const menuItem = await MenuItemStorageClient.retrieveMenuItemLocallyAsync(cartItem.itemId);

        if (menuItem == null) {
            throw new Error(`Failed to find menu item with id "${cartItem.itemId}"`);
        }

        const serializedModifiers = this._serializeModifiers(cartItem, menuItem);

        const cartItemId = hat();

        const instructions = cartItem.specialInstructions ? [
            {
                label: '',
                text:  cartItem.specialInstructions
            }
        ] : [];

        const receiptText = menuItem.receiptText || menuItem.name;

        const serializedItem = {
            id:                   menuItem.id,
            allowPriceOverride:   true,
            displayText:          menuItem.name,
            properties:           {
                cartGuid:     this.#cartGuid,
                priceLevelId: this.#orderingContext.storePriceLevel
            },
            amount:               menuItem.price.toFixed(2),
            options:              [],
            lineItemInstructions: instructions,
            cartItemId:           cartItemId,
            count:                cartItem.quantity,
            quantity:             cartItem.quantity,
            selectedModifiers:    serializedModifiers,
            kpText:               receiptText,
            receiptText:          receiptText,
            kitchenDisplayText:   receiptText
        };

        const requestBody = {
            item:               serializedItem,
            conceptSchedule:    {
                openScheduleExpression:  '0 0 0 * * *',
                closeScheduleExpression: '0 0 24 * * *'
            },
            scheduledDay:       0,
            scheduleTime:       {
                'startTime': '11:15 AM',
                'endTime':   '11:30 AM'
            },
            isMultiItem:        false,
            onDemandTerminalId: this.#orderingContext.onDemandTerminalId,
            orderTimeZone:      'PST8PDT',
            properties:         {
                displayProfileId:          this.config.displayProfileId,
                employeeId:                this.#orderingContext.onDemandEmployeeId,
                orderNumberNameSpace:      '941', // todo
                orderNumberSequenceLength: 4,
                orderSourceSystem:         'onDemand',
                profitCenterId:            this.#orderingContext.profitCenterId,
                priceLevelId:              this.#orderingContext.storePriceLevel,
            },
            schedule:           [
                {
                    '@c':                '.DisplayProfileTask',
                    displayProfileState: {
                        // do we need to populate this?
                        conceptStates: [
                            {
                                'conceptId': '10975',
                                'menuId':    '16795'
                            },
                            {
                                'conceptId': '10972',
                                'menuId':    '16787'
                            },
                            {
                                'conceptId': '10927',
                                'menuId':    '16650'
                            },
                            {
                                'conceptId': '11002',
                                'menuId':    '16822'
                            },
                            {
                                'conceptId': '10995',
                                'menuId':    '16819'
                            },
                            {
                                'conceptId': '10937',
                                'menuId':    '16730'
                            },
                            {
                                'conceptId': '11213',
                                'menuId':    '16728'
                            },
                            {
                                'conceptId': '11064',
                                'menuId':    '16904'
                            },
                            {
                                'conceptId': '10818',
                                'menuId':    '16492'
                            }
                        ]
                    },
                    properties:          {
                        'meal-period-id': MEAL_PERIOD.lunch.toString(),
                    },
                    scheduledExpression: '0 0 0 * * *',
                }
            ],
            storePriceLevel:    this.#orderingContext.storePriceLevel,
            useIgOrderApi:      true,
        };

        const response = await this._requestAsync(`/order/${this.config.tenantId}/${this.config.contextId}/orders`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(
                    {
                        'item':                              {
                            'id':                         menuItem.id,
                            'contextId':                  this.config.contextId,
                            'tenantId':                   this.config.tenantId,
                            'itemId':                     '1013121',
                            'name':                       'DELI-SIDE-Pear',
                            'isDeleted':                  false,
                            'isActive':                   false,
                            'lastUpdateTime':             '2024-02-02T19:28:47.758Z',
                            'revenueCategoryId':          '12',
                            'productClassId':             '370',
                            'kpText':                     'Pear',
                            'kitchenDisplayText':         'Pear',
                            'receiptText':                'Pear',
                            'price':                      {
                                'currencyUnit': 'USD',
                                'amount':       '0.99'
                            },
                            'defaultPriceLevelId':        this.#orderingContext.storePriceLevel,
                            'priceLevels':                {
                                '1':  {
                                    'priceLevelId': '1',
                                    'name':         'Base Price',
                                    'price':        {
                                        'currencyUnit': 'USD',
                                        'amount':       '0.00'
                                    }
                                },
                                '70': {
                                    'priceLevelId': '70',
                                    'name':         'MS_2019',
                                    'price':        {
                                        'currencyUnit': 'USD',
                                        'amount':       '0.80'
                                    }
                                },
                                '71': {
                                    'priceLevelId': '71',
                                    'name':         'MS_2023',
                                    'price':        {
                                        'currencyUnit': 'USD',
                                        'amount':       '0.99'
                                    }
                                }
                            },
                            'isSoldByWeight':             false,
                            'tareWeight':                 0,
                            'isDiscountable':             true,
                            'allowPriceOverride':         true,
                            'isTaxIncluded':              false,
                            'taxClasses':                 [
                                'WA Cafe Tax EXMT'
                            ],
                            'kitchenVideoLabel':          'Pear',
                            'kitchenVideoId':             '653fed25d400b16272b82edd',
                            'kitchenVideoCategoryId':     0,
                            'kitchenCookTimeSeconds':     0,
                            'skus':                       [],
                            'itemType':                   'ITEM',
                            'displayText':                'Pear',
                            'itemImages':                 [
                                {
                                    'businessContextId': '8cf3ef7a-4781-40c0-a40e-49d765bd0967',
                                    'imageId':           '6672744',
                                    'name':              'Deli - Pear Glamour__00',
                                    'fileNames':         [
                                        'Deli - Pear Glamour_xs__00.JPG',
                                        'Deli - Pear Glamour_sm__00.JPG',
                                        'Deli - Pear Glamour_md__00.JPG',
                                        'Deli - Pear Glamour_lg__00.JPG',
                                        'Deli - Pear Glamour_xl__00.JPG',
                                        'Deli - Pear Glamour__00.JPG'
                                    ],
                                    'tags':              [
                                        'ITEM'
                                    ]
                                }
                            ],
                            'isAvailableToGuests':        true,
                            'isPreselectedToGuests':      false,
                            'tagNames':                   [],
                            'tagIds':                     [
                                '656774cf0b49d1380884d196'
                            ],
                            'substituteItemId':           '',
                            'isSubstituteItem':           false,
                            'properties':                 {
                                'cartGuid':     '653ff343ce31d740113b91e6-1710269657477',
                                'scannedItem':  false,
                                'calories':     '80',
                                'maxCalories':  '130',
                                'priceLevelId': '71'
                            },
                            'amount':                     '0.99',
                            'menuPriceLevelId':           this.#orderingContext.storePriceLevel,
                            'menuId':                     '16787',
                            'menuPriceLevelApplied':      false,
                            'image':                      'https://ondemand-cdn-static-asset-prod-westus.rguest.com//api/image/107/8cf3ef7a-4781-40c0-a40e-49d765bd0967/Deli - Pear Glamour__00.JPG',
                            'thumbnail':                  'https://ondemand-cdn-static-asset-prod-westus.rguest.com//api/image/107/8cf3ef7a-4781-40c0-a40e-49d765bd0967/Deli - Pear Glamour__00.JPG',
                            'options':                    [],
                            'attributes':                 [],
                            'conceptId':                  '10972',
                            'isItemCustomizationEnabled': false,
                            'holdAndFire':                false,
                            'count':                      1,
                            'quantity':                   1,
                            'lineItemInstructions':       [
                                {
                                    'label': '',
                                    'text':  'test'
                                }
                            ],
                            'conceptName':                'Delicatessen',
                            'modifierTotal':              0,
                            'mealPeriodId':               null,
                            'uniqueId':                   '653ff343ce31d740113b91e6-1710269657477',
                            'cartItemId':                 cartItemId
                        },
                        'currencyDetails':                   {
                            'currencyDecimalDigits': '2',
                            'currencyCultureName':   'en-US',
                            'currencyCode':          'USD',
                            'currencySymbol':        '$'
                        },
                        'schedule':                          [
                            {
                                '@c':                  '.DisplayProfileTask',
                                'scheduledExpression': '0 0 8 * * TUE',
                                'properties':          {
                                    'meal-period-id': '1'
                                },
                                'displayProfileState': {
                                    'displayProfileId': '5341',
                                    'conceptStates':    [
                                        {
                                            'conceptId': '10975',
                                            'menuId':    '16795'
                                        }
                                    ]
                                }
                            },
                            {
                                '@c':                  '.DisplayProfileTask',
                                'scheduledExpression': '0 0 10 * * TUE',
                                'properties':          {
                                    'meal-period-id': '1'
                                },
                                'displayProfileState': {
                                    'displayProfileId': '5341',
                                    'conceptStates':    [
                                        {
                                            'conceptId': '10975',
                                            'menuId':    '16795'
                                        }
                                    ]
                                }
                            },
                            {
                                '@c':                  '.DisplayProfileTask',
                                'scheduledExpression': '0 0 11 * * TUE',
                                'properties':          {
                                    'meal-period-id': '2'
                                },
                                'displayProfileState': {
                                    'displayProfileId': '5341',
                                    'conceptStates':    [
                                        {
                                            'conceptId': '10975',
                                            'menuId':    '16795'
                                        },
                                        {
                                            'conceptId': '10972',
                                            'menuId':    '16787'
                                        },
                                        {
                                            'conceptId': '10927',
                                            'menuId':    '16650'
                                        },
                                        {
                                            'conceptId': '11002',
                                            'menuId':    '16822'
                                        },
                                        {
                                            'conceptId': '10995',
                                            'menuId':    '16819'
                                        },
                                        {
                                            'conceptId': '10937',
                                            'menuId':    '16732'
                                        },
                                        {
                                            'conceptId': '11213',
                                            'menuId':    '16727'
                                        },
                                        {
                                            'conceptId': '10979',
                                            'menuId':    '16797'
                                        },
                                        {
                                            'conceptId': '10819',
                                            'menuId':    '16486'
                                        }
                                    ]
                                }
                            },
                            {
                                '@c':                  '.TransitionTask',
                                'scheduledExpression': '0 0 14 * * TUE',
                                'properties':          {
                                    'TRANSITION_MESSAGE': ''
                                }
                            }
                        ],
                        'orderTimeZone':                     'PST8PDT',
                        'scheduleTime':                      {
                            'startTime': '1:30 PM',
                            'endTime':   '1:45 PM'
                        },
                        'storePriceLevel':                   '71',
                        'scheduledDay':                      0,
                        'useIgOrderApi':                     true,
                        'onDemandTerminalId':                '941',
                        'properties':                        {
                            'employeeId':                '265',
                            'profitCenterId':            '338',
                            'orderSourceSystem':         'onDemand',
                            'orderNumberSequenceLength': 4,
                            'orderNumberNameSpace':      '941',
                            'displayProfileId':          '5341',
                            'priceLevelId':              '71'
                        },
                        'scheduledOrderCompletionTimeStamp': '2024-03-12T19:45:00Z',
                        'conceptSchedule':                   {
                            'openScheduleExpression':  '0 0 11 * * TUE',
                            'closeScheduleExpression': '0 0 14 * * TUE'
                        },
                        'isMultiItem':                       false
                    }
                )
            });

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

    private async _getCardProcessorSiteToken() {
        if (StringUtil.isNullOrWhitespace(this.#orderNumber)) {
            throw new Error('Order number is not set');
        }

        if (this.#orderTotalWithoutTax === 0 || this.#orderTotalWithTax === 0) {
            throw new Error('Order totals cannot be zero');
        }

        if (!this.config) {
            throw new Error('Config is required to get card processor site token!');
        }

        const nowString = (new Date()).toISOString();

        const response = await this._requestAsync(`/iFrame/token/${this.config.tenantId}`,
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
                    style:                `https://${this.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.cafe.id}.buy-ondemand.com/false/false`,
                    multiPaymentAmount:   fixed(this.#orderTotalWithTax, 2),
                    isWindCave:           false,
                    isCyberSource:        false,
                    isCyberSourceWallets: false,
                    language:             'en',
                    contextId:            this.config.contextId,
                    profileId:            this.config.displayProfileId,
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

    private _getCardProcessorUrl(token: string) {
        if (!this.config) {
            throw new Error('Config is required to get card processor url!');
        }

        // "6564d6cadc5f9d30a2cf76b3" appears to be hardcoded in the JS. Client ID?
        return `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/${this.config.tenantId}/6564d6cadc5f9d30a2cf76b3?apiToken=${token}&submit=PROCESS&style=https://${this.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.cafe.id}.buy-ondemand.com/false/false&language=en&doVerify=true&version=3`;
    }

    private async _parseCreditProcessorResponse<T>(response: Awaited<ReturnType<typeof fetch>>): Promise<T> {
        const text = await response.text();

        try {
            return JSON.parse(text);
        } catch (err) {
            if (!response.ok) {
                throw new Error(`Card processor response failed with code ${response.statusText}: ${text}`);
            } else {
                throw new Error(`Failed to parse card processor response: ${text}`);
            }
        }
    }

    private async _makeCardProcessorRequest(token: string, url: string, method: 'POST' | 'GET', body?: object) {
        return await makeRequestWithRetries({
            makeRequest: (retry) => {
                logDebug('Making card processor request');
                logDebug(`${method ?? 'GET'} ${url} (Attempt ${retry})`);
                logDebug(`Token: "${token}"`);
                if (body) {
                    logDebug(JSON.stringify(body));
                }

                return fetch(
                    url,
                    {
                        method,
                        headers: {
                            ...JSON_HEADERS,
                            'Api-Key-Token': token,
                            'Referer':       this._getCardProcessorUrl(token)
                        },
                        body:    body ? JSON.stringify(body) : undefined
                    }
                );
            }
        });
    }

    private async _retrieveCardProcessorXssToken() {
        if (this.#cardProcessorToken.length === 0) {
            throw new Error('Card processor token is not set!');
        }

        const response = await this._makeCardProcessorRequest(
            this.#cardProcessorToken,
            this._getCardProcessorUrl(this.#cardProcessorToken),
            'GET'
        );

        if (!response.ok) {
            throw new Error(`Card processor response failed with code ${response.statusText}`);
        }

        const text = await response.text();

        const xssToken = text.match(CARD_PROCESSOR_XSS_TOKEN_REGEX)?.groups?.['xssToken'];

        if (xssToken == null) {
            throw new Error('Failed to find XSS token in response');
        }

        return xssToken;
    }

    private async _submitPaymentToCardProcessor(token: string, cardData: ICardData): Promise<ISubmittedPaymentData> {
        if (!this.config) {
            throw new Error('Config is required to submit order to card processor!');
        }

        const response = await this._makeCardProcessorRequest(
            token,
            'https://pay.rguest.com/pay-iframe-service/iFrame/tenants/107/token/6564d6cadc5f9d30a2cf76b3',
            'POST',
            {
                cardholderName:  cardData.name,
                cardNumber:      cardData.cardNumber,
                expirationMonth: cardData.expirationMonth.padStart(2, '0'),
                expirationYear:  cardData.expirationYear,
                cvv:             cardData.securityCode,
                postalCode:      cardData.postalCode,
                dateTimeZone:    getPaymentProcessorTimezoneOffset(),
                addressLine1:    null,
                addressLine2:    null,
                city:            null,
                state1:          null,
                state2:          null,
                postalCode1:     null,
                doVerify:        'false',
                enableCaptcha:   false,
                // doVerify:        'true',
                // enableCaptcha:   true,
                // 'g-recaptcha-response': '03AFcWeA6NbAxkZklfmkgiYS-skISqqNeGkQV4Ygim33N_lxmS9uKW6qd6FvLVKEFEDa8NVJ9DnLOWiKi_cmozUpEE94VyZ6TN-LCAnejRU4r49-YF-273oWXy9_1cYtQYRbNG3jYvqpYUTPsb2SkFL40beSsoLl_4WuD1GVM02SxAjmUMAZ6F7ZnU0VrKBLeEDaXfIZP6VvjKxJ0QXmtgJnGS0AaHHyOSZQzwu4jDE5GRQ6xTbP6ofnjnhlvS7krlG4Cn8nf06DEygh2QUkqnxKLy6jtGFZc56WE0R9UBPn6BnW0G6PINBFGMkEKW_-mL24MsaASS8aGqmg0NUSBVxmJNflwGlCfn_vnxMi93FAB0s0bYPzo-JC0id2tqtUsEQNLHktYYHIhgVgMIFmo8eda2aGj53Ush5aSbL9E1J9RbCmlvbMtd-MK2p8ykfNbqnH_qtaEqdsW07b_BHZqJGSDkjTNDkG5EltHMp6299_7z0MS-y4CsZWsjfnOmJtfFN9rd0DWfQKMkLkZF-rNywI0bj_7aiXo4hjiRnNIL9BJGq-wsV3HqtY79bCGShidV1NF-9DfG9hMzI1pJnVYPCFhs6hX_tC8tXc0VJ7RfAtVUjRyWpsJdIOPkVLhsMwsJ15uoe7BOe87YIp4Ez5wni18LOF9dupTqoyiGTm2nVqChgE26viw_wbK5VhzVGcDkhDaXa4B8Cwrz0uA7vJcOu7hkj1qKO3m6G4rlBiWi7fCxCkbjH-3syGM2h45h4MD70Lcjrt5DgHp1OFoCJErhvbAf8NAh-BKOk85HkKoaGEa1SR4WzUb-hpIn2UsyMtO40UO0tujC60pQLK7IWTFhXfkyg1NvThb8_4xygmphdT54ZqKDKOF3fkruBJOc6fTFiZZZFljhfXEneDGuqtnI2_8tXwS0JA7_knjOExW-JCZfnTXsrmTX1r4QzzDvSgvyoFukmMyZVxKmwifL-PZmTJVf5nOxaLggpIXRB-kdSQYKDFvBptFK4HHJ0hLjiKFYp0AEtddALBDI7A5C3Mac79FavXvq6a2QP8PAEeKP-nGPffjBMwpTJuzkXnz3AHa5j4hP0edNXziyT-E2sdXD6jgOS1dAYUvOWOHuTzEWl3ps9q3yjaI07ymBIbOYarGZJQAzm8YSZnsXgFi9PD4zkSO0p4y7AUWVSk8oSHjCorz-vxtd_f5ly_bZ8J6EGf-1hkzYszKSZd1H_5T_OodXtHaleclcFSiz1U4DB2urNE09JzE8nkRRzVS7USUqiB6IKDirZP-HeP-u61gU2IEzecXRLEZZ-RjImKNthp1eVUrVifn9BM2WiaY4MqcAlLitXAHYanMQBAxUPghNKSoqxyab-SH01F1TFPijZdVP7Xz3dKCTMTb_4kZzsFRZC2bLx-bNvNnU4fBisewU-AMLDJpnCF7elxwhmKke0eqhgZDNVzU0BvU1xAgFm0De403R41ttBG8wwkgAIUvzMqsoOvrtULYbrW-FAEkHOfoC6-V8h1wdeN692ukkzXjtImfzByTskxUrjkilc5DodvZ3eYMhojsBagMhrqZ-HM4QVvX7KRS3ZWeoy3zBL_EjklXOnFiAIhWPXcONwnNQY3mqWSPxlulPexlBQhhX0pVe7g1BTRw5adw5Uzi3pkAnO3pwTNzEMXrAs-gWK7SBz7sQVi1Zym2mxzD8BohrmKWqIJPQiJvEOTFeXre4FnhOCWKzL7w0v0DffvGOpDKwze-FC5_sL5euEuPV_eVR0N5_f4_AVQSQc4kVFsI',
                // googleCaptcha: '03AFcWeA6NbAxkZklfmkgiYS-skISqqNeGkQV4Ygim33N_lxmS9uKW6qd6FvLVKEFEDa8NVJ9DnLOWiKi_cmozUpEE94VyZ6TN-LCAnejRU4r49-YF-273oWXy9_1cYtQYRbNG3jYvqpYUTPsb2SkFL40beSsoLl_4WuD1GVM02SxAjmUMAZ6F7ZnU0VrKBLeEDaXfIZP6VvjKxJ0QXmtgJnGS0AaHHyOSZQzwu4jDE5GRQ6xTbP6ofnjnhlvS7krlG4Cn8nf06DEygh2QUkqnxKLy6jtGFZc56WE0R9UBPn6BnW0G6PINBFGMkEKW_-mL24MsaASS8aGqmg0NUSBVxmJNflwGlCfn_vnxMi93FAB0s0bYPzo-JC0id2tqtUsEQNLHktYYHIhgVgMIFmo8eda2aGj53Ush5aSbL9E1J9RbCmlvbMtd-MK2p8ykfNbqnH_qtaEqdsW07b_BHZqJGSDkjTNDkG5EltHMp6299_7z0MS-y4CsZWsjfnOmJtfFN9rd0DWfQKMkLkZF-rNywI0bj_7aiXo4hjiRnNIL9BJGq-wsV3HqtY79bCGShidV1NF-9DfG9hMzI1pJnVYPCFhs6hX_tC8tXc0VJ7RfAtVUjRyWpsJdIOPkVLhsMwsJ15uoe7BOe87YIp4Ez5wni18LOF9dupTqoyiGTm2nVqChgE26viw_wbK5VhzVGcDkhDaXa4B8Cwrz0uA7vJcOu7hkj1qKO3m6G4rlBiWi7fCxCkbjH-3syGM2h45h4MD70Lcjrt5DgHp1OFoCJErhvbAf8NAh-BKOk85HkKoaGEa1SR4WzUb-hpIn2UsyMtO40UO0tujC60pQLK7IWTFhXfkyg1NvThb8_4xygmphdT54ZqKDKOF3fkruBJOc6fTFiZZZFljhfXEneDGuqtnI2_8tXwS0JA7_knjOExW-JCZfnTXsrmTX1r4QzzDvSgvyoFukmMyZVxKmwifL-PZmTJVf5nOxaLggpIXRB-kdSQYKDFvBptFK4HHJ0hLjiKFYp0AEtddALBDI7A5C3Mac79FavXvq6a2QP8PAEeKP-nGPffjBMwpTJuzkXnz3AHa5j4hP0edNXziyT-E2sdXD6jgOS1dAYUvOWOHuTzEWl3ps9q3yjaI07ymBIbOYarGZJQAzm8YSZnsXgFi9PD4zkSO0p4y7AUWVSk8oSHjCorz-vxtd_f5ly_bZ8J6EGf-1hkzYszKSZd1H_5T_OodXtHaleclcFSiz1U4DB2urNE09JzE8nkRRzVS7USUqiB6IKDirZP-HeP-u61gU2IEzecXRLEZZ-RjImKNthp1eVUrVifn9BM2WiaY4MqcAlLitXAHYanMQBAxUPghNKSoqxyab-SH01F1TFPijZdVP7Xz3dKCTMTb_4kZzsFRZC2bLx-bNvNnU4fBisewU-AMLDJpnCF7elxwhmKke0eqhgZDNVzU0BvU1xAgFm0De403R41ttBG8wwkgAIUvzMqsoOvrtULYbrW-FAEkHOfoC6-V8h1wdeN692ukkzXjtImfzByTskxUrjkilc5DodvZ3eYMhojsBagMhrqZ-HM4QVvX7KRS3ZWeoy3zBL_EjklXOnFiAIhWPXcONwnNQY3mqWSPxlulPexlBQhhX0pVe7g1BTRw5adw5Uzi3pkAnO3pwTNzEMXrAs-gWK7SBz7sQVi1Zym2mxzD8BohrmKWqIJPQiJvEOTFeXre4FnhOCWKzL7w0v0DffvGOpDKwze-FC5_sL5euEuPV_eVR0N5_f4_AVQSQc4kVFsI',
                customerId: '',
                // Intentional that we're double-stringifying here. The actual request sends this object as an encoded string.
                browserInfo: JSON.stringify({
                    userAgent: cardData.userAgent
                }),
                token:       this.#xssToken,
            }
        );

        const json = await this._parseCreditProcessorResponse<ICardProcessorPaymentSuccessResponse | ICardProcessorPaymentFailureResponse>(response);

        if (isCardProcessorPaymentFailureResponse(json)) {
            throw new Error(`Card processor response failed (${response.statusText}): ${json.message}`);
        }

        // This is how the actual JS does it
        const submittedPaymentToken = json.token || json.transactionReferenceData?.token;

        if (!submittedPaymentToken) {
            logDebug('Card processor response is missing payment token:', json);
            throw new Error('TODO: Handle this by enabling the captcha and trying again');
        }

        return {
            token:               submittedPaymentToken,
            accountNumberMasked: json.cardInfo.accountNumberMasked,
            cardIssuer:          json.cardInfo.cardIssuer
        };
    }

    private async _sendPhoneConfirmation(phoneData: PhoneValidResult) {
        if (!this.config) {
            throw new Error('Config is required to send phone confirmation!');
        }

        await this._requestAsync(`/communication/sendSMSReceipt`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    contextId:         this.config.contextId,
                    orderId:           this.#orderNumber,
                    sendOrderTo:       phoneData.phoneNumber,
                    storeInfo:         {
                        businessContextId:       this.config.contextId,
                        tenantId:                this.config.tenantId,
                        storeInfoId:             this.config.storeId,
                        storeName:               this.cafe.name,
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
        if (!this.config) {
            throw new Error('Config is required to retrieve profit center name!');
        }

        const response = await this._requestAsync(`/sites/${this.config.tenantId}/${this.config.contextId}/profitCenter/${profitCenterId}`,
            {
                method: 'GET'
            });

        return response.text();
    }

    private async _closeOrderAsync({ alias, phoneData, cardData, submittedPaymentData }: ICloseOrderParams) {
        if (StringUtil.isNullOrWhitespace(this.#xssToken)) {
            throw new Error('XSS token is not set!');
        }

        if (this.#orderId == null) {
            throw new Error('Order ID is not set!');
        }

        if (this.config == null) {
            throw new Error('Config is not set!');
        }

        const nowString = (new Date()).toISOString();

        await this._requestAsync(
            `/order/${this.#orderId}/processPaymentAndClosedOrder`,
            {
                method: 'POST',
                body:   JSON.stringify({
                    amHereConfig:                    {
                        isCurbsidePickup: false,
                        lateTolerance:    5,
                        origin:           `https://${this.cafe.id}.buy-ondemand.com`
                    },
                    authorizedAmount:                this.orderTotalWithTax.toString(),
                    calorieTotal:                    {
                        baseCalorie: 0,
                        maxCalorie:  0
                    },
                    capacitySuggestionPerformed:     false,
                    contextId:                       this.config.contextId,
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
                    displayProfileId:                this.config.displayProfileId,
                    emailInfo:                       {
                        featureEnabled:     true,
                        customerAddress:    [], // todo, maybe throw an email in here
                        headerText:         'Email receipt',
                        instructionText:    'Please use your MICROSOFT email for receipt & reception ',
                        receiptFooter:      'Thanks for using msdining.frozor.io!',
                        receiptFromAddress: 'noreply@rguest.com',
                        receiptFromName:    this.cafe.name,
                        receiptSubject:     `Receipt from ${this.cafe.name}`,
                    },
                    engageAccrualEnabled:            false,
                    firstName:                       alias,
                    giftCardSaleDataMap:             {},
                    graceCompletionTime:             false,
                    igOrderStatusConfig:             {},
                    igSettings:                      {
                        'discountStateTitle':              'Check for loyalty discounts',
                        'timezone':                        'PST8PDT',
                        'LOYALTY/uiNoTendersAvailableMsg': 'You do not have available points or vouchers to apply. \nPlease use a different payment type or cancel this order.',
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
                        domain:              `${this.cafe.id}.buy-ondemand.com`,
                        storeInfo:           {
                            businessContextId:       this.config.contextId,
                            tenantId:                this.config.tenantId,
                            storeInfoId:             this.config.storeId,
                            storeName:               this.cafe.name,
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
                    notifyGuestOnFailure:            true, // false from the rela thing
                    order:                           {
                        orderId:      this.#orderId,
                        version:      1,
                        tenantId:     this.config.tenantId,
                        contextId:    this.config.contextId,
                        created:      nowString,
                        lastUpdated:  nowString,
                        orderState:   'OPEN',
                        currencyUnit: 'USD',
                        orderNumber:  this.#orderNumber,
                        properties:   {
                            orderNumberSequenceLength: '4',
                            profitCenterId:            this.#orderingContext.profitCenterId,
                            displayProfileId:          this.config.displayProfileId,
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
                    profileId:                       this.config.displayProfileId,
                    profitCenterId:                  this.#orderingContext.profitCenterId,
                    profitCenterName:                this.#orderingContext.profitCenterName,
                    receiptInfo:                     {
                        orderData: {
                            orderId:      this.#orderId,
                            version:      1,
                            tenantId:     this.config.tenantId,
                            contextId:    this.config.contextId,
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
                    shouldRefundOnFailure:           true, // false from the real thing
                    siteId:                          this.config.contextId,
                    storePriceLevel:                 this.#orderingContext.storePriceLevel,
                    stripeTransactionData:           null,
                    subtotal:                        this.#orderTotalWithoutTax.toString(),
                    tenantId:                        this.config.tenantId,
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
                            payTenantId:          this.config.tenantId,
                            accountNumberMasked:  submittedPaymentData.accountNumberMasked,
                            cardIssuer:           submittedPaymentData.cardIssuer,
                            expirationYearMonth:  `${cardData.expirationYear}${cardData.expirationMonth.padStart(2, '0')}`,
                            cardHolderName:       cardData.name,
                            postalCode:           cardData.postalCode,
                        },
                        saveCardFlag:   false,
                        token:          submittedPaymentData.token
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
            logError(`{${this.cafe.name}} Failed after stage ${this.#lastCompletedStage}:`, err);
        }
    }

    public async populateCart(): Promise<void> {
        await this._runStages(SubmitOrderStage.notStarted, async () => {
            await this._populateCart();
            this.#lastCompletedStage = SubmitOrderStage.addToCart;
        });
    }

    public async prepareBeforeOrder(): Promise<void> {
        await this._runStages(SubmitOrderStage.addToCart, async () => {
            this.#cardProcessorToken = await this._getCardProcessorSiteToken();
            this.#xssToken = await this._retrieveCardProcessorXssToken();

            this.#lastCompletedStage = SubmitOrderStage.initializeCardProcessor;
        });
    }

    // TODO: Figure out a way to break this up into two separate actions to reduce user-perceived latency.
    /**
     * @returns The latest stage which was successfully completed.
     */
    public async submitOrder({
                                 alias,
                                 cardData,
                                 phoneData,
                             }: ISubmitOrderProcessedParams): Promise<void> {
        await this._runStages(SubmitOrderStage.initializeCardProcessor, async () => {
            const submittedPaymentData = await this._submitPaymentToCardProcessor(this.#cardProcessorToken, cardData);

            this.#lastCompletedStage = SubmitOrderStage.payment;

            await this._closeOrderAsync({
                alias,
                cardData,
                phoneData,
                submittedPaymentData
            });

            this.#lastCompletedStage = SubmitOrderStage.closeOrder;

            await this._sendPhoneConfirmation(phoneData);

            this.#lastCompletedStage = SubmitOrderStage.complete;
        });
    }
}