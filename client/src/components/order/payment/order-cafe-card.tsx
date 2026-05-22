import type { ICartItemRecord } from '@msdining/common/models/cart';
import type { ICompleteOrderResult, IOrderItem } from '@msdining/common/models/order';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { useCartItemActions, type ISnapshotCallbacks } from '../../../hooks/cart-item-actions.tsx';
import { usePopupCloserAlways, usePopupOpener } from '../../../hooks/popup.ts';
import type { IPaymentIdentity } from '../../../hooks/payment-identity.ts';
import { useCompleteOrderMutation, usePreparePaymentMutation } from '../../../store/queries/new-ordering.ts';
import { calculatePrice, formatPrice } from '../../../util/cart.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { formatWaitTime } from '../../../util/order.ts';
import { CartItemRow } from '../../order/cart/cart-item-row.tsx';
import { PaymentIframe, type IRguestPaymentResult } from '../../order/payment/payment-iframe.tsx';

const paymentPopupId = Symbol('order-cafe-payment');

const toOrderItem = (item: ICartItemRecord): IOrderItem => ({
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    modifiers:           item.modifiers,
    specialInstructions: item.specialInstructions ?? undefined,
});

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
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();
    const preparePayment = usePreparePaymentMutation();
    const completeOrder = useCompleteOrderMutation();
    const [error, setError] = useState<string>();
    const [completionResult, setCompletionResult] = useState<ICompleteOrderResult>();

    const { onRemove, onEdit, onChangeQuantity } = useCartItemActions(snapshotCallbacks);
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

    const isLocalBusy = preparePayment.isPending || completeOrder.isPending;

    const handlePay = useCallback(async () => {
        if (!isPayEnabled || isLocalBusy) {
            return;
        }

        setError(undefined);

        try {
            const prepareResult = await preparePayment.mutateAsync({
                cafeId,
                items: items.map(toOrderItem),
            });

            const onPaymentComplete = async (paymentResult: IRguestPaymentResult) => {
                try {
                    const result = await completeOrder.mutateAsync({
                        pendingOrderId: prepareResult.pendingOrderId,
                        paymentToken:   paymentResult.token,
                        cardInfo:       paymentResult.cardInfo,
                        alias:          paymentIdentity.alias,
                        phoneNumber:    paymentIdentity.phoneNumber,
                    });

                    setCompletionResult(result);
                    setError(undefined);
                    closePopup();
                } catch (completeError) {
                    setError(getErrorMessage(completeError, 'Failed to complete order'));
                    throw completeError;
                }
            };

            openPopup({
                id:   paymentPopupId,
                body: <PaymentIframe
                    iframeUrl={prepareResult.iframeUrl}
                    onPaymentComplete={onPaymentComplete}
                    onPaymentError={setError}
                    onClose={closePopup}
                />,
            });
        } catch (prepareError) {
            setError(getErrorMessage(prepareError, 'Failed to prepare payment'));
        }
    }, [cafeId, closePopup, completeOrder, isPayEnabled, isLocalBusy, items, openPopup, paymentIdentity, preparePayment]);

    return (
        <div className="card dark-blue order-page-cafe">
            <div className="order-page-cafe-header">
                <div className="title">{cafeName}</div>
            </div>
            <table className="cart-contents">
                <tbody>
                    {items.map((item) => (
                        <CartItemRow
                            key={item.id}
                            item={item}
                            showFullDetails={true}
                            readOnly={isCompleted}
                            onRemove={() => onRemove(item)}
                            onEdit={() => onEdit(item)}
                            onChangeQuantity={(quantity) => onChangeQuantity(item, quantity)}
                        />
                    ))}
                    <tr>
                        <td colSpan={2}></td>
                        <td>Subtotal</td>
                        <td className="price">{formatPrice(totalPrice)}</td>
                    </tr>
                    <tr>
                        <td colSpan={2}></td>
                        <td>Tax</td>
                        <td className="price">Calculated at checkout</td>
                    </tr>
                </tbody>
            </table>
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
            <div className="order-page-cafe-footer">
                {completionResult != null ? (
                    <div className="order-page-cafe-completed">
                        <span className="material-symbols-outlined">check_circle</span>
                        <span>
                            Order #{completionResult.buyOnDemandOrderNumber}
                            {' — '}
                            {formatWaitTime(completionResult.waitTimeMin, completionResult.waitTimeMax)} wait
                        </span>
                    </div>
                ) : (
                    <>
                        <span>{totalQuantity} item{totalQuantity === 1 ? '' : 's'}</span>
                        <button
                            className="default-container"
                            disabled={!isPayEnabled || isLocalBusy || hasUnavailableItems}
                            onClick={handlePay}
                        >
                            Pay {formatPrice(totalPrice)}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
