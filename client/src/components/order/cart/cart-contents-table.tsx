import React, { useCallback, useContext, useMemo } from 'react';
import { CafeView } from '../../../models/cafe.ts';
import { ICartItemWithMetadata } from '../../../models/cart.ts';
import { getParentView } from '../../../util/view.ts';
import { sortViews } from '../../../util/sorting.ts';
import { CartItemRow } from './cart-item-row.tsx';
import { useValueNotifier, useValueNotifierAsState } from '../../../hooks/events.ts';
import { CartContext } from '../../../context/cart.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { ApplicationSettings } from '../../../api/settings.ts';
import { addOrEditCartItem, removeFromCart, shallowCloneCart } from '../../../util/cart.ts';
import { MenuItemPopup } from '../../cafes/station/menu-items/popup/menu-item-popup.tsx';
import { PopupContext } from '../../../context/modal.ts';

const editCartItemSymbol = Symbol('edit-cart-item');

export const CartContentsTable = () => {
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
        // Remove must be pressed to change quantity to zero
        if (quantity < 1) {
            console.log('canceling quantity change since it is zero');
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

                const parentView = getParentView(viewsById, cafeView, shouldUseGroups);

                const cartItemsById = cartItemsByView.get(parentView) ?? new Map<string, ICartItemWithMetadata>();

                for (const item of itemsById.values()) {
                    cartItemsById.set(item.id, item);
                }

                cartItemsByView.set(parentView, cartItemsById);
            }

            return cartItemsByView;
        },
        [cart, shouldUseGroups, viewsById]
    );

    const cartItemsView = useMemo(
        () => {
            const viewsInOrder = sortViews(cartItemsByView.keys());

            return viewsInOrder.map(view => (
                <React.Fragment key={view.value.id}>
                    <tr>
                        <th colSpan={4}>
                            {view.value.name}
                        </th>
                    </tr>
                    {
                        Array.from(cartItemsByView.get(view)!.values()).map((item) => (
                            <CartItemRow
                                key={item.id}
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
        [cartItemsByView, onChangeQuantity, onEdit, onRemove]
    );

    return (
        <table className="cart-contents">
            <tbody>
                {cartItemsView}
            </tbody>
        </table>
    );
};