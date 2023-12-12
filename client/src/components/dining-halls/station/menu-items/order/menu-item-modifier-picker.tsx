import { CafeTypes } from '@msdining/common';
import React from 'react';
import { ModifierChoices } from './choices/modifier-choices.tsx';

interface IMenuItemModifierPickerProps {
    modifier: CafeTypes.IMenuItemModifier;
    selectedChoiceIds: Set<string>;
    onSelectedChoiceIdsChanged(selection: Set<string>): void;
}

export const MenuItemModifierPicker: React.FC<IMenuItemModifierPickerProps> = ({ modifier, selectedChoiceIds, onSelectedChoiceIdsChanged }) => {
    return (
        <div className="menu-item-modifier">
            <div className="menu-item-modifier-description">
                {
                    modifier.minimum > 0 && '(Required) '
                }
                {modifier.description}
            </div>
            <div className="menu-item-modifier-count">
                {modifier.minimum} - {modifier.maximum}
            </div>
            <ModifierChoices
                modifier={modifier}
                selectedChoiceIds={selectedChoiceIds}
                onSelectedChoiceIdsChanged={onSelectedChoiceIdsChanged}
            />
        </div>
    );
};