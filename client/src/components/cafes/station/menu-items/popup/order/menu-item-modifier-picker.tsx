import { CafeTypes } from '@msdining/common';
import React, { useMemo } from 'react';
import { getMinMaxDisplay } from '../../../../../../util/cart.ts';
import { classNames } from '../../../../../../util/react.ts';
import { ModifierChoices } from './choices/modifier-choices.tsx';

interface IMenuItemModifierPickerProps {
    modifier: CafeTypes.IMenuItemModifier;
    selectedChoiceIds: Set<string>;
    onSelectedChoiceIdsChanged(selection: Set<string>): void;
}

export const MenuItemModifierPicker: React.FC<IMenuItemModifierPickerProps> = ({ modifier, selectedChoiceIds, onSelectedChoiceIdsChanged }) => {
    const isValid = useMemo(() => {
        return selectedChoiceIds.size >= modifier.minimum && selectedChoiceIds.size <= modifier.maximum;
    }, [modifier, selectedChoiceIds]);

    return (
        <div className={classNames('menu-item-modifier', !isValid && 'error')}>
            <div className="menu-item-modifier-description">
                {
                    modifier.minimum > 0 && '(Required) '
                }
                {modifier.description}
            </div>
            <div className="menu-item-modifier-count">
                {getMinMaxDisplay(modifier)}
            </div>
            <ModifierChoices
                modifier={modifier}
                selectedChoiceIds={selectedChoiceIds}
                onSelectedChoiceIdsChanged={onSelectedChoiceIdsChanged}
            />
        </div>
    );
};