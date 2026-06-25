import { ICartItemRecord, IPaymentCardInfo, SubmitOrderStage } from '@msdining/common/models/cart';
import type { IWaitTimeResponse } from '@msdining/common/models/http';
import type { IOrderItem } from '@msdining/common/models/order';
import { getTodayDateString } from '@msdining/common/util/date-util';
import { PhoneValidResult } from 'phone';
import { BuyOnDemandClient, JSON_HEADERS } from '../../../../shared/buy-ondemand/buy-ondemand-client.js';
import { ICafe } from '../../../../shared/models/cafe.js';
import { IOrderingContext } from '../../../../shared/models/cart.js';
import { SERVICE_ERROR_CODES, ServiceError } from '../../../../shared/rpc/errors.js';
import { createBuyOnDemandClient, getServices } from '../../../../shared/services/registry.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import {
    IEnhancedOrderItem,
    IOrderTotalPrice,
    IPickupConfig,
    ISiteStoreInfo,
    ORDER_TIMEZONE
} from '../../../models/ordering.js';
import { createStationSchedule, IBuyOnDemandStationSchedule } from '../../../util/schedule.js';
import { retrieveDailyOrderingContext } from '../../ordering/daily-order-context.js';
import { hashOrderItems, toChoicesByModifierId } from '../../util/order.js';
import { fetchWaitTimeWithCartItems } from '../buy-ondemand/wait-time.js';
import { IOrderSession } from './order-session.js';
import {
    BuyOnDemandAddToOrderResponseSchema,
    IBuyOnDemandAddItemToOrderRequest,
    IBuyOnDemandAddToCartRequest,
    IBuyOnDemandCartItem,
    IBuyOnDemandOrderDetails
} from '../../../models/buy-ondemand.js';
import { completeOrderAfterIframePaymentAsync } from '../buy-ondemand/ordering/complete-order.js';
import { throwError } from '../../../../shared/util/error.js';
import { buildPayConfig } from '../buy-ondemand/ordering/pay-config.js';
import { buildItemForCartAdd, buildReceiptItems } from '../buy-ondemand/ordering/cart-item.js';
import { retrieveIframeToken } from '../buy-ondemand/ordering/iframe-token.js';
import { sendPhoneConfirmationAfterOrderCompletion } from '../buy-ondemand/ordering/phone-confirmation.js';
import { logIframeData } from '../buy-ondemand/ordering/log-iframe-data.js';

const orderLog = getNamespaceLogger('Order');

const logOrderingDebugJson = (cafeName: string, label: string, data: unknown) => {
    orderLog.info(`{${cafeName}} ${label}: ${JSON.stringify(data, null, 2)}`);
};

const CURRENCY_DETAILS = {
    currencyDecimalDigits: '2',
    currencyCultureName:   'en-US',
    currencyCode:          'USD',
    currencySymbol:        '$',
} as const;

interface IClosePaymentPopupParams {
    alias: string;
    phoneData: PhoneValidResult;
    paymentToken: string;
    cardInfo: IPaymentCardInfo;
}

const enhanceOrderItems = async (orderItems: IOrderItem[]): Promise<Array<IEnhancedOrderItem>> => {
    // The cart is immutable once the session starts, so derive the wire ids here,
    // once. cartGuid is shared (uses the first item's id); each uniqueId is
    // distinct per line. The +1 keeps item 0's uniqueId distinct from cartGuid.
    const sessionStartTimeMs = Date.now();
    const cartGuid = `${orderItems[0]?.menuItemId}-${sessionStartTimeMs}`;

    return Promise.all(orderItems.map(async (orderItem, index) => {
        const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: orderItem.menuItemId });
        if (menuItem == null) {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `MenuItem not found for id ${orderItem.menuItemId}`);
        }

        const station = await getServices().data.station.retrieveStation({ stationId: menuItem.stationId });
        if (station == null) {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Station not found for id ${menuItem.stationId}`);
        }

        return {
            ...orderItem,
            menuItem,
            station,
            cartGuid,
            uniqueId: `${orderItem.menuItemId}-${sessionStartTimeMs + index + 1}`,
        } satisfies IEnhancedOrderItem;
    }));
}

export class CafeOrderSession implements IOrderSession {
    readonly #orderingContext;
    #orderId: string | null = null;
    #orderNumber: string | null = null;
    readonly #price: IOrderTotalPrice = {
        total: 0,
        subtotal: 0,
        tax: 0
    };
    #lastCompletedStage: SubmitOrderStage = SubmitOrderStage.notStarted;
    #cardProcessorToken: string = '';
    // The full orderDetails from the last POST /orders response,
    // echoed back to the close order endpoint as-is.
    #lastOrderDetails: IBuyOnDemandOrderDetails | null = null;

    #siteStoreInfo: ISiteStoreInfo = {};
    #sitePickUpConfig: IPickupConfig | null = null;

    readonly #orderItems: IEnhancedOrderItem[];
    readonly #itemsHash: string;
    readonly #stationScheduleById = new Map<string, IBuyOnDemandStationSchedule>();
    public readonly createdDateString = getTodayDateString();

    constructor(public client: BuyOnDemandClient, orderItems: IEnhancedOrderItem[], orderingContext: IOrderingContext) {
        this.#orderItems = orderItems;
        this.#itemsHash = hashOrderItems(orderItems);
        this.#orderingContext = orderingContext;
    }

    static async #initializeClientWithOrderingContext(cafe: ICafe): Promise<[BuyOnDemandClient, IOrderingContext]> {
        const client = await createBuyOnDemandClient(cafe, { enableHar: true, translateErrors: true });
        const orderingContext = await retrieveDailyOrderingContext(client);
        return [client, orderingContext];
    }

    public static async createAsync(cafe: ICafe, orderItems: IOrderItem[]): Promise<CafeOrderSession> {
        const [[client, orderingContext], enhancedOrderItems] = await Promise.all([
            this.#initializeClientWithOrderingContext(cafe),
            enhanceOrderItems(orderItems)
        ]);

        return new CafeOrderSession(client, enhancedOrderItems, orderingContext);
    }

    get lastCompletedStage() {
        return this.#lastCompletedStage;
    }

    get isReadyForPayment() {
        return this.createdDateString === getTodayDateString()
                && this.#lastCompletedStage === SubmitOrderStage.initializeCardProcessor;
    }

    get itemsHash() {
        return this.#itemsHash;
    }

    public get orderNumber() {
        return this.#orderNumber;
    }

    public get price(): Readonly<IOrderTotalPrice> {
        return this.#price;
    }

    public get orderId() {
        return this.#orderId;
    }

    public get cardProcessorToken() {
        return this.#cardProcessorToken;
    }

    public getCardProcessorUrl(iframeCssUrl?: string) {
        return this.#getCardProcessorUrl(this.#cardProcessorToken, iframeCssUrl);
    }

    isUsableForPaymentWithItems(items: Array<IOrderItem> | Array<ICartItemRecord> | string): boolean {
        if (!this.isReadyForPayment) {
            return false;
        }

        if (typeof items === 'string') {
            return this.#itemsHash === items;
        }

        return this.#itemsHash === hashOrderItems(items);
    }

    #buildItemForCartAdd(orderItem: IEnhancedOrderItem) {
        return buildItemForCartAdd({
            orderItem,
            orderingContext: this.#orderingContext,
            cafeConfig:      this.client.config,
            cartGuid:        orderItem.cartGuid,
            uniqueId:        orderItem.uniqueId,
        });
    }

    get #ordersUrl() {
        return `/order/${this.client.config.tenantId}/${this.client.config.contextId}/orders`;
    }

    // POST the first item, which creates the order.
    async #createOrderWithFirstItem(item: IBuyOnDemandCartItem, stationScheduleData: IBuyOnDemandStationSchedule) {
        const requestBody = {
            item,
            currencyDetails:    CURRENCY_DETAILS,
            schedule:           stationScheduleData.schedule,
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
                openScheduleExpression:  stationScheduleData.openScheduleExpression,
                closeScheduleExpression: stationScheduleData.closeScheduleExpression,
            },
            // The official site sends isMultiItem: false even for multi-item orders.
            isMultiItem:        false,
            scannedOrder:       false,
        } satisfies IBuyOnDemandAddToCartRequest;

        logOrderingDebugJson(this.client.cafe.name, 'Create-order request body (POST)', requestBody);

        return this.client.requestAsync(this.#ordersUrl, {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify(requestBody),
        });
    }

    async #addItemToExistingOrder(item: IBuyOnDemandCartItem, stationScheduleData: IBuyOnDemandStationSchedule) {
        if (!this.#orderId) {
            throw new Error('Order does not exist yet');
        }

        const requestBody = {
            // Yes, itemList is just one item.
            itemList:        item,
            currencyDetails: CURRENCY_DETAILS,
            schedule:        stationScheduleData.schedule,
            storePriceLevel: this.#orderingContext.storePriceLevel,
            scheduledDay:    0,
        } satisfies IBuyOnDemandAddItemToOrderRequest;

        logOrderingDebugJson(this.client.cafe.name, 'Add-to-existing-order request body (PUT)', requestBody);

        return this.client.requestAsync(`${this.#ordersUrl}/${this.#orderId}`, {
            method:  'PUT',
            headers: JSON_HEADERS,
            body:    JSON.stringify(requestBody),
        });
    }

    async #addItemToCart(orderItem: IEnhancedOrderItem) {
        const isNewOrder = this.#orderId == null;
        const response = await this.#sendAddItemRequest(orderItem);

        const json = await response.json();
        const { orderDetails } = BuyOnDemandAddToOrderResponseSchema.parse(json);
        logOrderingDebugJson(this.client.cafe.name, 'Add-to-cart response orderDetails', orderDetails);

        if (!orderDetails.orderId) {
            throw new Error(`Add-to-cart response did not include an order id for cafe ${this.client.cafe.name}`);
        }

        this.#orderNumber = orderDetails.orderNumber;
        this.#orderId = orderDetails.orderId;
        this.#lastOrderDetails = orderDetails;

        // The response totals are cumulative (the order grows with each POST/PUT),
        // so assign the latest values rather than accumulating.
        this.#price.tax = Number(orderDetails.taxTotalAmount.amount);
        this.#price.subtotal = Number(orderDetails.taxExcludedTotalAmount.amount);
        this.#price.total = Number(orderDetails.totalDueAmount.amount);

        let orderAction = 'appended to order';
        if (isNewOrder) {
            orderAction = 'created order';
        }

        orderLog.info(`{${this.client.cafe.name}} Item ${orderItem.menuItemId} ${orderAction} — orderId: ${orderDetails.orderId}, orderNumber: ${orderDetails.orderNumber}, runningTotal: $${this.#price.total.toFixed(2)}`);
    }

    async #sendAddItemRequest(orderItem: IEnhancedOrderItem) {
        const choicesByModifierId = toChoicesByModifierId(orderItem.modifiers);
        orderLog.info(`{${this.client.cafe.name}} Adding item "${orderItem.menuItem.name}" (id: ${orderItem.menuItemId}, qty: ${orderItem.quantity}, modifiers: ${orderItem.modifiers.length}, specialInstructions: ${orderItem.specialInstructions ?? 'none'}) to cart`);

        logOrderingDebugJson(this.client.cafe.name, 'Local cart item lookup', {
            cartItemId:        orderItem.menuItemId,
            quantity:          orderItem.quantity,
            selectedModifiers: [...choicesByModifierId].map(([modifierId, choiceIds]) => ({
                modifierId,
                choiceIds: [...choiceIds],
            })),
        });

        const stationScheduleData = this.#stationScheduleById.get(orderItem.station.id);
        if (stationScheduleData == null) {
            throw new Error(`No concept schedule data found for concept "${orderItem.station.id}" (${orderItem.station.name}). Available: ${[...this.#stationScheduleById.keys()].join(', ')}`);
        }

        const item = this.#buildItemForCartAdd(orderItem);

        if (this.#orderId == null) {
            return this.#createOrderWithFirstItem(item, stationScheduleData);
        }

        return this.#addItemToExistingOrder(item, stationScheduleData);
    }

    async #populateCart() {
        orderLog.info(`{${this.client.cafe.name}} Populating cart (${this.#orderItems.length} item(s))`);

        await this.#populateStationScheduleData();

        // Don't  parallelize, not sure what happens on the server if we do multiple concurrent adds
        for (const orderItem of this.#orderItems) {
            await this.#addItemToCart(orderItem);
        }
        orderLog.info(`{${this.client.cafe.name}} Cart population complete — total: $${this.#price.total.toFixed(2)}`);
    }

    async #retrieveScheduleForStation(stationId: string, dayOfWeek: number) {
        const station = await getServices().data.station.retrieveStation({ stationId });
        if (station == null) {
            throw new Error(`Cannot synthesize schedule: station "${stationId}" not found in DB`);
        }

        const hours = await getServices().data.station.getStationHours({ stationId });
        if (hours == null) {
            throw new Error(`Cannot synthesize schedule: no hours found for station "${stationId}" (${station.name}) on ${getTodayDateString()}`);
        }

        return createStationSchedule({
            conceptId:        stationId,
            menuId:           station.menuId,
            displayProfileId: this.client.config.displayProfileId,
            opensAtMinutes:   hours.opensAt,
            closesAtMinutes:  hours.closesAt,
            dayOfWeek,
        });
    }

    async #populateStationScheduleData() {
        orderLog.info(`{${this.client.cafe.name}} Synthesizing concept schedule from DB`);
        const dayOfWeek = new Date().getDay();

        const stationSchedulePromisesById = new Map<string, Promise<IBuyOnDemandStationSchedule>>();

        await Promise.all(this.#orderItems.map(async orderItem => {
            const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: orderItem.menuItemId });
            if (menuItem != null) {
                if (!stationSchedulePromisesById.has(menuItem.stationId)) {
                    stationSchedulePromisesById.set(menuItem.stationId, this.#retrieveScheduleForStation(menuItem.stationId, dayOfWeek));
                }
            }
        }));

        for (const [stationId, schedulePromise] of stationSchedulePromisesById.entries()) {
            // Doesn't need to be Promise.all'd because we are running them in parallel already
            const schedule = await schedulePromise;
            this.#stationScheduleById.set(stationId, schedule);
        }

        orderLog.info(`{${this.client.cafe.name}} Concept schedule synthesized (${stationSchedulePromisesById.size} concept(s))`);
        logOrderingDebugJson(this.client.cafe.name, 'Synthesized concept schedule', [...this.#stationScheduleById].map(([conceptId, data]) => ({
            conceptId,
            scheduleEntryCount:      data.schedule.length,
            openScheduleExpression:  data.openScheduleExpression,
            closeScheduleExpression: data.closeScheduleExpression,
        })));
    }

    async #getCardProcessorSiteToken(iframeCssUrl?: string) {
        if (!this.#orderNumber) {
            throw new Error('Order number is not set');
        }

        if (this.#price.subtotal === 0 || this.#price.total === 0) {
            throw new Error('Order totals cannot be zero');
        }

        return retrieveIframeToken({
            price: this.#price,
            client: this.client,
            orderingContext: this.#orderingContext,
            firstStationId: this.#stationScheduleById.keys().next().value,
            orderNumber: this.#orderNumber,
            lastOrderDetails: this.#lastOrderDetails,
            iframeCssUrl,
        });
    }

    #getCardProcessorUrl(token: string, iframeCssUrl?: string) {
        if (!this.client.config) {
            throw new Error('Config is required to get card processor url!');
        }

        const styleUrl = iframeCssUrl ?? `https://${this.client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.client.cafe.id}.buy-ondemand.com/false/false/false`;
        return `https://pay.rguest.com/pay-iframe-service/iFrame/tenants/${this.client.config.tenantId}/${this.#orderingContext.payClientId}?apiToken=${token}&submit=PROCESS&style=${encodeURIComponent(styleUrl)}&language=en&doVerify=true&version=3`;
    }

    async #sendPhoneConfirmation(phoneData: PhoneValidResult) {
        return sendPhoneConfirmationAfterOrderCompletion({
            client: this.client,
            orderId: this.#orderId ?? throwError('Order number is required to send phone confirmation'),
            phoneData,
        });
    }

    #logIframeDataInBackground(paymentToken: string, cardInfo: IPaymentCardInfo) {
        logIframeData({
            client: this.client,
            paymentToken,
            cardInfo,
            orderId: this.orderId ?? throwError('Order ID is required to log iframe data'),
            orderNumber: this.orderNumber ?? throwError('Order number is required to log iframe data'),
        }).catch(err => {
            orderLog.error(`Failed to log iFrame data for order ${this.#orderId}: ${err}`);
        });
    }

    async #sendOrderToKitchenAsync(
        { alias, phoneData, paymentToken, cardInfo }: IClosePaymentPopupParams,
        readyTime: IWaitTimeResponse,
    ) {
        if (this.#orderId == null) {
            throw new Error('Order ID is not set!');
        }

        if (this.#lastOrderDetails == null) {
            throw new Error('Order details are not set!');
        }

        const payConfig = buildPayConfig(this.#orderingContext);

        const builtCartItems = this.#orderItems.map(orderItem => this.#buildItemForCartAdd(orderItem));
        const receiptItems = buildReceiptItems(builtCartItems, this.#lastOrderDetails.lineItems);

        await completeOrderAfterIframePaymentAsync({
            client: this.client,
            alias,
            readyTime,
            payConfig,
            orderId: this.#orderId,
            orderNumber: this.#orderNumber ?? throwError('Order number is not set'),
            phoneData,
            orderingContext: this.#orderingContext,
            cardInfo,
            pickupConfig: this.#sitePickUpConfig ?? throwError('Pickup config is not set'),
            siteStoreInfo: this.#siteStoreInfo,
            price: this.price,
            receiptItems,
            firstStationId: this.#stationScheduleById.keys().next().value ?? throwError('No station schedule data found'),
            lastOrderDetails: this.#lastOrderDetails,
            cardProcessorToken: this.#cardProcessorToken,
            paymentToken
        });
    }

    #requireStage(requiredStage: SubmitOrderStage) {
        if (this.#lastCompletedStage !== requiredStage) {
            throw new Error(`Order is in the wrong stage! Expected: ${requiredStage}, actual: ${this.#lastCompletedStage}`);
        }
    }

    public async populateCart(): Promise<void> {
        this.#requireStage(SubmitOrderStage.notStarted);
        await this.#populateCart();
        this.#lastCompletedStage = SubmitOrderStage.addToCart;
    }

    /**
     * Prepares the order for iframe-based payment.
     * Populates the cart and gets the site token + iframe URL.
     * Does NOT submit payment — the frontend iframe handles that.
     */
    public async prepareForIframe(iframeCssUrl: string): Promise<{
        siteToken: string;
        iframeUrl: string;
        orderId: string;
        orderNumber: string
    }> {
        orderLog.info(`{${this.client.cafe.name}} Preparing for iframe payment`);
        this.#requireStage(SubmitOrderStage.addToCart);
        this.#cardProcessorToken = await this.#getCardProcessorSiteToken(iframeCssUrl);
        this.#lastCompletedStage = SubmitOrderStage.initializeCardProcessor;

        if (!this.#orderId || !this.#orderNumber) {
            throw new Error('Order ID or order number is not set after cart population');
        }

        return {
            siteToken:   this.#cardProcessorToken,
            iframeUrl:   this.#getCardProcessorUrl(this.#cardProcessorToken, iframeCssUrl),
            orderId:     this.#orderId,
            orderNumber: this.#orderNumber,
        };
    }

    retrieveWaitTime(): Promise<IWaitTimeResponse> {
        return fetchWaitTimeWithCartItems(
            this.client,
            this.#orderItems.map(orderItem => this.#buildItemForCartAdd(orderItem)),
        );
    }

    public async completeOrderAfterPaymentAsync({
        alias,
        phoneData,
        paymentToken,
        cardInfo,
    }: IClosePaymentPopupParams): Promise<IWaitTimeResponse> {
        orderLog.info(`{${this.client.cafe.name}} Completing order ${this.#orderId} with iframe token`);
        let waitTime: IWaitTimeResponse = { minTime: 0, maxTime: 0 };
        try {
            this.#requireStage(SubmitOrderStage.initializeCardProcessor);
            this.#lastCompletedStage = SubmitOrderStage.payment;

            this.#logIframeDataInBackground(paymentToken, cardInfo)

            const readyTime = await this.retrieveWaitTime();
            waitTime = readyTime;
            orderLog.info(`{${this.client.cafe.name}} Refreshed close-order wait time: ${readyTime.minTime}-${readyTime.maxTime} min`);

            orderLog.info(`{${this.client.cafe.name}} Closing order ${this.#orderId}`);
            await this.#sendOrderToKitchenAsync({
                alias,
                phoneData,
                paymentToken,
                cardInfo,
            }, readyTime);

            this.#lastCompletedStage = SubmitOrderStage.sentToKitchen;
            orderLog.info(`{${this.client.cafe.name}} Order closed, sending phone confirmation`);

            await this.#sendPhoneConfirmation(phoneData);

            this.#lastCompletedStage = SubmitOrderStage.complete;
            orderLog.info(`{${this.client.cafe.name}} Order ${this.#orderNumber} complete`);
        } finally {
            await this.client.harCapture?.writeToFile(this.client.cafe.id);
        }
        return waitTime;
    }
}
