import { CafeTypes } from '@msdining/common';
import { IMenuItem } from '@msdining/common/dist/models/cafe';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { CartContext } from '../../../../../context/cart.ts';
import { PopupContext } from '../../../../../context/modal.ts';
import { ICartItemWithMetadata } from '../../../../../models/cart.ts';
import { addOrEditCartItem, calculatePrice, shallowCloneCart } from '../../../../../util/cart.ts';
import { getRandomId } from '../../../../../util/id.ts';
import { Modal } from '../../../../popup/modal.tsx';
import { MenuItemPopupBody } from './menu-item-popup-body.tsx';
import { MenuItemPopupFooter } from './menu-item-popup-footer.tsx';

import './menu-item-popup.css';
import { useIsOnlineOrderingAllowedForSelectedDate } from '../../../../../hooks/cafe.ts';
import { MenuItemButtons } from './menu-item-buttons.tsx';

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
};

interface IMenuItemPopupProps {
	menuItem: IMenuItem;
	modalSymbol: symbol;
	cafeId: string;
	fromCartItem?: ICartItemWithMetadata;
}

export const MenuItemPopup: React.FC<IMenuItemPopupProps> = ({ menuItem, modalSymbol, cafeId, fromCartItem }) => {
    const isUpdate = fromCartItem != null;

    const [selectedChoiceIdsByModifierId, setSelectedChoiceIdsByModifierId] = useState(() => {
        return fromCartItem?.choicesByModifierId ?? new Map<string, Set<string>>();
    });

    const [notes, setNotes] = useState(fromCartItem?.specialInstructions || '');
    const [quantity, setQuantity] = useState(fromCartItem?.quantity ?? 1);

    const cartItemsNotifier = useContext(CartContext);
    const modalNotifier = useContext(PopupContext);

    const isOnlineOrderingAllowedForSelectedDate = useIsOnlineOrderingAllowedForSelectedDate();
    const isOnlineOrderingAllowed = fromCartItem != null || isOnlineOrderingAllowedForSelectedDate;

    const closeModal = () => {
        if (modalNotifier.value?.id === modalSymbol) {
            modalNotifier.value = null;
        }
    };

    const getSelectedChoiceIdsForModifier = useCallback((modifier: CafeTypes.IMenuItemModifier) => {
        return selectedChoiceIdsByModifierId.get(modifier.id) ?? new Set<string>();
    }, [selectedChoiceIdsByModifierId]);

    const onSelectedChoiceIdsChanged = (modifier: CafeTypes.IMenuItemModifier, selection: Set<string>) => {
        const newSelectedChoiceIdsByModifierId = new Map(selectedChoiceIdsByModifierId);
        newSelectedChoiceIdsByModifierId.set(modifier.id, selection);
        setSelectedChoiceIdsByModifierId(newSelectedChoiceIdsByModifierId);
    };

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
            id:                  fromCartItem?.id ?? getRandomId(),
            associatedItem:      menuItem,
            itemId:              menuItem.id,
            quantity:            quantity,
            price:               totalPrice,
            specialInstructions: notes,
            choicesByModifierId: selectedChoiceIdsByModifierId,
            cafeId
        };

        const newCart = shallowCloneCart(cartItemsNotifier.value);
        addOrEditCartItem(newCart, newCartItem);
        cartItemsNotifier.value = newCart;

        closeModal();
    };

    const onAddQuantityClicked = () => {
        setQuantity(quantity + 1);
    };

    const onRemoveQuantityClicked = () => {
        if (quantity <= 1) {
            return;
        }

        setQuantity(quantity - 1);
    };

    return (
        <Modal
            title={`${isUpdate ? 'Edit ' : ''}${menuItem.name}`}
            buttons={
                <MenuItemButtons
                    cafeId={cafeId}
                    menuItem={menuItem}
                    onClose={closeModal}
                />
            }
            body={(
                <MenuItemPopupBody
                    menuItem={menuItem}
                    notes={notes}
                    getSelectedChoiceIdsForModifier={getSelectedChoiceIdsForModifier}
                    onSelectedChoiceIdsChanged={onSelectedChoiceIdsChanged}
                    onNotesChanged={setNotes}
                    isOnlineOrderingAllowed={isOnlineOrderingAllowed}
                />
            )}
            footer={(
                <MenuItemPopupFooter
                    isUpdate={isUpdate}
                    totalPrice={totalPrice}
                    quantity={quantity}
                    isOrderValid={isOrderValid}
                    isOnlineOrderingAllowed={isOnlineOrderingAllowed}
                    onAddToCartClicked={onAddToCartClicked}
                    onAddQuantityClicked={onAddQuantityClicked}
                    onRemoveQuantityClicked={onRemoveQuantityClicked}
                />
            )}
        />
    );
};