import type { ICartItemRecord } from '@msdining/common/models/cart';
import type { IOrderItem } from '@msdining/common/models/order';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { InternalSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { usePopupCloserAlways, usePopupOpener } from '../../../hooks/popup.ts';
import {
    useCompleteOrderMutation,
    usePreparePaymentMutation,
} from '../../../store/queries/new-ordering.ts';
import { useCartQuery } from '../../../store/queries/server-cart.ts';
import { useServerCartItems } from '../../../store/zustand/server-cart.ts';
import { calculatePrice, formatPrice } from '../../../util/cart.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { EmptyCartNotice } from '../../notice/empty-cart-notice.tsx';
import { OnlineOrderingExperimental } from '../../notice/online-ordering-experimental.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';
import {
    PaymentIframe,
    type IRguestPaymentResult,
} from '../../order/payment/payment-iframe.tsx';
import {
    PaymentInfoForm,
    type IPaymentInfoFormState,
    type IPaymentInfoFormValue,
} from '../../order/payment/payment-info-form.tsx';
import { CartItemRow } from '../../order/cart/cart-item-row.tsx';

import './order-page.css';

const paymentPopupId = Symbol('order-payment-popup');

const toOrderItem = (item: ICartItemRecord): IOrderItem => ({
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    modifiers:           item.modifiers,
    specialInstructions: item.specialInstructions ?? undefined,
});

interface ICompletedCafeSummary {
    cafeId: string;
    buyOnDemandOrderNumber: string;
}

export const OrderPageBody = () => {
    const { viewsById, viewsInOrder } = useContext(ApplicationContext);
    const cartQuery = useCartQuery();
    const serverCartItems = useServerCartItems();
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();
    const preparePayment = usePreparePaymentMutation();
    const completeOrder = useCompleteOrderMutation();

    const [snapshotItems, setSnapshotItems] = useState<ICartItemRecord[]>(() => serverCartItems);
    const [hasSnapshottedCart, setHasSnapshottedCart] = useState(serverCartItems.length > 0);
    const [paymentInfo, setPaymentInfo] = useState<IPaymentInfoFormValue>({
        alias:       InternalSettings.alias.value,
        phoneNumber: InternalSettings.phoneNumber.value,
    });
    const [paymentInfoState, setPaymentInfoState] = useState<IPaymentInfoFormState>({
        ...paymentInfo,
        isValid: false,
    });
    const [completedCafes, setCompletedCafes] = useState<ICompletedCafeSummary[]>([]);
    const [cafeErrors, setCafeErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (hasSnapshottedCart || cartQuery.isPending || cartQuery.isError) {
            return;
        }

        setSnapshotItems(serverCartItems);
        setHasSnapshottedCart(true);
    }, [cartQuery.isError, cartQuery.isPending, hasSnapshottedCart, serverCartItems]);

    const cafeOrderById = useMemo(
        () => new Map(viewsInOrder.map((view, index) => [view.value.id, index])),
        [viewsInOrder],
    );

    const groupedItems = useMemo(() => {
        const byCafe = new Map<string, ICartItemRecord[]>();
        for (const item of snapshotItems) {
            const cafeId = item.menuItem.cafeId;
            const existing = byCafe.get(cafeId);
            if (existing) {
                existing.push(item);
            } else {
                byCafe.set(cafeId, [item]);
            }
        }

        return [...byCafe.entries()]
            .map(([cafeId, items]) => ({ cafeId, items }))
            .sort((left, right) => (cafeOrderById.get(left.cafeId) ?? Number.MAX_SAFE_INTEGER) - (cafeOrderById.get(right.cafeId) ?? Number.MAX_SAFE_INTEGER));
    }, [cafeOrderById, snapshotItems]);

    const isBusy = preparePayment.isPending || completeOrder.isPending;

    const onPayCafe = useCallback(async (cafeId: string, items: ICartItemRecord[]) => {
        if (isBusy) {
            return;
        }

        setCafeErrors(previous => {
            const next = { ...previous };
            delete next[cafeId];
            return next;
        });

        try {
            const prepareResult = await preparePayment.mutateAsync({
                cafeId,
                items: items.map(toOrderItem),
            });

            const onPaymentComplete = async (paymentResult: IRguestPaymentResult) => {
                if (!paymentInfoState.isValid || paymentInfoState.phoneNumberWithCountryCode == null) {
                    setCafeErrors(previous => ({
                        ...previous,
                        [cafeId]: 'Please fill in your alias and phone number.',
                    }));
                    return;
                }

                InternalSettings.alias.value = paymentInfo.alias;
                InternalSettings.phoneNumber.value = paymentInfoState.phoneNumberWithCountryCode;

                try {
                    const completionResult = await completeOrder.mutateAsync({
                        pendingOrderId: prepareResult.pendingOrderId,
                        paymentToken:   paymentResult.token,
                        cardInfo:       paymentResult.cardInfo,
                        alias:          paymentInfo.alias,
                        phoneNumber:    paymentInfoState.phoneNumberWithCountryCode,
                    });

                    setSnapshotItems(previous => previous.filter(item => item.menuItem.cafeId !== cafeId));
                    setCompletedCafes(previous => [
                        ...previous.filter(item => item.cafeId !== cafeId),
                        {
                            cafeId,
                            buyOnDemandOrderNumber: completionResult.buyOnDemandOrderNumber,
                        },
                    ]);
                    setCafeErrors(previous => {
                        const next = { ...previous };
                        delete next[cafeId];
                        return next;
                    });
                    closePopup();
                } catch (error) {
                    const message = getErrorMessage(error, 'Failed to complete order');
                    setCafeErrors(previous => ({
                        ...previous,
                        [cafeId]: message,
                    }));
                    throw error;
                }
            };

            openPopup({
                id:   paymentPopupId,
                body: <PaymentIframe
                    iframeUrl={prepareResult.iframeUrl}
                    onPaymentComplete={onPaymentComplete}
                    onPaymentError={(error) => {
                        setCafeErrors(previous => ({
                            ...previous,
                            [cafeId]: error,
                        }));
                    }}
                    onClose={closePopup}
                />,
            });
        } catch (error) {
            setCafeErrors(previous => ({
                ...previous,
                [cafeId]: getErrorMessage(error, 'Failed to prepare payment'),
            }));
        }
    }, [closePopup, completeOrder, isBusy, openPopup, paymentInfo, paymentInfoState, preparePayment]);

    if (!hasSnapshottedCart && cartQuery.isPending) {
        return (
            <div id="order-checkout" className="flex-col">
                <div className="flex flex-justify-center">
                    <HourglassLoadingSpinner/>
                    <span>Loading your cart...</span>
                </div>
            </div>
        );
    }

    if (cartQuery.isError && !hasSnapshottedCart) {
        return (
            <div id="order-checkout" className="flex-col">
                <div className="card error">
                    {getErrorMessage(cartQuery.error, 'Failed to load your cart.')}
                </div>
            </div>
        );
    }

    if (groupedItems.length === 0 && completedCafes.length === 0) {
        return <EmptyCartNotice/>;
    }

    return (
        <div id="order-checkout" className="flex-col">
            <OnlineOrderingExperimental/>
            <PaymentInfoForm
                isPrepareStarted={isBusy}
                isCartReady={groupedItems.length > 0}
                value={paymentInfo}
                onValueChanged={setPaymentInfo}
                onValidationChanged={setPaymentInfoState}
                hideSubmit={true}
            />
            {completedCafes.length > 0 && (
                <div className="card dark-blue order-page-completed-list">
                    <div className="title">Completed Cafes</div>
                    {completedCafes.map((completedCafe) => {
                        const view = viewsById.get(completedCafe.cafeId);
                        const cafeName = view == null
                            ? completedCafe.cafeId
                            : getViewName({ view, showGroupName: true });

                        return (
                            <div key={completedCafe.cafeId} className="order-page-completed-badge">
                                <span className="material-symbols-outlined">check_circle</span>
                                <span>
                                    {cafeName} paid — Order #{completedCafe.buyOnDemandOrderNumber}
                                </span>
                            </div>
                        );
                    })}
                    <div className="order-page-completed-link">
                        <Link to="/order/done" className="default-container default-button">
                            View Today&apos;s Orders
                        </Link>
                    </div>
                </div>
            )}
            {groupedItems.length === 0 ? (
                <div className="card dark-blue">
                    <div className="title">All Cafes Paid</div>
                    <div>Your current checkout snapshot is complete.</div>
                </div>
            ) : (
                <div className="order-page-cafes">
                    {groupedItems.map((group) => {
                        const view = viewsById.get(group.cafeId);
                        const cafeName = view == null
                            ? group.cafeId
                            : getViewName({ view, showGroupName: true });
                        const totalPrice = group.items.reduce((sum, item) => sum + calculatePrice(
                            item.menuItem,
                            new Map(item.modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)])),
                            item.quantity,
                        ), 0);
                        const hasUnavailableItems = group.items.some(item => !item.isAvailable);

                        return (
                            <div key={group.cafeId} className="card dark-blue order-page-cafe">
                                <div className="order-page-cafe-header">
                                    <div className="title">{cafeName}</div>
                                </div>
                                <table className="cart-contents">
                                    <tbody>
                                        {group.items.map((item) => (
                                            <CartItemRow
                                                key={item.id}
                                                item={item}
                                                showFullDetails={true}
                                                readOnly={true}
                                                onRemove={() => {}}
                                                onEdit={() => {}}
                                                onChangeQuantity={() => {}}
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
                                {cafeErrors[group.cafeId] && (
                                    <div className="order-page-cafe-error">
                                        {cafeErrors[group.cafeId]}
                                    </div>
                                )}
                                {hasUnavailableItems && (
                                    <div className="order-page-cafe-error">
                                        Remove unavailable items from your cart before paying this cafe.
                                    </div>
                                )}
                                <div className="order-page-cafe-footer">
                                    <span>{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
                                    <button
                                        className="default-container"
                                        disabled={isBusy || hasUnavailableItems}
                                        onClick={() => onPayCafe(group.cafeId, group.items)}
                                    >
                                        Pay {formatPrice(totalPrice)}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
