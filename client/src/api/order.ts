import { IMenuItemBase } from '@msdining/common/models/cafe';
import {
    ICompleteOrderRequest,
    ICompleteOrderResponse,
    IPrepareCartResponse,
    IPreparePaymentResponse,
    ISerializedCartItem,
    ISerializedModifier,
    ISubmitOrderItems
} from '@msdining/common/models/cart';
import { CartItemsByCafeId } from '../context/cart.ts';
import { JSON_HEADERS, makeJsonRequest } from './request.ts';
import { ICartItemWithMetadata, IHydratedCartData, ISerializedCartItemWithName } from '../models/cart.ts';
import { getRandomId } from '../util/id.ts';
import { calculatePrice } from '../util/cart.ts';

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

    public static async prepareCart(cart: CartItemsByCafeId): Promise<IPrepareCartResponse> {
        return await makeJsonRequest<IPrepareCartResponse>({
            path:    '/api/dining/order/prepare/cart',
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    itemsByCafeId: this._serializeCart(cart),
                })
            }
        });
    }

    public static async preparePayment(orderId: string): Promise<IPreparePaymentResponse> {
        return await makeJsonRequest<IPreparePaymentResponse>({
            path:    '/api/dining/order/prepare/payment',
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({ orderId })
            }
        });
    }

    public static async completeOrder(params: ICompleteOrderRequest): Promise<ICompleteOrderResponse> {
        return await makeJsonRequest<ICompleteOrderResponse>({
            path:    '/api/dining/order/complete',
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(params)
            }
        });
    }

    public static async hydrateCart(serializedCart: Record<string /*cafeId*/, Array<ISerializedCartItemWithName>>): Promise<IHydratedCartData> {
        const serializedRequestBody = Object.fromEntries(
            Object.entries(serializedCart).map(([cafeId, items]) => [
                cafeId,
                items.map(item => item.itemId)
            ])
        );

        const response = await makeJsonRequest({
            path:    '/api/dining/order/hydrate',
            options: {
                method: 'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(serializedRequestBody),
            }
        });

        const data = response as Record<string, Array<IMenuItemBase>>;

        const foundMenuItemsByCafeId = new Map<string /*cafeId*/, Map<string /*menuItemId*/, IMenuItemBase>>();
        for (const [cafeId, items] of Object.entries(data)) {
            const itemsForCafeById = new Map<string, IMenuItemBase>();

            for (const menuItem of items) {
                itemsForCafeById.set(menuItem.id, menuItem);
            }

            foundMenuItemsByCafeId.set(cafeId, itemsForCafeById);
        }

        const hydratedData: IHydratedCartData = {
            foundItemsByCafeId:   new Map<string, Map<string, ICartItemWithMetadata>>(),
            missingItemsByCafeId: new Map<string, Array<ISerializedCartItemWithName>>()
        };

        for (const [cafeId, serializedItems] of Object.entries(serializedCart)) {
            const itemsForCafeById = new Map<string, ICartItemWithMetadata>();

            for (const serializedItem of serializedItems) {
                const foundItem = foundMenuItemsByCafeId.get(cafeId)?.get(serializedItem.itemId);

                if (!foundItem) {
                    if (!hydratedData.missingItemsByCafeId.has(cafeId)) {
                        hydratedData.missingItemsByCafeId.set(cafeId, []);
                    }

                    hydratedData.missingItemsByCafeId.get(cafeId)!.push(serializedItem);
                    continue;
                }

                const deserializedModifiers: Map<string, Set<string>> = new Map(serializedItem.modifiers.map(modifier => [
                    modifier.modifierId,
                    new Set(modifier.choiceIds)
                ]));

                const cartItem: ICartItemWithMetadata = {
                    id:                  getRandomId(),
                    cafeId:              cafeId,
                    price:               calculatePrice(foundItem, deserializedModifiers),
                    itemId:              foundItem.id,
                    quantity:            serializedItem.quantity,
                    choicesByModifierId: deserializedModifiers,
                    specialInstructions: serializedItem.specialInstructions,
                    associatedItem:      foundItem
                };

                itemsForCafeById.set(cartItem.id, cartItem);
            }

            hydratedData.foundItemsByCafeId.set(cafeId, itemsForCafeById);
        }

        return hydratedData;
    }
}