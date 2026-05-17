import { CafeTypes } from '@msdining/common';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import React, { useCallback, useMemo, useState } from 'react';
import { useCartStore } from '../../../../../store/zustand/cart.ts';
import { ICartItemWithMetadata } from '../../../../../models/cart.ts';
import { calculatePrice } from '../../../../../util/cart.ts';
import { getRandomId } from '../../../../../util/id.ts';
import { Modal } from '../../../../popup/modal.tsx';
import { MenuItemPopupBody } from './menu-item-popup-body.tsx';
import { MenuItemPopupFooter } from './menu-item-popup-footer.tsx';

import './menu-item-popup.css';
import { useIsOnlineOrderingAllowed } from '../../../../../hooks/cafe.ts';
import { MenuItemButtons } from './menu-item-buttons.tsx';
import { usePopupCloserSymbol } from '../../../../../hooks/popup.ts';

const useIsOrderValid = (menuItem: IMenuItemBase, getSelectedChoiceIdsForModifier: (modifier: CafeTypes.IMenuItemModifier) => Set<string>): boolean => {
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
	menuItem: IMenuItemBase;
	modalSymbol: symbol;
	cafeId: string;
	stationId?: string;
	stationName?: string;
	fromCartItem?: ICartItemWithMetadata;
}

export const MenuItemPopup: React.FC<IMenuItemPopupProps> = ({ menuItem, modalSymbol, cafeId, stationId, stationName, fromCartItem }) => {
    const isUpdate = fromCartItem != null;

    const [selectedChoiceIdsByModifierId, setSelectedChoiceIdsByModifierId] = useState(() => {
        return fromCartItem?.choicesByModifierId ?? new Map<string, Set<string>>();
    });

    const [notes, setNotes] = useState(fromCartItem?.specialInstructions || '');
    const [quantity, setQuantity] = useState(fromCartItem?.quantity ?? 1);

    const cartAddOrEditItem = useCartStore((state) => state.addOrEditItem);
    const closeModal = usePopupCloserSymbol();

    const isOnlineOrderingAllowedNow = useIsOnlineOrderingAllowed();
    // Editing an existing cart item is always allowed (the user clearly
    // already had ordering on when they put it there); only block new
    // adds when ordering isn't allowed right now.
    const isOnlineOrderingAllowed = fromCartItem != null || isOnlineOrderingAllowedNow;

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

        cartAddOrEditItem(newCartItem);

        closeModal(modalSymbol);
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
                    onClose={() => closeModal(modalSymbol)}
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
                    stationId={stationId}
                    stationName={stationName}
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