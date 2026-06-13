import { randomUUID } from 'node:crypto';
import type { IWaitTimeResponse } from '@msdining/common/models/http';
import { ICartItemRecord, SubmitOrderStage } from '@msdining/common/models/cart';
import type { IOrderItem } from '@msdining/common/models/order';
import type { IOrderSession } from './order-session.js';
import type { ICafe } from '../../../../shared/models/cafe.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import { getTodayDateString } from '@msdining/common/util/date-util';
import { hashOrderItems } from '../../util/order.js';
import { getServices } from '../../../../shared/services/registry.js';

const fakeLog = getNamespaceLogger('FakeOrder');

const FAKE_TAX_RATE = 0.10;

const computeSubtotal = async (orderItems: IOrderItem[]): Promise<number> => {
    const menuItems = await Promise.all(orderItems.map(async (orderItem) => {
        return await getServices().data.menuItem.retrieveMenuItem({ id: orderItem.menuItemId });
    }));
    return menuItems.reduce((subtotal, menuItem) => subtotal + (menuItem?.price ?? 0), 0);
};

/**
 * A fake CafeOrderSession that skips all Buy On Demand HTTP calls.
 * Used with FAKE_ORDERING=true to test the full ordering UI flow.
 */
export class FakeCafeOrderSession implements IOrderSession {
    #orderId: string | null = null;
    #orderNumber: string | null = null;
    #lastCompletedStage: string = SubmitOrderStage.notStarted;
    #cardProcessorToken = '';
    #subtotal = 0;
    readonly #cafe: ICafe;
    readonly #orderItems: IOrderItem[];
    readonly #itemsHash: string;
    readonly createdDateString = getTodayDateString();

    get client() {
        return {
            cafe: {
                id: this.#cafe.id,
            },
            async refreshLogin() {
                // no-op
            },
        };
    }

    constructor(cafe: ICafe, orderItems: IOrderItem[]) {
        this.#cafe = cafe;
        this.#orderItems = orderItems;
        this.#itemsHash = hashOrderItems(orderItems);
    }

    get orderId() {
        return this.#orderId;
    }

    get orderNumber() {
        return this.#orderNumber;
    }

    get orderTotalWithoutTax() {
        return this.#subtotal;
    }

    get orderTotalTax() {
        return Math.round(this.#subtotal * FAKE_TAX_RATE * 100) / 100;
    }

    get orderTotalWithTax() {
        return Math.round((this.#subtotal + this.orderTotalTax) * 100) / 100;
    }

    get lastCompletedStage() {
        return this.#lastCompletedStage;
    }

    get isReadyForPayment() {
        return true;
    }

    get itemsHash() {
        return this.#itemsHash;
    }

    get cardProcessorToken() {
        return this.#cardProcessorToken;
    }

    async retrieveWaitTime(): Promise<IWaitTimeResponse> {
        return {
            minTime: 5,
            maxTime: 10
        };
    }

    isUsableForPaymentWithItems(items: Array<IOrderItem> | Array<ICartItemRecord> | string): boolean {
        if (typeof items === 'string') {
            return items === this.#itemsHash;
        }

        return this.#itemsHash === hashOrderItems(items);
    }

    async populateCart(): Promise<void> {
        this.#orderId = `fake-${randomUUID().slice(0, 8)}`;
        this.#orderNumber = `F${Math.floor(Math.random() * 9000) + 1000}`;
        this.#subtotal = await computeSubtotal(this.#orderItems);
        fakeLog.info(`{${this.#cafe.name}} Fake session created — orderId: ${this.#orderId}, orderNumber: ${this.#orderNumber}, subtotal: ${this.#subtotal}`);
    }

    async prepareForIframe(): Promise<void> {
        this.#cardProcessorToken = `fake-token-${randomUUID().slice(0, 8)}`;
        this.#lastCompletedStage = SubmitOrderStage.initializeCardProcessor;
        fakeLog.info(`{${this.#cafe.name}} Fake iframe prepared — token: ${this.#cardProcessorToken}`);
    }

    getCardProcessorUrl(): string {
        return '/fake-payment.html';
    }

    async completeOrderAfterPaymentAsync(): Promise<IWaitTimeResponse> {
        this.#lastCompletedStage = SubmitOrderStage.complete;
        fakeLog.info(`{${this.#cafe.name}} Fake order ${this.#orderNumber} completed`);
        return { minTime: 5, maxTime: 10 };
    }
}
