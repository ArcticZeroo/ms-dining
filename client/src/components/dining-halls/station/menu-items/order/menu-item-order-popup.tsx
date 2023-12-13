import { IMenuItem } from '../../../../../models/cafe.ts';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { MenuItemModifierPicker } from './menu-item-modifier-picker.tsx';
import { CafeTypes } from '@msdining/common';
import { getPriceDisplay } from '../../../../../util/cart.ts';

import './menu-item-order-popup.css';
import { CartContext } from '../../../../../context/cart.ts';

interface IMenuItemOrderPopupProps {
    menuItem: IMenuItem;
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

export const MenuItemOrderPopup: React.FC<IMenuItemOrderPopupProps> = ({ menuItem }) => {
    const [selectedChoiceIdsByModifierId, setSelectedChoiceIdsByModifierId] = useState(() => new Map<string, Set<string>>());
    const [notes, setNotes] = useState('');
    const cartItemsNotifier = useContext(CartContext);

    useEffect(() => {
        setSelectedChoiceIdsByModifierId(new Map<string, Set<string>>());
    }, [menuItem.modifiers]);

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

        cartItemsNotifier.value = [
            ...cartItemsNotifier.value,
            {
                itemName:            menuItem.name,
                itemId:              menuItem.id,
                quantity:            1,
                specialInstructions: notes,
                modifiers:           Array.from(selectedChoiceIdsByModifierId.entries())
                                         .flatMap(([modifierId, selectedChoiceIds]) => Array.from(selectedChoiceIds)
                                             .map(choiceId => ({ modifierId, choiceId })))
            }
        ];
    }

    return (
        <div className="menu-item-order-popup">
            <div className="menu-item-description">{menuItem.description}</div>
            {
                menuItem.imageUrl != null && (
                    <div className="menu-item-image-container">
                        <img src={menuItem.imageUrl} alt="Menu item image" className="menu-item-image"/>
                    </div>
                )
            }
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
            <div className="footer">
                <div className="price">
                    {getPriceDisplay(totalPrice)}
                </div>
                <button className="add-to-cart"
                        disabled={!isOrderValid}
                        title={isOrderValid ? 'Click to add to cart' : 'Finish choosing options before adding to your cart!'}
                        onClick={onAddToCartClicked}
                >
                    Add to Cart
                </button>
            </div>
        </div>
    );
}