import { IMenuItem } from '../../../../../models/cafe.ts';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { CafeTypes } from '@msdining/common';

import './menu-item-order-popup.css';
import { CartContext } from '../../../../../context/cart.ts';
import { PopupContext } from '../../../../../context/modal.ts';
import { ICartItemWithMetadata } from '../../../../../models/cart.ts';
import { Modal } from '../../../../popup/modal.tsx';
import { MenuItemModifierPicker } from './menu-item-modifier-picker.tsx';
import { getPriceDisplay } from '../../../../../util/cart.ts';

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

export const MenuItemOrderPopup: React.FC<IMenuItemOrderPopupProps> = ({ menuItem, modalSymbol, fromCartItem }) => {
    const [selectedChoiceIdsByModifierId, setSelectedChoiceIdsByModifierId] = useState(() => {
        return fromCartItem?.choicesByModifierId ?? new Map<string, Set<string>>();
    });

    const [notes, setNotes] = useState(fromCartItem?.specialInstructions || '');

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

    const isOrderValid = useMemo(
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

    const onAddToCartClicked = () => {
        if (!isOrderValid) {
            return;
        }

        const newCartItem: ICartItemWithMetadata = {
            associatedItem:      menuItem,
            itemId:              menuItem.id,
            quantity:            1,
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

    return (
        <Modal
            title={menuItem.name}
            body={(
                <div className="menu-item-order-body">
                    <div className="menu-item-description">{menuItem.description}</div>
                    {
                        menuItem.imageUrl != null && (
                            <div className="menu-item-image-container">
                                <img src={menuItem.imageUrl} alt="Menu item image" className="menu-item-image"/>
                            </div>
                        )
                    }
                    <div className="menu-item-configuration">
                        <div className="menu-item-modifiers">
                            {
                                menuItem.modifiers.map(modifier => (
                                    <MenuItemModifierPicker
                                        key={modifier.id}
                                        modifier={modifier}
                                        selectedChoiceIds={getSelectedChoiceIdsForModifier(modifier)}
                                        onSelectedChoiceIdsChanged={selection => onSelectedChoiceIdsChanged(modifier, selection)}
                                    />
                                ))
                            }
                        </div>
                        <div className="menu-item-notes">
                            <label htmlFor="notes">Special Requests & Preparation Notes</label>
                            <textarea id="notes"
                                      placeholder="Enter Special Requests & Preparation Notes Here"
                                      value={notes}
                                      onChange={event => setNotes(event.target.value)}/>
                        </div>
                    </div>
                </div>
            )}
            footer={(
                <div className="menu-item-order-footer">
                    <div className="price">
                        {getPriceDisplay(totalPrice)}
                    </div>
                    <button className="add-to-cart"
                            disabled={!isOrderValid}
                            title={isOrderValid ? 'Click to add to cart' : 'Finish choosing options before adding to your cart!'}
                            onClick={onAddToCartClicked}
                    >
                        {
                            fromCartItem == null
                                ? 'Add to Cart'
                                : 'Update Cart Item'
                        }
                    </button>
                </div>
            )}
        />
    );
}