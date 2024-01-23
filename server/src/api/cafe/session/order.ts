import { ICardData, ICartItem, ISubmitOrderParams, SubmitOrderStage } from '@msdining/common/dist/models/cart.js';
import { CafeDiscoverySession, JSON_HEADERS } from './discovery.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import {
    IAddToOrderResponse,
    ICardProcessorPaymentResponse, ICloseOrderRequest,
    IRetrieveCardProcessorTokenResponse
} from '../../../models/buyondemand/cart.js';
import hat from 'hat';
import { ISiteDataResponseItem } from '../../../models/buyondemand/config.js';
import { IOrderingContext } from '../../../models/cart.js';
import { OrderingClient } from '../../storage/clients/ordering.js';
import { StringUtil } from '../../../util/string.js';
import { fixed } from '../../../util/math.js';
import { makeRequestWithRetries } from '../../../util/request.js';
import fetch from 'node-fetch';
import { IMenuItem } from '../../../models/cafe.js';

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
    }
}

export class CafeOrderSession extends CafeDiscoverySession {
    #orderingContext: IOrderingContext = {
        onDemandTerminalId: '',
        onDemandEmployeeId: '',
        profitCenterId:     '',
        storePriceLevel:    ''
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

    public get isReadyForSubmit() {
        return this.#lastCompletedStage === SubmitOrderStage.initializeCardProcessor;
    }

    public get orderNumber() {
        return this.#orderNumber;
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

        return {
            onDemandTerminalId: siteData.displayOptions.onDemandTerminalId,
            onDemandEmployeeId: siteData.displayOptions.onDemandEmployeeId,
            profitCenterId:     siteData.displayOptions['profit-center-id'],
            storePriceLevel:    siteData.storePriceLevel,
        };
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

        const response = await this._requestAsync(`/order/${this.config.tenantId}/${this.config.contextId}/orders`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    item:            {
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
                        count:                1,
                        quantity:             1,
                        selectedModifiers:    serializedModifiers,
                        kpText:               receiptText,
                        receiptText:          receiptText,
                        kitchenDisplayText:   receiptText
                    },
                    scheduledDay:    0,
                    scheduleTime:    {
                        'startTime': '11:15 AM',
                        'endTime':   '11:30 AM'
                    },
                    useIgOrderApi:   true,
                    conceptSchedule: {
                        openScheduleExpression:  '0 0 0 * * *',
                        closeScheduleExpression: '0 0 24 * * *'
                    }
                })
            });

        const json = await response.json();

        if (!isDuckType<IAddToOrderResponse>(json, {
            orderDetails: 'object'
        })) {
            throw new Error('Data is not in the correct format');
        }

        this._assertMatch('Order number mismatch!', this.#orderNumber, json.orderDetails.orderNumber);
        this.#orderNumber = json.orderDetails.orderNumber;

        this._assertMatch('Order ID mismatch!', this.#orderId, json.orderDetails.orderId);
        this.#orderId = json.orderDetails.orderId;

        // These seem to be incremental for some reason, despite the naming and structure of the response. /shrug
        this.#orderTotalTax += Number(json.orderDetails.taxTotalAmount.amount);
        this.#orderTotalWithoutTax += Number(json.orderDetails.taxExcludedTotalAmount.amount);
        this.#orderTotalWithTax += Number(json.orderDetails.totalDueAmount.amount);
    }

    private async _populateCart(cart: ICartItem[]) {
        // Don't  parallelize, not sure what happens on the server if we do multiple concurrent adds
        for (const cartItem of cart) {
            await this._addItemToCart(cartItem);
        }
    }

    private async _getCardProcessorSiteToken() {
        if (StringUtil.isNullOrWhitespace(this.#orderNumber)) {
            throw new Error('Order number is not set');
        }

        if (this.#orderTotalTax === 0 || this.#orderTotalWithoutTax === 0 || this.#orderTotalWithTax === 0) {
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
                body:    {
                    taxAmount:            this.#orderTotalTax,
                    invoiceId:            this.#orderNumber,
                    billDate:             nowString,
                    userCurrentDate:      nowString,
                    currencyUnit:         'USD',
                    description:          `Order ${this.#orderNumber}`,
                    transactionAmount:    this.#orderTotalWithTax,
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
                }
            });

        const json = await response.json();

        if (!isDuckType<IRetrieveCardProcessorTokenResponse>(json, {
            cardProcessorSiteToken: 'string'
        })) {
            throw new Error('Data is not in the correct format');
        }

        return json.cardProcessorSiteToken;
    }

    private _getCardProcessorUrl(token: string) {
        if (!this.config) {
            throw new Error('Config is required to get card processor url!');
        }

        // "6564d6cadc5f9d30a2cf76b3" appears to be hardcoded in the JS. Client ID?
        return `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/${this.config.tenantId}/6564d6cadc5f9d30a2cf76b3?apiToken=${token}&submit=PROCESS&style=https://${this.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.cafe.id}.buy-ondemand.com/false/false&language=en&doVerify=true&version=3`;
    }

    private async _makeCardProcessorRequest(token: string, url: string, method: 'POST' | 'GET', body?: object) {
        const response = await makeRequestWithRetries({
            makeRequest: () => fetch(
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
            )
        });

        if (!response.ok) {
            throw new Error(`Failed to make card processor request: ${response.statusText}`);
        }

        return response;
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

        const text = await response.text();

        const xssToken = text.match(CARD_PROCESSOR_XSS_TOKEN_REGEX)?.groups?.['xssToken'];

        if (xssToken == null) {
            throw new Error('Failed to find XSS token in response');
        }

        return xssToken;
    }

    private async _submitPaymentToCardProcessor(token: string, cardData: ICardData) {
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
                expirationMonth: cardData.expirationMonth,
                expirationYear:  cardData.expirationYear,
                cvv:             cardData.securityCode,
                postalCode:      cardData.postalCode,
                addressLine1:    null,
                addressLine2:    null,
                city:            null,
                state1:          null,
                state2:          null,
                postalCode1:     null,
                doVerify:        false,
                enableCaptcha:   false,
                dateTimeZone:    (new Date()).toISOString(),
                customerId:      '',
                browserInfo:     {
                    userAgent: cardData.userAgent
                },
                // Captcha token is not being sent because enableCaptcha is false
                // token: '',
            }
        );

        const json = await response.json() as ICardProcessorPaymentResponse;

        const submittedPaymentToken = json.token || json.transactionReferenceData?.token;

        if (!submittedPaymentToken) {
            throw new Error('TODO: Handle this by enabling the captcha and trying again');
        }

        return submittedPaymentToken;
    }

    private async _sendPhoneConfirmation(phoneNumberWithCountryCode: string) {
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
                    sendOrderTo:       phoneNumberWithCountryCode,
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

    private async _closeOrderAsync(alias: string, phoneNumberWithCountryCode: string) {
        if (this.#orderId == null) {
            throw new Error('Order ID is not set!');
        }

        await this._requestAsync(
            `/order/${this.#orderId}/processPaymentAndClosedOrder`,
            {
                method: 'POST',
                body: JSON.stringify({})
            }
        )
    }

    public async prepareOrder(items: ICartItem[]): Promise<void> {
        if (this.#lastCompletedStage !== SubmitOrderStage.notStarted) {
            throw new Error('Order has already been started!');
        }

        this.#orderingContext = await this._retrieveOrderingContextAsync();

        try {
            await this._populateCart(items);

            this.#lastCompletedStage = SubmitOrderStage.addToCart;

            this.#cardProcessorToken = await this._getCardProcessorSiteToken();
            this.#xssToken = await this._retrieveCardProcessorXssToken();

            this.#lastCompletedStage = SubmitOrderStage.initializeCardProcessor;
        } catch (err) {
            console.error(`Failed to prepare order after stage ${this.#lastCompletedStage}:`, err);
        }
    }

    // TODO: Figure out a way to break this up into two separate actions to reduce user-perceived latency.
    /**
     * @param cardData
     * @param phoneNumberWithCountryCode
     * @param items
     * @returns The latest stage which was successfully completed.
     */
    public async submitOrder({
                                 alias,
                                 cardData,
                                 phoneNumberWithCountryCode,
                             }: ISubmitOrderParams): Promise<void> {
        if (!this.isReadyForSubmit) {
            throw new Error('Order is not ready to submit!');
        }

        this.#orderingContext = await this._retrieveOrderingContextAsync();

        try {
            const result = await this._submitPaymentToCardProcessor(this.#cardProcessorToken, cardData);

            this.#lastCompletedStage = SubmitOrderStage.payment;

            await this._closeOrderAsync(alias, phoneNumberWithCountryCode);

            this.#lastCompletedStage = SubmitOrderStage.closeOrder;

            // WTF do we do if it fails in this stage?
            await this._sendPhoneConfirmation(phoneNumberWithCountryCode);
        } catch (err) {
            console.error(`Failed to submit order after stage ${this.#lastCompletedStage}:`, err);
        }

        this.#lastCompletedStage = SubmitOrderStage.complete;
    }
}