import { CartItemsByCafeId } from '../context/cart.ts';
import { IOrderCompletionData, IOrderCompletionResponse, SubmitOrderStage } from '@msdining/common/dist/models/cart';

export abstract class OrderingClient {
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
}