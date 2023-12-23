import { CafeTypes } from '@msdining/common';
import React from 'react';
import { ApplicationSettings } from '../../../../../api/settings.ts';
import { useValueNotifier } from '../../../../../hooks/events.ts';
import { IMenuItem } from '../../../../../models/cafe.ts';
import { MenuItemModifierPicker } from './order/menu-item-modifier-picker.tsx';

interface IMenuItemPopupBodyProps {
    menuItem: IMenuItem;
    notes: string;
    getSelectedChoiceIdsForModifier: (modifier: CafeTypes.IMenuItemModifier) => Set<string>;
    onSelectedChoiceIdsChanged: (modifier: CafeTypes.IMenuItemModifier, selection: Set<string>) => void;
    onNotesChanged: (notes: string) => void;
}

export const MenuItemPopupBody: React.FC<IMenuItemPopupBodyProps> = ({
                                                                   menuItem,
                                                                   notes,
                                                                   getSelectedChoiceIdsForModifier,
                                                                   onSelectedChoiceIdsChanged,
                                                                   onNotesChanged
                                                               }) => {
    const isOnlineOrderingAllowed = useValueNotifier(ApplicationSettings.allowOnlineOrdering);

    return (
        <div className="menu-item-order-body">
            <div className="menu-item-description">{menuItem.description}</div>
            {
                menuItem.imageUrl != null && (
                    <div className="menu-item-image-container">
                        <img src={menuItem.imageUrl} alt="Menu item image" className="menu-item-image"/>
                    </div>
                )
            }
            {
                isOnlineOrderingAllowed && (
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
									  onChange={event => onNotesChanged(event.target.value)}/>
						</div>
					</div>
				)
            }
        </div>
    );
}