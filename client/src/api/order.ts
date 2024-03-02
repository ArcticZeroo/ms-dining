import { isDuckType } from '@arcticzeroo/typeguard';
import {
    IOrderCompletionResponse,
    ISerializedCartItem,
    ISerializedModifier,
    ISubmitOrderItems
} from '@msdining/common/dist/models/cart';
import { IPriceResponse } from '@msdining/common/dist/models/http.ts';
import { CartItemsByCafeId } from '../context/cart.ts';
import { isValidOrderCompletionResponse } from '../util/order.ts';
import { JSON_HEADERS, makeJsonRequest } from './request.ts';
import { IPaymentInfo } from '../components/order/payment/payment-info-form.tsx';

export abstract class OrderingClient {
    private static _serializeCart(cart: CartItemsByCafeId): ISubmitOrderItems {
        const serializedItemsByCafeId: ISubmitOrderItems = {};

        for (const [cafeId, items] of cart) {
            const serializedItems: ISerializedCartItem[] = [];

            for (const item of items.values()) {
                const serializedModifiers: ISerializedModifier[] = Array.from(item.choicesByModifierId.entries()).map(([modifierId, choiceIds]) => ({
                    modifierId,
                    choiceIds: Array.from(choiceIds)
                }));

                const serializedItem: ISerializedCartItem = {
                    itemId:              item.itemId,
                    quantity:            item.quantity,
                    modifiers:           serializedModifiers,
                    specialInstructions: item.specialInstructions
                };

                serializedItems.push(serializedItem);
            }

            serializedItemsByCafeId[cafeId] = serializedItems;
        }

        return serializedItemsByCafeId;
    }

    public static async submitOrder(cart: CartItemsByCafeId, { phoneNumberWithCountryCode, alias, cardData }: IPaymentInfo): Promise<IOrderCompletionResponse> {
        console.log('Submitting order...', cart);

        const response = await makeJsonRequest({
            path: '/api/dining/order',
            options: {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify({
                    itemsByCafeId: this._serializeCart(cart),
                    phoneNumberWithCountryCode,
                    alias,
                    cardData
                })
            }
        });

        if (!isValidOrderCompletionResponse(new Set(cart.keys()), response)) {
            throw new Error('Invalid response format');
        }

        return response;
    }

    public static async retrievePrice(cart: CartItemsByCafeId) {
        const response = await makeJsonRequest({
            path:    '/api/dining/order/price',
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(this._serializeCart(cart))
            }
        });

        if (!isDuckType<IPriceResponse>(response, {
            totalTax:             'number',
            totalPriceWithoutTax: 'number',
            totalPriceWithTax:    'number',
        })) {
            throw new Error('Invalid response format');
        }

        return response;
    }
}