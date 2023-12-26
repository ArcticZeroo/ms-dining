import React, { useCallback, useContext, useMemo } from 'react';
import { CartContext } from '../../../../../../../context/cart.ts';
import { PopupContext } from '../../../../../../../context/modal.ts';
import { useValueNotifierAsState } from '../../../../../../../hooks/events.ts';
import { ICartItemWithMetadata } from '../../../../../../../models/cart.ts';

import { classNames } from '../../../../../../../util/react.ts';
import { MenuItemPopup } from '../../menu-item-popup.tsx';
import { CartItemRow } from './cart-item-row.tsx';

import './cart-popup.css';
import { addOrEditCartItem, removeFromCart, shallowCloneCart } from '../../../../../../../util/cart.ts';
import { getParentView } from '../../../../../../../util/view.ts';
import { ApplicationContext } from '../../../../../../../context/app.ts';
import { CafeView } from '../../../../../../../models/cafe.ts';
import { sortViews } from '../../../../../../../util/sorting.ts';

const editCartItemSymbol = Symbol('edit-cart-item');

export const CartPopup = () => {
    const { viewsById } = useContext(ApplicationContext);
    const modalNotifier = useContext(PopupContext);
    const cartItemsNotifier = useContext(CartContext);
    const [cart, setCart] = useValueNotifierAsState(cartItemsNotifier);

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

    const totalItemCount = useMemo(
        () => Array.from(cart.values()).reduce((total, itemsById) => total + itemsById.size, 0),
        [cart]
    );

    const cartItemsByView = useMemo(
        () => {
            const cartItemsByView = new Map<CafeView, Map<string, ICartItemWithMetadata>>();

            for (const [cafeId, itemsById] of cart) {
                const cafeView = viewsById.get(cafeId);

                if (cafeView == null) {
                    console.error('Could not get view for cafe id', cafeId);
                    continue;
                }

                const parentView = getParentView(viewsById, cafeView);

                const cartItemsById = cartItemsByView.get(parentView) ?? new Map<string, ICartItemWithMetadata>();

                for (const item of itemsById.values()) {
                    cartItemsById.set(item.id, item);
                }

                cartItemsByView.set(parentView, cartItemsById);
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
        <div className={classNames('cart-popup', totalItemCount === 0 && 'empty')}>
            <div className="cart-info">
                <span className="material-symbols-outlined">
                    shopping_cart
                </span>
                <span className="cart-count">
                    {totalItemCount}
                </span>
            </div>
            <table className="cart-contents">
                <tbody>
                {cartItemsView}
                </tbody>
            </table>
        </div>
    );
};