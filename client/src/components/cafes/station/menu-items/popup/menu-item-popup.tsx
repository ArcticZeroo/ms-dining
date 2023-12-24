import { CafeTypes } from '@msdining/common';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CartContext } from '../../../../../context/cart.ts';
import { PopupContext } from '../../../../../context/modal.ts';
import { IMenuItem } from '../../../../../models/cafe.ts';
import { ICartItemWithMetadata } from '../../../../../models/cart.ts';
import { navigateToSearch } from '../../../../../util/search.ts';
import { Modal } from '../../../../popup/modal.tsx';
import { MenuItemPopupBody } from './menu-item-popup-body.tsx';
import { MenuItemPopupFooter } from './menu-item-popup-footer.tsx';

import { useValueNotifier } from '../../../../../hooks/events.ts';
import { ApplicationSettings } from '../../../../../api/settings.ts';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util';

import filledStarIcon from '../../../../../assets/star-filled.svg';

import './menu-item-popup.css';

interface IMenuItemPopupProps {
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
};

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

export const MenuItemPopup: React.FC<IMenuItemPopupProps> = ({ menuItem, modalSymbol, fromCartItem }) => {
    const isUpdate = fromCartItem != null;

    const navigate = useNavigate();

    const [selectedChoiceIdsByModifierId, setSelectedChoiceIdsByModifierId] = useState(() => {
        return fromCartItem?.choicesByModifierId ?? new Map<string, Set<string>>();
    });

    const [notes, setNotes] = useState(fromCartItem?.specialInstructions || '');
    const [quantity, setQuantity] = useState(fromCartItem?.quantity ?? 1);

    const cartItemsNotifier = useContext(CartContext);
    const modalNotifier = useContext(PopupContext);

    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);
    
    const normalizedItemName = useMemo(
        () => normalizeNameForSearch(menuItem.name),
        [menuItem.name]
    );

    const isItemFavorite = useMemo(
        () => favoriteItemNames.has(normalizedItemName),
        [favoriteItemNames, normalizedItemName]
    );

    const closeModal = () => {
        if (modalNotifier.value?.id === modalSymbol) {
            modalNotifier.value = null;
        }
    }

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

    const onSearchClicked = () => {
        navigateToSearch(navigate, menuItem.name);
        closeModal();
    };

    const onFavoriteClicked = () => {
        if (isItemFavorite) {
            ApplicationSettings.favoriteItemNames.delete(normalizedItemName);
        } else {
            ApplicationSettings.favoriteItemNames.add(normalizedItemName);
        }
    };

    return (
        <Modal
            title={`${isUpdate ? 'Edit ' : ''}${menuItem.name}`}
            buttons={
                <>
                    <button title={isItemFavorite ? 'Click to remove from favorites' : 'Favorite this item'} onClick={onFavoriteClicked}>
                        {
                            isItemFavorite && (
                                <img src={filledStarIcon} alt="favorite"/>
                            )
                        }
                        {
                            !isItemFavorite && (
                                <span className="material-symbols-outlined">
                                    star
                                </span>
                            )
                        }
                    </button>
                    <button title="Search for this item across campus" onClick={onSearchClicked}>
						<span className="material-symbols-outlined">
							search
						</span>
                    </button>
                </>
            }
            body={(
                <MenuItemPopupBody
                    menuItem={menuItem}
                    notes={notes}
                    getSelectedChoiceIdsForModifier={getSelectedChoiceIdsForModifier}
                    onSelectedChoiceIdsChanged={onSelectedChoiceIdsChanged}
                    onNotesChanged={setNotes}
                />
            )}
            footer={(
                <MenuItemPopupFooter
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
};