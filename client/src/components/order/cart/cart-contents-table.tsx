import React, { useCallback, useContext, useMemo } from 'react';
import { CafeView } from '../../../models/cafe.ts';
import { ICartItemWithMetadata } from '../../../models/cart.ts';
import { sortViews } from '../../../util/sorting.ts';
import { CartItemRow } from './cart-item-row.tsx';
import { useValueNotifier, useValueNotifierAsState } from '../../../hooks/events.ts';
import { CartContext } from '../../../context/cart.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { addOrEditCartItem, removeFromCart, shallowCloneCart } from '../../../util/cart.ts';
import { MenuItemPopup } from '../../cafes/station/menu-items/popup/menu-item-popup.tsx';
import { PopupContext } from '../../../context/modal.ts';
import { Link } from 'react-router-dom';
import { getViewMenuUrl } from '../../../util/link.ts';

import './cart-contents-table.css';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { OrderPriceInlineTable } from '../order-price-inline-table.tsx';
import { getParentView } from '../../../util/view.ts';
import { getViewName } from '../../../util/cafe.ts';

const editCartItemSymbol = Symbol('edit-cart-item');

interface ICartContentsTableProps {
    showModifiers?: boolean;
    showTotalPrice?: boolean;
}

export const CartContentsTable: React.FC<ICartContentsTableProps> = ({ showModifiers = false, showTotalPrice = false }) => {
    const { viewsById } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const cartItemsNotifier = useContext(CartContext);
    const [cart, setCart] = useValueNotifierAsState(cartItemsNotifier);
    const modalNotifier = useContext(PopupContext);
    
    const onRemove = useCallback((item: ICartItemWithMetadata) => {
        const newCart = shallowCloneCart(cart);
        removeFromCart(newCart, item);
        setCart(newCart);
    }, [cart, setCart]);

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

        const newCart = shallowCloneCart(cart);

        addOrEditCartItem(newCart, {
            ...item,
            quantity
        });

        setCart(newCart);
    }, [cart, setCart]);

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
                            <Link to={getViewMenuUrl(getParentView(viewsById, view, shouldUseGroups))} className="cart-cafe-url">
                                {getViewName(view, true /*showGroupName*/)}
                            </Link>
                        </th>
                    </tr>
                    {
                        Array.from(cartItemsByView.get(view)!.values()).map((item) => (
                            <CartItemRow
                                key={item.id}
                                showModifiers={showModifiers}
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
        [cartItemsByView, showModifiers, onChangeQuantity, onEdit, onRemove]
    );

    return (
        <table className="cart-contents">
            <tbody>
                {cartItemsView}
                {
                    showTotalPrice && <OrderPriceInlineTable/>
                }
            </tbody>
        </table>
    );
};