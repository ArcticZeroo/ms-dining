import { ICartItemRecord, IPaymentCardInfo, ISerializedModifier, SubmitOrderStage } from '@msdining/common/models/cart';
import type { IWaitTimeResponse } from '@msdining/common/models/http';
import type { IOrderItem } from '@msdining/common/models/order';
import { getTodayDateString } from '@msdining/common/util/date-util';
import hat from 'hat';
import { PhoneValidResult } from 'phone';
import { z } from 'zod';
import { BuyOnDemandClient, JSON_HEADERS } from '../../../../shared/buy-ondemand/buy-ondemand-client.js';
import { IOrderLineItem, } from '../../../../shared/models/buyondemand/cart.js';
import { ICafe, IMenuItemBase } from '../../../../shared/models/cafe.js';
import { IOrderingContext } from '../../../../shared/models/cart.js';
import { SERVICE_ERROR_CODES, ServiceError } from '../../../../shared/rpc/errors.js';
import { createBuyOnDemandClient, getServices } from '../../../../shared/services/registry.js';
import { IStationRecord } from '../../../../shared/services/station.js';
import { getNamespaceLogger, logError } from '../../../../shared/util/log.js';
import { fixed } from '../../../../shared/util/math.js';
import { StringUtil } from '../../../../shared/util/string.js';
import { isNonEmptyArray } from '../../../../shared/util/typeguard.js';
import {
    IOrderTotalPrice,
    IPayConfig,
    IPickupConfig,
    ISiteStoreInfo,
    ORDER_TIMEZONE
} from '../../../models/ordering.js';
import { createStationSchedule, IBuyOnDemandStationSchedule } from '../../../util/schedule.js';
import { retrieveDailyOrderingContext } from '../../ordering/daily-order-context.js';
import { hashOrderItems, toLocalIsoOffset } from '../../util/order.js';
import { fetchWaitTimeWithCartItems } from '../buy-ondemand/wait-time.js';
import { IOrderSession } from './order-session.js';
import { Nullable } from '@msdining/common/models/util';
import {
    BuyOnDemandAddToOrderResponseSchema,
    BuyOnDemandAtLeastOneModifier,
    BuyOnDemandSpecialInstructionsOrEmpty,
    IBuyOnDemandAddToCartRequest,
    IBuyOnDemandCartItem,
    IBuyOnDemandModifier,
    IBuyOnDemandOrderDetails, IBuyOnDemandReceiptItem
} from '../../../models/buy-ondemand.js';
import { completeOrderAfterIframePaymentAsync } from '../buy-ondemand/ordering/complete-order.js';
import { throwError } from '../../../../shared/util/error.js';

const orderLog = getNamespaceLogger('Order');

const logOrderingDebugJson = (cafeName: string, label: string, data: unknown) => {
    orderLog.info(`{${cafeName}} ${label}: ${JSON.stringify(data, null, 2)}`);
};

const toChoicesByModifierId = (modifiers: Array<ISerializedModifier>): Map<string, Set<string>> =>
    new Map(modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)]));

interface IClosePaymentPopupParams {
    alias: string;
    phoneData: PhoneValidResult;
    paymentToken: string;
    cardInfo: IPaymentCardInfo;
}

interface IEnhancedOrderItem extends IOrderItem {
    menuItem: IMenuItemBase;
    station: IStationRecord;
}

const enhanceOrderItems = async (orderItems: IOrderItem[]): Promise<Array<IEnhancedOrderItem>> => {
    return Promise.all(orderItems.map(async orderItem => {
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
            station
        } satisfies IEnhancedOrderItem;
    }));
}

/**
 * Build a pay config from known constants and ordering context data,
 * avoiding the POST /sites/{contextId}/{displayProfileId} call.
 *
 * Constants are sourced from observed HAR responses across multiple cafes.
 * Dynamic values (terminalId, employeeId, etc.) come from the ordering
 * context which is already populated at this point.
 */
const buildPayConfig = (orderingContext: IOrderingContext): IPayConfig => ({
    pay:                 { clientId: orderingContext.payClientId },
    displayOptions:      {
        'timezone':                       ORDER_TIMEZONE,
        'currency/currencyCode':          'USD',
        'currency/currencySymbol':        '$',
        'currency/currencyDecimalDigits': '2',
        'currency/currencyCultureName':   'en-US',
        'useIgOrderApi':                  'true',
        'useIgPosApi':                    'false',
        'voidReasonId':                   '11',
        'onDemandTerminalId':             orderingContext.onDemandTerminalId,
        'onDemandEmployeeId':             orderingContext.onDemandEmployeeId,
        'profit-center-id':               orderingContext.profitCenterId,
        'check-type':                     orderingContext.checkTypeId ?? '1',
        'isSmsEnabled':                   'true',
        'isMobileNumberRequired':         'true',
        'isProfileValid':                 'true',
        'name-capture/isOptional':        'false',
        'name-capture/lastInitialOnly':   'true',
    },
    pickUpConfig:        {
        featureEnabled: true,
        kitchenText:    'PICK-UP',
        buttonText:     'PICK-UP',
    },
    emailReceipt:        {
        featureEnabled:          true,
        overrideFromStoreConfig: false,
    },
    checkTypeId:         orderingContext.checkTypeId ?? '1',
    taxBreakupEnabled:   false,
    hideVATInReceipts:   false,
    hideAllPrices:       false,
    hideZeroPrice:       false,
    specialInstructions: {
        headerText:                    'Special instructions',
        characterLimit:                250,
        featureEnabled:                true,
        instructionText:               'Any allergies or requests?',
        additionalSpecialInstructions: [
            {
                characterLimit:  250,
                instructionText: 'Any allergies or requests?',
                kitchenText:     '',
            }
        ],
    },
});

export class CafeOrderSession implements IOrderSession {
    #orderingContext: IOrderingContext = {
        onDemandTerminalId: '',
        onDemandEmployeeId: '',
        profitCenterId:     '',
        profitCenterName:   '',
        storePriceLevel:    '',
        payClientId:        '',
        fullPickupConfig:   {},
        fullSiteStoreInfo:  {}
    };
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
    readonly #lineItemsById = new Map<string, IOrderLineItem>();
    readonly #stationScheduleById = new Map<string, IBuyOnDemandStationSchedule>();
    public readonly createdDateString = getTodayDateString();

    constructor(public client: BuyOnDemandClient, orderItems: IEnhancedOrderItem[]) {
        this.#orderItems = orderItems;
        this.#itemsHash = hashOrderItems(orderItems);
    }

    public static async createAsync(cafe: ICafe, orderItems: IOrderItem[]): Promise<CafeOrderSession> {
        orderLog.info(`{${cafe.name}} Creating order session with ${orderItems.length} item(s)`);
        const [client, enhancedOrderItems] = await Promise.all([
            createBuyOnDemandClient(cafe, { enableHar: true, translateErrors: true }),
            enhanceOrderItems(orderItems)
        ]);

        orderLog.info(`{${cafe.name}} BuyOnDemand client created (login + config complete)`);
        return new CafeOrderSession(client, enhancedOrderItems);
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
        return this._getCardProcessorUrl(this.#cardProcessorToken, iframeCssUrl);
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

    #convertModifierChoicesToBuyOnDemand(choicesByModifierId: Map<string, Set<string>>, localMenuItem: IMenuItemBase): Array<IBuyOnDemandModifier> {
        const modifiersById = new Map(localMenuItem.modifiers.map(modifier => [modifier.id, modifier]));

        const modifiers: IBuyOnDemandModifier[] = [];

        for (const [modifierId, choiceIds] of choicesByModifierId) {
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

    #buildItemForCartAdd({ quantity, menuItem, station, modifiers: orderItemModifiers, specialInstructions }: IEnhancedOrderItem): IBuyOnDemandCartItem {
        const amount = menuItem.price.toFixed(2);
        const receiptText = menuItem.receiptText ?? menuItem.name;

        const choicesByModifierId = toChoicesByModifierId(orderItemModifiers);
        const modifiers = this.#convertModifierChoicesToBuyOnDemand(choicesByModifierId, menuItem);
        const modifierTotal = modifiers.reduce((sum, modifier) => sum + Number(modifier.amount), 0);

        const cartItemId = hat();
        const cartGuid = `${menuItem.id}-${Date.now()}`;

        return {
            id:                    menuItem.id,
            contextId:             this.client.config.contextId,
            tenantId:              this.client.config.tenantId,
            itemId:                menuItem.id,
            name:                  menuItem.name,
            displayText:           menuItem.name,
            count:                 quantity,
            quantity:              quantity,
            amount,
            price:                 { currencyUnit: 'USD', amount },
            menuId:                station.menuId,
            conceptId:             station.id,
            conceptName:           station.name,
            holdAndFire:           false,
            hasModifiers:          modifiers.length > 0,
            modifierTotal,
            mealPeriodId:          null,
            uniqueId:              cartGuid,
            cartItemId,
            menuPriceLevelId:      this.#orderingContext.storePriceLevel,
            menuPriceLevelApplied: false,
            receiptText,
            kpText:                receiptText,
            kitchenDisplayText:    receiptText,
            // Constants from observed HAR responses
            isDeleted:               false,
            isActive:                false,
            isSoldByWeight:          false,
            tareWeight:              0,
            isDiscountable:          true,
            allowPriceOverride:      true,
            isTaxIncluded:           false,
            taxClasses:              [],
            kitchenVideoCategoryId:  0,
            kitchenCookTimeSeconds:  0,
            skus:                    [],
            itemType:                'ITEM',
            itemImages:              [],
            isAvailableToGuests:     true,
            isPreselectedToGuests:   false,
            tagNames:                [],
            tagIds:                  [],
            substituteItemId:        '',
            isSubstituteItem:        false,
            sequence:                0,
            description:             menuItem.description ?? '',
            longDescription:         menuItem.description ?? '',
            options:                 [],
            attributes:              [],
            choiceGroupsUnavailable: false,
            selectedModifiers:       this.#getModifiersForCartItem(modifiers),
            lineItemInstructions:    this.#getSpecialInstructionsForCartItem(specialInstructions),
            properties:              {
                cartGuid,
                scannedItem:  false,
                priceLevelId: this.#orderingContext.storePriceLevel
            }
        };
    }

    #getModifiersForCartItem(modifiers: IBuyOnDemandModifier[]): BuyOnDemandAtLeastOneModifier | undefined {
        if (isNonEmptyArray(modifiers)) {
            return modifiers;
        }

        return undefined;
    }

    #getSpecialInstructionsForCartItem(specialInstructions: Nullable<string>): BuyOnDemandSpecialInstructionsOrEmpty {
        if (!specialInstructions) {
            return [];
        }

        return [{
            label: '',
            text:  specialInstructions
        }];
    }

    async #addItemToCart(orderItem: IEnhancedOrderItem) {
        const choicesByModifierId = toChoicesByModifierId(orderItem.modifiers);
        orderLog.info(`{${this.client.cafe.name}} Adding item "${orderItem.menuItem.name}" (id: ${orderItem.menuItemId}, qty: ${orderItem.quantity}, modifiers: ${orderItem.modifiers.length}, specialInstructions: ${orderItem.specialInstructions ?? 'none'}) to cart`);

        logOrderingDebugJson(this.client.cafe.name, 'Local cart item lookup', {
            cartItemId:        orderItem.menuItemId,
            quantity:          orderItem.quantity,
            stationId:         orderItem.station.id,
            stationName:       orderItem.station.name,
            stationMenuId:     orderItem.station.menuId,
            localMenuItemId:   orderItem.menuItem.id,
            localMenuItemName: orderItem.menuItem.name,
            selectedModifiers: [...choicesByModifierId].map(([modifierId, choiceIds]) => ({
                modifierId,
                choiceIds: [...choiceIds],
            })),
        });

        const conceptData = this.#stationScheduleById.get(orderItem.station.id);
        if (conceptData == null) {
            throw new Error(`No concept schedule data found for concept "${orderItem.station.id}" (${orderItem.station.name}). Available: ${[...this.#stationScheduleById.keys()].join(', ')}`);
        }

        const cartItem = this.#buildItemForCartAdd(orderItem);

        const requestBody = {
            item:               cartItem,
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
        } satisfies IBuyOnDemandAddToCartRequest;

        logOrderingDebugJson(this.client.cafe.name, 'Add-to-cart request body', requestBody);

        const response = await this.client.requestAsync(
            `/order/${this.client.config.tenantId}/${this.client.config.contextId}/orders`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(requestBody),
            }
        );

        const json = await response.json();
        const { orderDetails } = BuyOnDemandAddToOrderResponseSchema.parse(json);
        logOrderingDebugJson(this.client.cafe.name, 'Add-to-cart response orderDetails', orderDetails);

        // Seems like the cart might be fake. We appear to get a new order number every time we add an item?
        this.#orderNumber = orderDetails.orderNumber;
        this.#orderId = orderDetails.orderId;
        this.#lastOrderDetails = orderDetails;

        // These seem to be incremental for some reason, despite the naming and structure of the response. /shrug
        this.#price.tax += Number(orderDetails.taxTotalAmount.amount);
        this.#price.subtotal += Number(orderDetails.taxExcludedTotalAmount.amount);
        this.#price.total += Number(orderDetails.totalDueAmount.amount);

        orderLog.info(`{${this.client.cafe.name}} Item ${orderItem.menuItemId} added — orderId: ${orderDetails.orderId}, orderNumber: ${orderDetails.orderNumber}, runningTotal: $${this.#price.total.toFixed(2)}`);

        for (const lineItem of orderDetails.lineItems) {
            this.#lineItemsById.set(lineItem.lineItemId, lineItem);
        }
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

    private async _getCardProcessorSiteToken(iframeCssUrl?: string) {
        if (StringUtil.isNullOrWhitespace(this.#orderNumber)) {
            throw new Error('Order number is not set');
        }

        if (this.#price.subtotal === 0 || this.#price.total === 0) {
            throw new Error('Order totals cannot be zero');
        }

        const billDate = this.#lastOrderDetails?.created ?? toLocalIsoOffset(new Date());
        const nowString = toLocalIsoOffset(new Date());

        const response = await this.client.requestAsync(`/iFrame/token/${this.client.config.tenantId}`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    taxAmount:             this.#price.tax.toFixed(2),
                    invoiceId:             this.#orderNumber,
                    billDate,
                    userCurrentDate:       nowString,
                    currencyUnit:          'USD',
                    description:           `Order ${this.#orderNumber}`,
                    transactionAmount:     this.#price.total.toFixed(2),
                    remainingTipAmount:    '0.00',
                    tipAmount:             '0.00',
                    style:                 iframeCssUrl ?? `https://${this.client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.client.cafe.id}.buy-ondemand.com/false/false/false`,
                    multiPaymentAmount:    fixed(this.#price.total, 2),
                    isWindCave:            false,
                    isCyberSource:         false,
                    isCyberSourceWallets:  false,
                    language:              'en',
                    previousTransactionId: null,
                    contextId:             this.client.config.contextId,
                    profileId:             this.client.config.displayProfileId,
                    // Not sure if the specific conceptId matters here, picking the first one seems to work though
                    conceptId:             this.#stationScheduleById.keys().next().value,
                    profitCenterId:        this.#orderingContext.profitCenterId,
                    processButtonText:     'PROCESS',
                    terminalId:            this.#orderingContext.onDemandTerminalId
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

    async #sendPhoneConfirmation(phoneData: PhoneValidResult) {
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

        const receiptItems = this.#orderItems.map((cartItem, index) => ({
            ...this.#buildItemForCartAdd(cartItem),
            languageCode: 'en',
            lineItemId:   this.#lastOrderDetails?.lineItems[index]?.lineItemId,
        } satisfies IBuyOnDemandReceiptItem));

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

    async #requireStage(requiredStage: SubmitOrderStage, callback: () => Promise<void>): Promise<void> {
        if (this.#lastCompletedStage !== requiredStage) {
            throw new Error(`Order is in the wrong stage! Expected: ${requiredStage}, actual: ${this.#lastCompletedStage}`);
        }

        orderLog.info(`{${this.client.cafe.name}} Running stage after ${requiredStage} — fetching ordering context`);
        this.#orderingContext = await retrieveDailyOrderingContext(this.client);
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
        await this.#requireStage(SubmitOrderStage.notStarted, async () => {
            await this.#populateCart();
            this.#lastCompletedStage = SubmitOrderStage.addToCart;
        });
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
        await this.#requireStage(SubmitOrderStage.addToCart, async () => {
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
            await this.#requireStage(SubmitOrderStage.initializeCardProcessor, async () => {
                this.#lastCompletedStage = SubmitOrderStage.payment;

                try {
                    await this._logIframeData(paymentToken, cardInfo);
                } catch (err) {
                    logError('Unable to report iframe data (non-fatal, continuing anyway):', err);
                }

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

                this.#lastCompletedStage = SubmitOrderStage.closeOrder;
                orderLog.info(`{${this.client.cafe.name}} Order closed, sending phone confirmation`);

                await this.#sendPhoneConfirmation(phoneData);

                this.#lastCompletedStage = SubmitOrderStage.complete;
                orderLog.info(`{${this.client.cafe.name}} Order ${this.#orderNumber} complete`);
            });
        } finally {
            await this.client.harCapture?.writeToFile(this.client.cafe.id);
        }
        return waitTime;
    }
}
