import { ICartItem, SubmitOrderStage } from '@msdining/common/dist/models/cart.js';
import { CafeDiscoverySession, JSON_HEADERS } from './discovery.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import { IAddToOrderResponse } from '../../../models/buyondemand/cart.js';
import hat from 'hat';
import { ISiteDataResponseItem } from '../../../models/buyondemand/config.js';
import { ICardData, IOrderingContext, ISubmitOrderParams } from '../../../models/cart.js';
import { OrderingClient } from '../../storage/clients/ordering.js';
import { StringUtil } from '../../../util/string.js';
import { fixed } from '../../../util/math.js';
import { makeRequestWithRetries } from '../../../util/request.js';
import fetch from 'node-fetch';
import { IMenuItem } from '../../../models/cafe.js';

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
        profitCenterId:     '',
        storePriceLevel:    ''
    };
    #cartGuid = hat();
    #orderNumber: string | null = null;
    #orderTotalWithoutTax: number = 0;
    #orderTotalTax: number = 0;
    #orderTotalWithTax: number = 0;

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
            profitCenterId:     siteData.displayOptions['profit-center-id'],
            onDemandTerminalId: siteData.displayOptions.onDemandTerminalId,
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

        if (this.#orderNumber != null && this.#orderNumber !== json.orderDetails.orderNumber) {
            throw new Error('Order number mismatch!');
        }

        this.#orderNumber = json.orderDetails.orderNumber;

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

        if (!isDuckType<{ cardProcessorSiteToken: string }>(json, {
            cardProcessorSiteToken: 'string'
        })) {
            throw new Error('Data is not in the correct format');
        }

        return json.cardProcessorSiteToken;
    }

    private async _submitPaymentToCardProcessor(token: string, cardData: ICardData) {
        if (!this.config) {
            throw new Error('Config is required to submit order to card processor!');
        }

        const config = this.config;

        const response = await makeRequestWithRetries({
            makeRequest: () => fetch(
                `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/107/token/6564d6cadc5f9d30a2cf76b3`,
                {
                    method:  'POST',
                    headers: {
                        ...JSON_HEADERS,
                        'Api-Key-Token': token,
                        // "6564d6cadc5f9d30a2cf76b3" appears to be hardcoded in the JS. Client ID?
                        'Referer':       `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/${config.tenantId}/6564d6cadc5f9d30a2cf76b3?apiToken=${token}&submit=PROCESS&style=https://${this.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.cafe.id}.buy-ondemand.com/false/false&language=en&doVerify=true&version=3`
                    },
                    body:    JSON.stringify({
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
                    })
                }
            )
        });

        if (!response.ok) {
            throw new Error(`Failed to submit order: ${response.statusText}`);
        }

        // not sure what is returned here. some token?
        const json = await response.json();

        return json;
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

    private async _closeOrderAsync(context: IOrderingContext, phoneNumberWithCountryCode: string) {
        const taxAmountObject = {
            currencyUnit: 'USD',
            amount:       this.#orderTotalTax.toFixed(2)
        };

        const totalWithoutTaxAmountObject = {
            currencyUnit: 'USD',
            amount:       this.#orderTotalWithoutTax.toFixed(2)
        };

        const totalAmountObject = {
            currencyUnit: 'USD',
            amount:       this.#orderTotalWithTax.toFixed(2)
        };

        const emptyAmountObject = {
            currencyUnit: 'USD',
            amount:       '0.00'
        };

        await this._requestAsync(
            '',
            {
                // TODO
            }
        )
    }

    // TODO: Figure out a way to break this up into two separate actions to reduce user-perceived latency.
    /**
     * @param cardData
     * @param phoneNumberWithCountryCode
     * @param items
     * @returns The latest stage which was successfully completed.
     */
    public async submitOrder({
                                 cardData,
                                 phoneNumberWithCountryCode,
                                 items
                             }: ISubmitOrderParams): Promise<SubmitOrderStage> {
        this.#orderingContext = await this._retrieveOrderingContextAsync();

        let lastCompletedStage = SubmitOrderStage.notStarted;
        try {
            await this._populateCart(items);

            lastCompletedStage = SubmitOrderStage.addToCart;

            const cardProcessorToken = await this._getCardProcessorSiteToken();

            const result = await this._submitPaymentToCardProcessor(cardProcessorToken, cardData);

            lastCompletedStage = SubmitOrderStage.payment;

            // WTF do we do if it fails in this stage?
            await this._sendPhoneConfirmation(phoneNumberWithCountryCode);

            lastCompletedStage = SubmitOrderStage.closeOrder;
        } catch (err) {
            console.error(`Failed to submit order after stage ${lastCompletedStage}:`, err);
            return lastCompletedStage;
        }

        return SubmitOrderStage.complete;
    }
}