import React, { useCallback, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { PopupContext } from '../../../context/modal.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { useCartStore } from '../../../store/zustand/cart.ts';
import { CafeView } from '../../../models/cafe.ts';
import { ICartItemWithMetadata } from '../../../models/cart.ts';
import { getViewName } from '../../../util/cafe.ts';
import { getViewMenuUrl } from '../../../util/link.ts';
import { sortViews } from '../../../util/sorting.ts';
import { MenuItemPopup } from '../../cafes/station/menu-items/popup/menu-item-popup.tsx';
import { OrderPriceInlineTable } from '../order-price-inline-table.tsx';
import { IPrepareCartResponse } from '@msdining/common/models/cart';
import { CartItemRow } from './cart-item-row.tsx';
import './cart-contents-table.css';

const editCartItemSymbol = Symbol('edit-cart-item');

interface ICartContentsTableProps {
    showFullDetails?: boolean;
    showTotalPrice?: boolean;
    readOnly?: boolean;
    cartSessionData?: IPrepareCartResponse | null;
    cartSessionError?: unknown;
}

export const CartContentsTable: React.FC<ICartContentsTableProps> = ({ showFullDetails = false, showTotalPrice = false, readOnly = false, cartSessionData = null, cartSessionError }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const cart = useCartStore((state) => state.items);
    const removeItem = useCartStore((state) => state.removeItem);
    const addOrEditItem = useCartStore((state) => state.addOrEditItem);
    const modalNotifier = useContext(PopupContext);

    const onRemove = useCallback((item: ICartItemWithMetadata) => {
        removeItem(item);
    }, [removeItem]);

    const onEdit = useCallback((item: ICartItemWithMetadata) => {
        if (modalNotifier.value != null) {
            return;
        }

        modalNotifier.value = {
            id:   editCartItemSymbol,
            body: <MenuItemPopup
                cafeId={item.cafeId}
                menuItem={item.associatedItem}
                modalSymbol={editCartItemSymbol}
                fromCartItem={item}
            />
        };
    }, [modalNotifier]);

    const onChangeQuantity = useCallback((item: ICartItemWithMetadata, quantity: number) => {
        if (quantity < 1) {
            return;
        }

        addOrEditItem({
            ...item,
            quantity
        });
    }, [addOrEditItem]);

    const cartItemsByView = useMemo(
        () => {
            const cartItemsByView = new Map<CafeView, Map<string, ICartItemWithMetadata>>();

            for (const [cafeId, itemsById] of cart) {
                const cafeView = viewsById.get(cafeId);

                if (cafeView == null) {
                    console.error('Could not get view for cafe id', cafeId);
                    continue;
                }

                const cartItemsById = cartItemsByView.get(cafeView) ?? new Map<string, ICartItemWithMetadata>();

                for (const item of itemsById.values()) {
                    cartItemsById.set(item.id, item);
                }

                cartItemsByView.set(cafeView, cartItemsById);
            }

            return cartItemsByView;
        },
        [cart, viewsById]
    );

    const cartItemsView = useMemo(
        () => {
            const viewsInOrder = sortViews(cartItemsByView.keys());

            return viewsInOrder.map(view => (
                <React.Fragment key={view.value.id}>
                    <tr>
                        <th colSpan={4}>
                            <Link to={getViewMenuUrl({ view, viewsById, shouldUseGroups })} className="cart-cafe-url">
                                {getViewName({
                                    view,
                                    showGroupName: true
                                })}
                            </Link>
                        </th>
                    </tr>
                    {
                        Array.from(cartItemsByView.get(view)!.values()).map((item) => (
                            <CartItemRow
                                key={item.id}
                                showFullDetails={showFullDetails}
                                readOnly={readOnly}
                                item={item}
                                onRemove={() => onRemove(item)}
                                onEdit={() => onEdit(item)}
                                onChangeQuantity={(quantity) => onChangeQuantity(item, quantity)}
                            />
                        ))
                    }
                </React.Fragment>
            ))
        },
        [cartItemsByView, viewsById, shouldUseGroups, showFullDetails, readOnly, onRemove, onEdit, onChangeQuantity]
    );

    return (
        <table className="cart-contents">
            <tbody>
                {cartItemsView}
                {
                    showTotalPrice && <OrderPriceInlineTable cartSessionData={cartSessionData} cartSessionError={cartSessionError}/>
                }
            </tbody>
        </table>
    );
};