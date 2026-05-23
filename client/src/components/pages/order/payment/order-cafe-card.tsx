import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../../../context/app.ts';
import { type ISnapshotCallbacks, useCartItemActions } from '../../../../hooks/cart-item-actions.tsx';
import { useCafePaymentFlow } from '../../../../hooks/cafe-payment-flow.tsx';
import type { IPaymentIdentity } from '../../../../hooks/payment-identity.ts';
import { calculatePrice } from '../../../../util/cart.ts';
import { getViewName } from '../../../../util/cafe.ts';
import type { ICartItemRecord } from '@msdining/common/models/cart';
import { OrderCafeItemsTable } from './order-cafe-items-table.tsx';
import { OrderCafeFooter } from './order-cafe-footer.tsx';

interface IOrderCafeCardProps {
    cafeId: string;
    items: ICartItemRecord[];
    paymentIdentity: IPaymentIdentity;
    isPayEnabled: boolean;
    snapshotCallbacks: ISnapshotCallbacks;
}

export const OrderCafeCard: React.FC<IOrderCafeCardProps> = ({
    cafeId,
    items,
    paymentIdentity,
    isPayEnabled,
    snapshotCallbacks,
}) => {
    const { viewsById } = useContext(ApplicationContext);
    const { onRemove, onEdit, onChangeQuantity } = useCartItemActions(snapshotCallbacks);
    const { handlePay, error, completionResult, isLocalBusy } = useCafePaymentFlow({
        cafeId,
        items,
        paymentIdentity,
        isPayEnabled,
    });

    const isCompleted = completionResult != null;

    const view = viewsById.get(cafeId);
    const cafeName = view != null
        ? getViewName({ view, showGroupName: true })
        : cafeId;

    const totalPrice = useMemo(
        () => items.reduce((sum, item) => sum + calculatePrice(
            item.menuItem,
            new Map(item.modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)])),
            item.quantity,
        ), 0),
        [items],
    );

    const totalQuantity = useMemo(
        () => items.reduce((sum, item) => sum + item.quantity, 0),
        [items],
    );

    const hasUnavailableItems = useMemo(
        () => items.some(item => !item.isAvailable),
        [items],
    );

    return (
        <div className="card">
            <div className="title">{cafeName}</div>
            <OrderCafeItemsTable
                items={items}
                readOnly={isCompleted}
                totalPrice={totalPrice}
                onRemove={onRemove}
                onEdit={onEdit}
                onChangeQuantity={onChangeQuantity}
            />
            {error && (
                <div className="order-page-cafe-error">
                    {error}
                </div>
            )}
            {hasUnavailableItems && (
                <div className="order-page-cafe-error">
                    Remove unavailable items from your cart before paying this cafe.
                </div>
            )}
            <OrderCafeFooter
                completionResult={completionResult}
                totalQuantity={totalQuantity}
                totalPrice={totalPrice}
                isPayEnabled={isPayEnabled}
                isLocalBusy={isLocalBusy}
                hasUnavailableItems={hasUnavailableItems}
                onPay={handlePay}
            />
        </div>
    );
};
