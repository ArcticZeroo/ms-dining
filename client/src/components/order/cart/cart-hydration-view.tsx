import { PromiseStage } from '@arcticzeroo/react-promise-hook';
import { useContext } from 'react';
import { CartHydrationContext } from '../../../context/cart.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { ISerializedCartItemWithName } from '../../../models/cart.ts';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { MissingItemsTable } from './missing-items-table.tsx';

export const CartHydrationView = () => {
    const cartHydrationNotifier = useContext(CartHydrationContext);
    const cartHydration = useValueNotifier(cartHydrationNotifier);
    const missingItems: Map<string, Array<ISerializedCartItemWithName>> = cartHydration.missingItemsByCafeId ?? new Map<string, Array<ISerializedCartItemWithName>>();

    if (cartHydration.stage === PromiseStage.running) {
        return (
            <div className="flex flex-center cart-loading">
                <HourglassLoadingSpinner/>
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
        <div className="cart-hydration-error">
            <span>
                Found the following items in your cart history, but they are not currently available:
            </span>
            <MissingItemsTable/>
            <button className="default-container" onClick={onClearMissingItems}>
                Clear all missing items
            </button>
        </div>
    );
};