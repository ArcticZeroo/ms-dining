import { CafeTypes } from '@msdining/common';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import type { ICartItemData, ICartItemRecord, ICartItemUpdate } from '@msdining/common/models/cart';
import React, { useCallback, useMemo, useState } from 'react';
import { useIsOnlineOrderingAllowed } from '../../../../../hooks/cafe.ts';
import { usePopupCloserSymbol } from '../../../../../hooks/popup.ts';
import {
    useAddToCartMutation,
    useUpdateCartItemMutation,
} from '../../../../../store/queries/server-cart.ts';
import { calculatePrice } from '../../../../../util/cart.ts';
import { Modal } from '../../../../popup/modal.tsx';
import { MenuItemButtons } from './menu-item-buttons.tsx';
import { MenuItemPopupBody } from './menu-item-popup-body.tsx';
import { MenuItemPopupFooter } from './menu-item-popup-footer.tsx';

import './menu-item-popup.css';

const deserializeModifiers = (modifiers: ICartItemRecord['modifiers']) => {
    return new Map(modifiers.map(modifier => [modifier.modifierId, new Set(modifier.choiceIds)]));
};

const serializeModifiers = (selectedChoiceIdsByModifierId: Map<string, Set<string>>) => {
    return Array.from(selectedChoiceIdsByModifierId.entries()).map(([modifierId, choiceIds]) => ({
        modifierId,
        choiceIds: Array.from(choiceIds),
    }));
};

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

/**
 * Drives which surfaces inside the popup are rendered.
 *
 * - `default` — full menu-item popup: image, description, modifier picker,
 *   special-requests notes, add-to-cart footer, and reviews section. Used
 *   from the menu and search-result pages.
 * - `orderReview` — review-focused popup opened from the order-history page.
 *   Shows the menu item details + reviews section only; suppresses the
 *   modifier picker, special-requests notes, and the entire cart footer
 *   since the user is reviewing something they've already ordered.
 */
export type MenuItemPopupMode = 'default' | 'orderReview';

interface IMenuItemPopupProps {
    menuItem: IMenuItemBase;
    modalSymbol: symbol;
    cafeId: string;
    stationId?: string;
    stationName?: string;
    fromCartItem?: ICartItemRecord;
    onUpdated?: (update: ICartItemUpdate) => void;
    mode?: MenuItemPopupMode;
}

export const MenuItemPopup: React.FC<IMenuItemPopupProps> = ({ menuItem, modalSymbol, cafeId, stationId, stationName, fromCartItem, onUpdated, mode = 'default' }) => {
    const isUpdate = fromCartItem != null;
    const isOrderReview = mode === 'orderReview';

    const [selectedChoiceIdsByModifierId, setSelectedChoiceIdsByModifierId] = useState(() => {
        return fromCartItem?.modifiers != null
            ? deserializeModifiers(fromCartItem.modifiers)
            : new Map<string, Set<string>>();
    });

    const [notes, setNotes] = useState(fromCartItem?.specialInstructions ?? '');
    const [quantity, setQuantity] = useState(fromCartItem?.quantity ?? 1);

    const addToCart = useAddToCartMutation();
    const updateCartItem = useUpdateCartItemMutation();
    const closeModal = usePopupCloserSymbol();

    const isOnlineOrderingAllowedNow = useIsOnlineOrderingAllowed();
    // Editing an existing cart item is always allowed (the user clearly
    // already had ordering on when they put it there); only block new
    // adds when ordering isn't allowed right now. orderReview mode forces
    // off regardless — this surface deliberately doesn't show cart UI.
    const isOnlineOrderingAllowed = !isOrderReview && (fromCartItem != null || isOnlineOrderingAllowedNow);

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

        const itemData: ICartItemData = {
            menuItemId:          menuItem.id,
            quantity,
            specialInstructions: notes || undefined,
            modifiers:           serializeModifiers(selectedChoiceIdsByModifierId),
        };

        if (fromCartItem != null) {
            const update: ICartItemUpdate = {
                quantity,
                specialInstructions: notes || null,
                modifiers:           itemData.modifiers,
            };
            updateCartItem.mutate({ itemId: fromCartItem.id, update });
            onUpdated?.(update);
        } else {
            addToCart.mutate({ item: itemData, menuItem });
        }

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
                    mode={mode}
                    showReviews={isOrderReview || !isUpdate}
                    stationId={stationId}
                    stationName={stationName}
                />
            )}
            footer={isOrderReview ? undefined : (
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
