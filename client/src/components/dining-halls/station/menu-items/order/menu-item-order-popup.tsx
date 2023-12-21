import { IMenuItem } from '../../../../../models/cafe.ts';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { CafeTypes } from '@msdining/common';

import './menu-item-order-popup.css';
import { CartContext } from '../../../../../context/cart.ts';
import { PopupContext } from '../../../../../context/modal.ts';
import { ICartItemWithMetadata } from '../../../../../models/cart.ts';
import { Modal } from '../../../../popup/modal.tsx';
import { OrderPopupFooter } from './order-popup-footer.tsx';
import { OrderPopupBody } from './order-popup-body.tsx';

interface IMenuItemOrderPopupProps {
    menuItem: IMenuItem;
    modalSymbol: symbol;
    fromCartItem?: ICartItemWithMetadata;
}

const calculatePrice = (menuItem: IMenuItem, selectedChoiceIdsByModifierId: Map<string, Set<string>>): number => {
    let price = menuItem.price;

    for (const modifier of menuItem.modifiers) {
        const selectedChoiceIds = selectedChoiceIdsByModifierId.get(modifier.id) ?? new Set<string>();

        for (const choice of modifier.choices) {
            if (selectedChoiceIds.has(choice.id)) {
                price += choice.price;
            }
        }
    }

    return price;
}

const useIsOrderValid = (menuItem: IMenuItem, getSelectedChoiceIdsForModifier: (modifier: CafeTypes.IMenuItemModifier) => Set<string>): boolean => {
    return useMemo(
        () => {
            for (const modifier of menuItem.modifiers) {
                const selectedChoiceIds = getSelectedChoiceIdsForModifier(modifier);

                if (selectedChoiceIds.size < modifier.minimum) {
                    return false;
                }

                if (selectedChoiceIds.size > modifier.maximum) {
                    return false;
                }
            }

            return true;
        },
        [menuItem, getSelectedChoiceIdsForModifier]
    );
}

export const MenuItemOrderPopup: React.FC<IMenuItemOrderPopupProps> = ({ menuItem, modalSymbol, fromCartItem }) => {
    const isUpdate = fromCartItem != null;

    const [selectedChoiceIdsByModifierId, setSelectedChoiceIdsByModifierId] = useState(() => {
        return fromCartItem?.choicesByModifierId ?? new Map<string, Set<string>>();
    });

    const [notes, setNotes] = useState(fromCartItem?.specialInstructions || '');
    const [quantity, setQuantity] = useState(fromCartItem?.quantity ?? 1);

    const cartItemsNotifier = useContext(CartContext);
    const modalNotifier = useContext(PopupContext);

    const getSelectedChoiceIdsForModifier = useCallback((modifier: CafeTypes.IMenuItemModifier) => {
        return selectedChoiceIdsByModifierId.get(modifier.id) ?? new Set<string>();
    }, [selectedChoiceIdsByModifierId]);

    const onSelectedChoiceIdsChanged = (modifier: CafeTypes.IMenuItemModifier, selection: Set<string>) => {
        const newSelectedChoiceIdsByModifierId = new Map(selectedChoiceIdsByModifierId);
        newSelectedChoiceIdsByModifierId.set(modifier.id, selection);
        setSelectedChoiceIdsByModifierId(newSelectedChoiceIdsByModifierId);
    }

    const totalPrice = useMemo(
        () => calculatePrice(menuItem, selectedChoiceIdsByModifierId),
        [menuItem, selectedChoiceIdsByModifierId]
    );

    const isOrderValid = useIsOrderValid(menuItem, getSelectedChoiceIdsForModifier);

    const onAddToCartClicked = () => {
        if (!isOrderValid) {
            return;
        }

        const newCartItem: ICartItemWithMetadata = {
            associatedItem:      menuItem,
            itemId:              menuItem.id,
            quantity:            quantity,
            price:               totalPrice,
            specialInstructions: notes,
            choicesByModifierId: selectedChoiceIdsByModifierId
        };

        if (fromCartItem != null) {
            cartItemsNotifier.value = cartItemsNotifier.value.map(item => {
                if (item === fromCartItem) {
                    return newCartItem;
                }

                return item;
            });
        } else {
            cartItemsNotifier.value = [
                ...cartItemsNotifier.value,
                newCartItem
            ];
        }

        if (modalNotifier.value?.id === modalSymbol) {
            modalNotifier.value = null;
        }
    }

    const onAddQuantityClicked = () => {
        setQuantity(quantity + 1);
    }

    const onRemoveQuantityClicked = () => {
        if (quantity <= 1) {
            return;
        }

        setQuantity(quantity - 1);
    }

    return (
        <Modal
            title={`${isUpdate ? 'Edit ' : ''}${menuItem.name}`}
            body={(
                <OrderPopupBody
                    menuItem={menuItem}
                    notes={notes}
                    getSelectedChoiceIdsForModifier={getSelectedChoiceIdsForModifier}
                    onSelectedChoiceIdsChanged={onSelectedChoiceIdsChanged}
                    onNotesChanged={setNotes}
                />
            )}
            footer={(
                <OrderPopupFooter
                    isUpdate={isUpdate}
                    totalPrice={totalPrice}
                    quantity={quantity}
                    isOrderValid={isOrderValid}
                    onAddToCartClicked={onAddToCartClicked}
                    onAddQuantityClicked={onAddQuantityClicked}
                    onRemoveQuantityClicked={onRemoveQuantityClicked}
                />
            )}
        />
    );
}