import { useCartStore } from '../../../store/zustand/cart.ts';
import { useCartHydrationStatus } from '../../../store/queries/cart.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import { MissingItemsTable } from './missing-items-table.tsx';

import './cart-hydration-view.css';

export const CartHydrationView = () => {
    const hydrationStatus = useCartHydrationStatus();
    const missingItems = useCartStore((state) => state.missingItemsByCafeId);
    const clearMissingItems = useCartStore((state) => state.clearMissingItems);

    if (hydrationStatus.isPending) {
        return (
            <div className="flex flex-justify-center cart-loading">
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

    const isError = hydrationStatus.isError;

    return (
        <div className="cart-hydration-error">
            <span>
                {
                    isError
                        ? 'We couldn\'t load your saved cart. Your items are still saved locally - you can try again, or clear them.'
                        : 'Found the following items in your cart history, but they are not currently available:'
                }
            </span>
            <MissingItemsTable/>
            <div className="flex cart-hydration-actions">
                {isError && <RetryButton onClick={hydrationStatus.retry}/>}
                <button className="default-container" onClick={clearMissingItems}>
                    {isError ? 'Clear saved cart' : 'Clear all missing items'}
                </button>
            </div>
        </div>
    );
};