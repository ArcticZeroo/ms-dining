import React, { useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../../../context/app.ts';
import { type ISnapshotCallbacks, useCartItemActions } from '../../../../hooks/cart-item-actions.tsx';
import { useCafePaymentFlow } from '../../../../hooks/cafe-payment-flow.tsx';
import { calculatePrice } from '../../../../util/cart.ts';
import { getViewName } from '../../../../util/cafe.ts';
import { getViewMenuUrlDirect } from '../../../../util/link.ts';
import type { ICafeAvailability, ICartItemRecord } from '@msdining/common/models/cart';
import type { ISynthesisFlags } from '../../../../api/ordering.ts';
import { OrderCafeItemsTable } from './order-cafe-items-table.tsx';
import { OrderCafeFooter } from './order-cafe-footer/order-cafe-footer.tsx';
import { CafeAvailabilityWarning } from './cafe-availability-warning.tsx';
import { classNames } from '../../../../util/react.js';
import { CurrentCafeContext } from '../../../../context/menu-item.js';
import { CafeViewType } from '../../../../models/cafe.js';

interface IOrderCafeCardProps {
    cafeId: string;
    items: ICartItemRecord[];
    availability: ICafeAvailability;
    snapshotCallbacks: ISnapshotCallbacks;
    synthesisFlags?: ISynthesisFlags;
}

export const OrderCafeCard: React.FC<IOrderCafeCardProps> = ({
    cafeId,
    items,
    availability,
    snapshotCallbacks,
    synthesisFlags,
}) => {
    const { viewsById } = useContext(ApplicationContext);
    const { onRemove, onEdit, onChangeQuantity } = useCartItemActions(snapshotCallbacks);
    const { handlePay, paymentState } = useCafePaymentFlow({
        cafeId,
        items,
        synthesisFlags,
    });

    const view = viewsById.get(cafeId);
    if (view == null || view.type === CafeViewType.group) {
        throw new Error(`Missing cafe view for cafeId: ${cafeId}`);
    }

    const cafeName = getViewName({ view, showGroupName: true });

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

    const isReadOnly = paymentState.status !== 'ready-to-pay';

    return (
        <CurrentCafeContext.Provider value={view.value}>
            <div className={classNames('card order-cafe-card', hasUnavailableItems && 'error')}>
                <div className="flex-col">
                    <div className="title text-center">
                        <Link to={getViewMenuUrlDirect(view)}>{cafeName}</Link>
                    </div>
                    <CafeAvailabilityWarning availability={availability}/>
                    <OrderCafeItemsTable
                        readOnly={isReadOnly}
                        hasUnavailableItems={hasUnavailableItems}
                        items={items}
                        onRemove={onRemove}
                        onEdit={onEdit}
                        onChangeQuantity={onChangeQuantity}
                    />
                </div>
                <OrderCafeFooter
                    paymentState={paymentState}
                    totalQuantity={totalQuantity}
                    totalPrice={totalPrice}
                    hasUnavailableItems={hasUnavailableItems}
                    onPay={handlePay}
                />
            </div>
        </CurrentCafeContext.Provider>
    );
};
