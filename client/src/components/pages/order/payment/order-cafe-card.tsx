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
import { classNames } from '../../../../util/react.js';

interface IOrderCafeCardProps {
    cafeId: string;
    items: ICartItemRecord[];
    paymentIdentity: IPaymentIdentity;
    isIdentityValid: boolean;
    snapshotCallbacks: ISnapshotCallbacks;
}

export const OrderCafeCard: React.FC<IOrderCafeCardProps> = ({
    cafeId,
    items,
    paymentIdentity,
    isIdentityValid,
    snapshotCallbacks,
}) => {
    const { viewsById } = useContext(ApplicationContext);
    const { onRemove, onEdit, onChangeQuantity } = useCartItemActions(snapshotCallbacks);
    const { handlePay, error, completionResult, isLocalBusy } = useCafePaymentFlow({
        cafeId,
        items,
        paymentIdentity,
        isIdentityValid,
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
        <div className={classNames('card', hasUnavailableItems && 'error')}>
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
                <div>
                    {error}
                </div>
            )}
            {hasUnavailableItems && (
                <div>
                    Remove unavailable items from your cart before paying this cafe.
                </div>
            )}
            <OrderCafeFooter
                completionResult={completionResult}
                totalQuantity={totalQuantity}
                totalPrice={totalPrice}
                isIdentityValid={isIdentityValid}
                isLocalBusy={isLocalBusy}
                hasUnavailableItems={hasUnavailableItems}
                onPay={handlePay}
            />
        </div>
    );
};
