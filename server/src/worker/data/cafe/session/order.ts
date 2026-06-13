import { ICartItemRecord, IPaymentCardInfo, ISerializedModifier, SubmitOrderStage } from '@msdining/common/models/cart';
import type { IWaitTimeResponse } from '@msdining/common/models/http';
import type { IOrderItem } from '@msdining/common/models/order';
import { getTodayDateString } from '@msdining/common/util/date-util';
import hat from 'hat';
import { PhoneValidResult } from 'phone';
import { z } from 'zod';
import { BuyOnDemandClient, JSON_HEADERS } from '../../../../shared/buy-ondemand/buy-ondemand-client.js';
import { MEAL_PERIOD } from '../../../../shared/constants/enum.js';
import { IOrderLineItem, } from '../../../../shared/models/buyondemand/cart.js';
import { ICafe, IMenuItemBase } from '../../../../shared/models/cafe.js';
import { IOrderingContext } from '../../../../shared/models/cart.js';
import { SERVICE_ERROR_CODES, ServiceError } from '../../../../shared/rpc/errors.js';
import { createBuyOnDemandClient, getServices } from '../../../../shared/services/registry.js';
import { IStationRecord } from '../../../../shared/services/station.js';
import { getNamespaceLogger, logError } from '../../../../shared/util/log.js';
import { fixed } from '../../../../shared/util/math.js';
import { StringUtil } from '../../../../shared/util/string.js';
import { asRecord, isNonEmptyArray } from '../../../../shared/util/typeguard.js';
import { IPickUpConfig, ISiteStoreInfo } from '../../../models/ordering.js';
import { createStationSchedule, IBuyOnDemandStationSchedule } from '../../../util/schedule.js';
import { retrieveDailyOrderingContext } from '../../ordering/daily-order-context.js';
import { buildStoreInfo, hashOrderItems } from '../../util/order.js';
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

const orderLog = getNamespaceLogger('Order');
const ORDER_TIMEZONE = 'PST8PDT';

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
const toLocalIsoOffset = (date: Date, timeZone: string = ORDER_TIMEZONE): string => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year:         'numeric', month: '2-digit', day: '2-digit',
        hour:         '2-digit', minute: '2-digit', second: '2-digit',
        hour12:       false, fractionalSecondDigits: 3,
        timeZoneName: 'longOffset',
    }).formatToParts(date);

    const find = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find(part => part.type === type)?.value ?? '';

    // Intl's longOffset is `GMT-07:00` (or `GMT` for UTC). Strip the `GMT`
    // prefix; treat bare `GMT` as `+00:00`.
    const tzPart = find('timeZoneName');
    const offset = tzPart === 'GMT' ? '+00:00' : tzPart.slice(3);
    // Intl renders midnight as hour=24; normalize back to 00.
    const hour = find('hour') === '24' ? '00' : find('hour');

    return `${find('year')}-${find('month')}-${find('day')}T${hour}:${find('minute')}:${find('second')}.${find('fractionalSecond')}${offset}`;
};

const formatReceiptDateTime = (date: Date) => {
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
    #orderTotalWithoutTax: number = 0;
    #orderTotalTax: number = 0;
    #orderTotalWithTax: number = 0;
    #lastCompletedStage: SubmitOrderStage = SubmitOrderStage.notStarted;
    #cardProcessorToken: string = '';
    // The full orderDetails from the last POST /orders response,
    // echoed back to the close order endpoint as-is.
    #lastOrderDetails: IBuyOnDemandOrderDetails | null = null;

    #siteStoreInfo: ISiteStoreInfo = {};
    #sitePickUpConfig: IPickUpConfig | null = null;

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

    isUsableForPaymentWithItems(items: Array<IOrderItem> | Array<ICartItemRecord> | string): boolean {
        if (!this.isReadyForPayment) {
            return false;
        }

        if (typeof items === 'string') {
            return this.#itemsHash === items;
        }

        return this.#itemsHash === hashOrderItems(items);
    }

    /**
     * Build a pay config from known constants and ordering context data,
     * avoiding the POST /sites/{contextId}/{displayProfileId} call.
     *
     * Constants are sourced from observed HAR responses across multiple cafes.
     * Dynamic values (terminalId, employeeId, etc.) come from the ordering
     * context which is already populated at this point.
     */
    #getPayConfig() {
        return {
            pay:                 { clientId: this.#orderingContext.payClientId },
            displayOptions:      {
                'timezone':                       ORDER_TIMEZONE,
                'currency/currencyCode':          'USD',
                'currency/currencySymbol':        '$',
                'currency/currencyDecimalDigits': '2',
                'currency/currencyCultureName':   'en-US',
                'useIgOrderApi':                  'true',
                'useIgPosApi':                    'false',
                'voidReasonId':                   '11',
                'onDemandTerminalId':             this.#orderingContext.onDemandTerminalId,
                'onDemandEmployeeId':             this.#orderingContext.onDemandEmployeeId,
                'profit-center-id':               this.#orderingContext.profitCenterId,
                'check-type':                     this.#orderingContext.checkTypeId ?? '1',
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
            checkTypeId:         this.#orderingContext.checkTypeId ?? '1',
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
        };
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
        this.#orderTotalTax += Number(orderDetails.taxTotalAmount.amount);
        this.#orderTotalWithoutTax += Number(orderDetails.taxExcludedTotalAmount.amount);
        this.#orderTotalWithTax += Number(orderDetails.totalDueAmount.amount);

        orderLog.info(`{${this.client.cafe.name}} Item ${orderItem.menuItemId} added — orderId: ${orderDetails.orderId}, orderNumber: ${orderDetails.orderNumber}, runningTotal: $${this.#orderTotalWithTax.toFixed(2)}`);

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
        orderLog.info(`{${this.client.cafe.name}} Cart population complete — total: $${this.#orderTotalWithTax.toFixed(2)}`);
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
                    taxAmount:             this.#orderTotalTax.toFixed(2),
                    invoiceId:             this.#orderNumber,
                    billDate,
                    userCurrentDate:       nowString,
                    currencyUnit:          'USD',
                    description:           `Order ${this.#orderNumber}`,
                    transactionAmount:     this.#orderTotalWithTax.toFixed(2),
                    remainingTipAmount:    '0.00',
                    tipAmount:             '0.00',
                    style:                 iframeCssUrl ?? `https://${this.client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.client.cafe.id}.buy-ondemand.com/false/false/false`,
                    multiPaymentAmount:    fixed(this.#orderTotalWithTax, 2),
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
        { alias, phoneData, paymentToken, cardInfo }: IClosePaymentPopupParams,
        readyTime: IWaitTimeResponse,
    ) {
        if (this.#orderId == null) {
            throw new Error('Order ID is not set!');
        }

        if (this.#lastOrderDetails == null) {
            throw new Error('Order details are not set!');
        }

        const payConfig = this.#getPayConfig();

        const now = new Date();
        const nowString = toLocalIsoOffset(now);
        const closedTime = now.toISOString();
        const receiptDateTime = formatReceiptDateTime(now);
        const additionalSpecialInstructions = payConfig.specialInstructions?.additionalSpecialInstructions || [];
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
        const browserStoreInfo = buildStoreInfo({
            ...this.#siteStoreInfo,
            businessContextId: this.client.config.contextId,
            tenantId:          this.client.config.tenantId,
            storeInfoId:       this.client.config.storeId,
            storeName:         this.client.config.externalName,
        });
        const browserStoreInfoOptions = asRecord(browserStoreInfo.storeInfoOptions) ?? {};
        const taxAmountValue = this.orderTotalTax.toFixed(2);
        const taxClassList = this.orderTotalTax > 0
            ? [{ amount: `$${taxAmountValue}`, amountValue: taxAmountValue }]
            : [];
        const selectedSMSCountry = phoneData.countryCode === '+1'
            ? { value: 'US', label: 'United States', phoneCode: '1' }
            : undefined;
        const orderMessage = `Your order will be ready for pickup at ${this.client.config.externalName} in about ${readyTime.minTime} to ${readyTime.maxTime} minutes\n\n`;
        const closeOrderDetails = {
            ...this.#lastOrderDetails,
            properties: {
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

        const receiptItems = this.#orderItems.map((cartItem, index) => ({
            ...this.#buildItemForCartAdd(cartItem),
            languageCode: 'en',
            lineItemId:   this.#lastOrderDetails?.lineItems[index]?.lineItemId,
        } satisfies IBuyOnDemandReceiptItem));

        logOrderingDebugJson(this.client.cafe.name, 'Close-order identity summary', {
            tenantId:          this.client.config.tenantId,
            contextId:         this.client.config.contextId,
            displayProfileId:  this.client.config.displayProfileId,
            orderId:           this.#orderId,
            orderNumber:       this.#orderNumber,
            conceptIds:        [...this.#stationScheduleById.keys()],
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
                body:    JSON.stringify({
                    amHereConfig:                     {
                        isCurbsidePickup: false,
                        lateTolerance:    5,
                        origin:           `https://${this.client.cafe.id}.buy-ondemand.com`
                    },
                    authorizedAmount:                 this.orderTotalWithTax.toString(),
                    calorieTotal:                     {
                        baseCalorie: 0,
                        maxCalorie:  0
                    },
                    capacitySuggestionPerformed:      false,
                    conceptId:                        this.#stationScheduleById.keys().next().value,
                    contextId:                        this.client.config.contextId,
                    currencyDetails,
                    currencyUnit:                     'USD',
                    customCardCodeMapping:            false,
                    customerAddress:                  [],
                    cyberSourcePaymentData:           null,
                    cyberSourceTransactionData:       null,
                    deliveryProperties,
                    discountInfo:                     [],
                    displayProfileId:                 this.client.config.displayProfileId,
                    emailInfo:                        {
                        ...(payConfig.emailReceipt || {}),
                        customerAddress: [],
                    },
                    engageAccrualEnabled:             false,
                    engagePromotionAppliedPromotions: [],
                    engagePromotionCardNumber:        null,
                    engagePromotionLastName:          '',
                    firstName:                        alias,
                    giftCardSaleDataMap:              {},
                    graceCompletionTime:              false,
                    gratuityBreakupConfigEnabled:     false,
                    igOrderStatusConfig:              {},
                    igSettings:                       payConfig.displayOptions || {},
                    isGaPaymentAvailable:             false,
                    itemCountdown:                    {},
                    kitchenContextId:                 null,
                    lastName:                         '',
                    locizeConfig:                     {
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
                    loyaltyGuestInfo:                 {},
                    loyaltyPayment:                   false,
                    mealPeriodId:                     String(MEAL_PERIOD.lunch),
                    mobileNumber:                     phoneData.phoneNumber,
                    mobileNumberCountryCode:          phoneData.countryCode,
                    multiPassEnabled:                 false,
                    notifyGuestOnFailure:             false,
                    order:                            closeOrderDetails,
                    orderGuid:                        null,
                    orderVersion:                     1,
                    paymentType:                      null,
                    processPaymentAsExternalPayment:  false,
                    profileId:                        this.client.config.displayProfileId,
                    profitCenterId:                   this.#orderingContext.profitCenterId,
                    profitCenterName:                 this.#orderingContext.profitCenterName,
                    recallCheck:                      false,
                    receiptInfo:                      {
                        orderData:                           closeOrderDetails,
                        showConceptNameInEmailReceipt:       false,
                        showConceptNameInTextReceipt:        false,
                        showConceptNameInPrintReceipt:       false,
                        taxBreakupEnabled:                   payConfig.taxBreakupEnabled,
                        taxClassList,
                        hideVATInReceipts:                   payConfig.hideVATInReceipts,
                        items:                               receiptItems,
                        tip:                                 0,
                        tipAmount:                           0,
                        etfEnabled:                          true,
                        dateTime:                            'en',
                        storePriceLevel:                     this.#orderingContext.storePriceLevel,
                        currencyDetails,
                        deliveryEnabled:                     false,
                        readyTime:                           readyTimeDetails,
                        deliveryProperties,
                        vatEntries:                          [],
                        taxIdentificationNumber:             '',
                        accountNumberLabelText:              'GA account number',
                        engageLoyaltyAccountNumberLabelText: 'Account number',
                        engageMemberAccountNumberLabelText:  'Account number',
                        gaAccountInfoList:                   [],
                        deliveryConfirmationText:            this.#sitePickUpConfig?.defaultConfirmationText ?? 'Thank you!',
                        orderPlacedTime:                     closedTime,
                        receiptDate:                         receiptDateTime.receiptDate,
                        receiptTime:                         receiptDateTime.receiptTime,
                        timeZone:                            ORDER_TIMEZONE,
                        terminalId:                          this.#orderingContext.onDemandTerminalId,
                        checkNumber:                         this.#orderNumber,
                        selectedSMSCountry,
                        mobileNumber:                        phoneData.phoneNumber,
                        scheduledDay:                        0,
                        hideAllPrices:                       payConfig.hideAllPrices,
                        hideZeroPrice:                       payConfig.hideZeroPrice,
                        complimentaryPayment:                false,
                        isPayLater:                          false,
                        payLaterConfig:                      {},
                        discountValues:                      [],
                        franceFiscalConfig:                  { isEnabled: false },
                        birConfig:                           browserStoreInfoOptions.birConfig,
                        multiPassEnabled:                    false,
                        // Intentional typo.
                        receipientName:              `${alias} `,
                        orderMessage,
                        dateTimeInReceipt:           receiptDateTime.dateTimeInReceipt,
                        timezoneOffsetMinutes:       receiptDateTime.timezoneOffsetMinutes,
                        printDateTime:               receiptDateTime.printDateTime,
                        closedTime,
                        gratuityWithLabelArray:      false,
                        serviceAmountWithLabelArray: false,
                        displayProfileId:            this.client.config.displayProfileId,
                        engagePayment:               { engageAccountInfoList: [] },
                        engageLoyaltyPayment:        { engageLoyaltyAccountInfoList: [] },
                    },
                    saleTransactionData:              null,
                    scannedItemOrder:                 false,
                    scheduledDay:                     0,
                    shouldRefundOnFailure:            false,
                    siteId:                           this.client.config.contextId,
                    storePriceLevel:                  this.#orderingContext.storePriceLevel,
                    stripeTransactionData:            null,
                    subtotal:                         this.orderTotalWithTax.toString(),
                    tenantId:                         this.client.config.tenantId,
                    terminalId:                       this.#orderingContext.onDemandTerminalId,
                    textReceiptConfig:                {
                        textMessageWithReceiptLink: false
                    },
                    tipAmount:                        0,
                    tipPercent:                       0,
                    tokenizedData:                    {
                        paymentDetails: {
                            taxAmount:             this.orderTotalTax.toString(),
                            invoiceId:             this.#orderNumber,
                            billDate:              this.#lastOrderDetails.created ?? nowString,
                            userCurrentDate:       nowString,
                            currencyUnit:          'USD',
                            description:           `Order ${this.#orderNumber}`,
                            transactionAmount:     this.orderTotalWithTax.toString(),
                            remainingTipAmount:    '0.00',
                            tipAmount:             '0.00',
                            style:                 `https://${this.client.cafe.id}.buy-ondemand.com/api/payOptions/getIFrameCss/en/${this.client.cafe.id}.buy-ondemand.com/false/false/false`,
                            multiPaymentAmount:    fixed(this.orderTotalWithTax, 2),
                            isWindCave:            false,
                            isCyberSource:         false,
                            isCyberSourceWallets:  false,
                            language:              'en',
                            apiToken:              this.#cardProcessorToken,
                            payTenantId:           this.client.config.tenantId,
                            previousTransactionId: null,
                            accountNumberMasked:   cardInfo.accountNumberMasked,
                            cardIssuer:            cardInfo.cardIssuer,
                            expirationYearMonth:   cardInfo.expirationYearMonth,
                            cardHolderName:        cardInfo.cardHolderName,
                            postalCode:            cardInfo.postalCode,
                        },
                        saveCardFlag:   false,
                        token:          paymentToken
                    },
                    previousTransactionId:            null,
                    previousTransactionTokenInfo:     null,
                    use24HrTimeFormat:                false,
                    useIgPosApi:                      false,
                    walletPaymentData:                null,
                    walletSaleTransactionData:        null
                })
            },
        );
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

    /**
     * Completes an order using a payment token received from the rguest iframe.
     * Closes the order and sends phone confirmation.
     */
    public async completeOrderAfterIframePayment({
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
