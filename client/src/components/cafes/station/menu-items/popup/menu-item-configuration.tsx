import { CafeTypes } from '@msdining/common';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import React from 'react';
import { MenuItemModifierPicker } from '../../../../pages/order/menu-item-modifier-picker.tsx';

interface IMenuItemConfigurationProps {
    menuItem: IMenuItemBase;
    notes: string;
    getSelectedChoiceIdsForModifier: (modifier: CafeTypes.IMenuItemModifier) => Set<string>;
    onSelectedChoiceIdsChanged: (modifier: CafeTypes.IMenuItemModifier, selection: Set<string>) => void;
    onNotesChanged: (notes: string) => void;
    isOnlineOrderingAllowed: boolean;
}

export const MenuItemConfiguration: React.FC<IMenuItemConfigurationProps> = ({
    menuItem,
    notes,
    getSelectedChoiceIdsForModifier,
    onSelectedChoiceIdsChanged,
    onNotesChanged,
    isOnlineOrderingAllowed,
}) => (
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
        {
            isOnlineOrderingAllowed && (
                <div className="menu-item-notes">
                    <label htmlFor="notes">Special Requests & Preparation Notes</label>
                    <textarea id="notes"
                        placeholder="Enter Special Requests & Preparation Notes Here"
                        value={notes}
                        onChange={event => onNotesChanged(event.target.value)}/>
                </div>
            )
        }
    </div>
);
