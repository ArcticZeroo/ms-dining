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

export class CafeOrderSession extends CafeDiscoverySession {
    #orderingContext: IOrderingContext;
    #cartGuid = hat();
    #orderNumber: string | null = null;
    #orderTotalWithoutTax: number = 0;
    #orderTotalTax: number = 0;
    #orderTotalWithTax: number = 0;

    private async _requestOrderingContextAsync(): Promise<IOrderingContext> {
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

    private async _addItemToCart(cartItem: ICartItem) {
        const menuItem = await MenuItemStorageClient.retrieveMenuItemLocallyAsync(cartItem.itemId);

        if (menuItem == null) {
            throw new Error(`Failed to find menu item with id "${cartItem.itemId}"`);
        }

        const itemId = hat();

        const instructions = cartItem.specialInstructions ? [
            {
                label: '',
                text:  cartItem.specialInstructions
            }
        ] : [];

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
                        options:              [], // TODO: modifiers
                        lineItemInstructions: instructions,
                        cartItemId:           itemId
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

    private async _submitOrderToCardProcessor(token: string, cardData: ICardData) {
        const response = await makeRequestWithRetries({
            makeRequest: () => fetch(
                `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/107/token/6564d6cadc5f9d30a2cf76b3`,
                {
                    method:  'POST',
                    headers: {
                        ...JSON_HEADERS,
                        'Api-Key-Token': token,
                        'Referer':       `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/${this.config.tenantId}/6564d6cadc5f9d30a2cf76b3?apiToken=${token}&submit=PROCESS&style=https://${this.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.cafe.id}.buy-ondemand.com/false/false&language=en&doVerify=true&version=3`
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
    }

    private async _sendPhoneConfirmation(phoneNumberWithCountryCode: string) {
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

            lastCompletedStage = SubmitOrderStage.payment;

            const result = await this._submitOrderToCardProcessor(cardProcessorToken, cardData);
        } catch (err) {
            console.error(`Failed to submit order after stage ${lastCompletedStage}:`, err);
            return lastCompletedStage;
        }

        // WTF do we do if it fails in this stage?
        await this._sendPhoneConfirmation(phoneNumberWithCountryCode);
    }
}