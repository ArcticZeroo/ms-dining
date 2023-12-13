import { useValueNotifierAsState } from '../../../../../../hooks/events.ts';
import { CartContext } from '../../../../../../context/cart.ts';

import { classNames } from '../../../../../../util/react.ts';
import { CartItemRow } from './cart-item-row.tsx';
import { useContext } from 'react';
import { ICartItemWithMetadata } from '../../../../../../models/cart.ts';
import { ModalContext } from '../../../../../../context/modal.ts';

import './cart-popup.css';
import { MenuItemOrderPopup } from '../menu-item-order-popup.tsx';

const editCartItemSymbol = Symbol('edit-cart-item');

export const CartPopup = () => {
    const modalNotifier = useContext(ModalContext);
    const cartItemsNotifier = useContext(CartContext);
    const [cartItems, setCartItems] = useValueNotifierAsState(cartItemsNotifier);

    const onRemove = (item: ICartItemWithMetadata) => {
        const newCartItems = cartItems.filter(cartItem => cartItem !== item);
        setCartItems(newCartItems);
    }

    const onEdit = (item: ICartItemWithMetadata) => {
        if (modalNotifier.value != null) {
            return;
        }

        modalNotifier.value = {
            id:    editCartItemSymbol,
            title: `Edit ${item.associatedItem.name}`,
            body:  <MenuItemOrderPopup
                       menuItem={item.associatedItem}
                       modalSymbol={editCartItemSymbol}
                       fromCartItem={item}
                   />
        };
    }

    const onChangeQuantity = (item: ICartItemWithMetadata, quantity: number) => {
        if (quantity < 1) {
            onRemove(item);
            return;
        }

        const newCartItems = cartItems.map(cartItem => {
            if (cartItem !== item) {
                return cartItem;
            }

            return {
                ...cartItem,
                quantity
            };
        });

        setCartItems(newCartItems);
    }

    return (
        <div className={classNames('cart-popup', cartItems.length === 0 && 'empty')}>
            <div className="cart-info">
                <span className="material-symbols-outlined">
                    shopping_cart
                </span>
                <span className="cart-count">
                    {cartItems.length}
                </span>
            </div>
            <table className="cart-contents">
                <tbody>
                {cartItems.map((cartItem, index) => (
                    <CartItemRow
                        key={index}
                        item={cartItem}
                        onRemove={() => onRemove(cartItem)}
                        onEdit={() => onEdit(cartItem)}
                        onChangeQuantity={(quantity) => onChangeQuantity(cartItem, quantity)}
                    />
                ))}
                </tbody>
            </table>
        </div>
    );
};