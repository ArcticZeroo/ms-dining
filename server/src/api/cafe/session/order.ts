import { ICartItem } from '@msdining/common/dist/models/cart.js';
import { CafeDiscoverySession, JSON_HEADERS } from './discovery.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import { IAddToOrderResponse } from '../../../models/buyondemand/cart.js';
import hat from 'hat';
import { ISiteDataResponseItem } from '../../../models/buyondemand/config.js';
import { ICardData, IOrderingContext } from '../../../models/cart.js';
import { OrderingClient } from '../../storage/clients/ordering.js';
import { StringUtil } from '../../../util/string.js';
import { fixed } from '../../../util/math.js';
import { makeRequestWithRetries } from '../../../util/request.js';
import fetch from 'node-fetch';

export class CafeOrderSession extends CafeDiscoverySession {
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
                            priceLevelId: '71'
                        },
                        amount:               '6.99',
                        options:              [],
                        lineItemInstructions: cartItem.specialInstructions ? [
                            {
                                label: '',
                                text:  cartItem.specialInstructions
                            }
                        ] : [],
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
            throw new Error('Order number mismatch! Timeout?');
        }

        this.#orderNumber = json.orderDetails.orderNumber;

        // These seem to be incremental for some reason, despite the naming and structure of the response. /shrug
        this.#orderTotalTax += Number(json.orderDetails.taxTotalAmount.amount);
        this.#orderTotalWithoutTax += Number(json.orderDetails.taxExcludedTotalAmount.amount);
        this.#orderTotalWithTax += Number(json.orderDetails.totalDueAmount.amount);
    }

    private async _populateCart(context: IOrderingContext, cart: ICartItem[]) {
        // Don't  parallelize, not sure what happens on the server if we do multiple concurrent adds
        for (const cartItem of cart) {
            await this._addItemToCart(cartItem);
        }
    }

    private async _getCardProcessorSiteToken(context: IOrderingContext) {
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
                    profitCenterId:       context.profitCenterId,
                    processButtonText:    'PROCESS',
                    terminalId:           context.onDemandTerminalId
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

    private async _submitOrder(token: string, cardData: ICardData) {
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

    // TODO: Figure out a way to break this up into two separate actions to reduce user-perceived latency.
    public async submitOrder(cart: ICartItem[]) {
        const orderingContext = await this._retrieveOrderingContextAsync();

        await this._populateCart(orderingContext, cart);

        const cardProcessorToken = await this._getCardProcessorSiteToken(orderingContext);
    }
}