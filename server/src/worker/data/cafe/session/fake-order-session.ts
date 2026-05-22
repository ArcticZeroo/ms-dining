import { randomUUID } from 'node:crypto';
import type { IWaitTimeResponse } from '@msdining/common/models/http';
import type { ICartItem } from '@msdining/common/models/cart';
import { SubmitOrderStage } from '@msdining/common/models/cart';
import type { IOrderSession } from './order-session.js';
import type { ICafe } from '../../../../shared/models/cafe.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';

const fakeLog = getNamespaceLogger('FakeOrder');

/**
 * A fake CafeOrderSession that skips all Buy On Demand HTTP calls.
 * Used with FAKE_ORDERING=true to test the full ordering UI flow.
 */
export class FakeCafeOrderSession implements IOrderSession {
    #orderId: string | null = null;
    #orderNumber: string | null = null;
    #lastCompletedStage: string = SubmitOrderStage.notStarted;
    #cardProcessorToken = '';
    readonly #cafe: ICafe;
    readonly #cartItems: ICartItem[];

    readonly client = {
        async refreshLogin() {
            // no-op
        },
    };

    constructor(cafe: ICafe, cartItems: ICartItem[]) {
        this.#cafe = cafe;
        this.#cartItems = cartItems;
    }

    get orderId() {
        return this.#orderId;
    }

    get orderNumber() {
        return this.#orderNumber;
    }

    get orderTotalWithoutTax() {
        return 9.99;
    }

    get orderTotalTax() {
        return 1.01;
    }

    get orderTotalWithTax() {
        return 11.00;
    }

    get lastCompletedStage() {
        return this.#lastCompletedStage;
    }

    get cardProcessorToken() {
        return this.#cardProcessorToken;
    }

    get rawCartItemsForWaitTime(): readonly unknown[] {
        return this.#cartItems.map(item => ({
            kitchenVideoId: item.itemId,
            quantity:        item.quantity,
        }));
    }

    async populateCart(): Promise<void> {
        this.#orderId = `fake-${randomUUID().slice(0, 8)}`;
        this.#orderNumber = `F${Math.floor(Math.random() * 9000) + 1000}`;
        fakeLog.info(`{${this.#cafe.name}} Fake session created — orderId: ${this.#orderId}, orderNumber: ${this.#orderNumber}`);
    }

    async prepareForIframe(_iframeCssUrl: string): Promise<void> {
        this.#cardProcessorToken = `fake-token-${randomUUID().slice(0, 8)}`;
        this.#lastCompletedStage = SubmitOrderStage.initializeCardProcessor;
        fakeLog.info(`{${this.#cafe.name}} Fake iframe prepared — token: ${this.#cardProcessorToken}`);
    }

    getCardProcessorUrl(_iframeCssUrl?: string): string {
        return '/fake-payment.html';
    }

    async completeOrderAfterIframePayment(): Promise<IWaitTimeResponse> {
        this.#lastCompletedStage = SubmitOrderStage.complete;
        fakeLog.info(`{${this.#cafe.name}} Fake order ${this.#orderNumber} completed`);
        return { minTime: 5, maxTime: 10 };
    }
}
