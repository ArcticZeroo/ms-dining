import { useValueNotifier } from '../../../hooks/events.ts';
import { CartHydrationContext } from '../../../context/cart.ts';
import { ISerializedCartItemWithName } from '../../../models/cart.ts';
import { useContext } from 'react';
import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { MissingItemsTable } from './missing-items-table.tsx';

export const CartHydrationView = () => {
    const cartHydrationNotifier = useContext(CartHydrationContext);
    const cartHydration = useValueNotifier(cartHydrationNotifier);
    const missingItems: Map<string, Array<ISerializedCartItemWithName>> = cartHydration.missingItemsByCafeId ?? new Map<string, Array<ISerializedCartItemWithName>>();

    if (cartHydration.stage === PromiseStage.running) {
        return (
            <div className="flex flex-center default-margin-bottom">
                <span className="material-symbols-outlined loading-spinner-custom">
                    hourglass_empty
                </span>
                <span>
                    Loading items from your last session...
                </span>
            </div>
        );
    }

    if (missingItems.size === 0) {
        return;
    }

    const onClearMissingItems = () => {
        cartHydrationNotifier.value = { stage: PromiseStage.notRun };
    }

    return (
        <div className="cart-hydration-error flex flex-col">
            <span>
                Found the following items in your cart history, but they are no longer available:
            </span>
            <MissingItemsTable/>
            <button className="default-container" onClick={onClearMissingItems}>
                Clear all missing items
            </button>
        </div>
    );
};