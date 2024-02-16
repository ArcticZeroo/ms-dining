import { CartItemsByCafeId } from '../context/cart.ts';
import {
    IOrderCompletionData,
    IOrderCompletionResponse, ISerializedCartItem, ISerializedModifier,
    ISubmitOrderItems,
    SubmitOrderStage
} from '@msdining/common/dist/models/cart';
import { JSON_HEADERS, makeJsonRequest } from './request.ts';
import { isDuckType } from '@arcticzeroo/typeguard';
import { IPriceResponse } from '@msdining/common/dist/models/http.ts';

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

    public static async submitOrder(cart: CartItemsByCafeId): Promise<IOrderCompletionResponse> {
        console.log('Submitting order...', cart);

        const response: Array<[string, IOrderCompletionData]> = Array.from(cart.keys()).map(cafeId => {
            return [
                cafeId,
                {
                    lastCompletedStage: SubmitOrderStage.complete,
                    waitTimeMin:        Math.floor(Math.random() * 10).toString(),
                    waitTimeMax:        Math.floor((Math.random() * 10) + 10).toString(),
                    orderNumber:        Math.floor(Math.random() * 1000000).toString(),
                }
            ]
        });

        return Object.fromEntries(response);
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