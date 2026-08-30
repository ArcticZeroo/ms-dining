import { CafeTypes } from '@msdining/common';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import React from 'react';
import { MenuItemConfiguration } from './menu-item-configuration.tsx';

interface IMenuItemOverviewTabProps {
    menuItem: IMenuItemBase;
    notes: string;
    getSelectedChoiceIdsForModifier: (modifier: CafeTypes.IMenuItemModifier) => Set<string>;
    onSelectedChoiceIdsChanged: (modifier: CafeTypes.IMenuItemModifier, selection: Set<string>) => void;
    onNotesChanged: (notes: string) => void;
    isOnlineOrderingAllowed: boolean;
    isOrderReview: boolean;
}

/** The "Overview & Order" tab: item image + description alongside its ordering configuration. */
export const MenuItemOverviewTab: React.FC<IMenuItemOverviewTabProps> = ({
    menuItem,
    notes,
    getSelectedChoiceIdsForModifier,
    onSelectedChoiceIdsChanged,
    onNotesChanged,
    isOnlineOrderingAllowed,
    isOrderReview,
}) => {
    const showConfiguration = !isOrderReview && menuItem.modifiers.length > 0;
    const hasDetails = Boolean(menuItem.description) || menuItem.imageUrl != null;

    if (!hasDetails && !showConfiguration) {
        return (
            <div className="menu-item-overview-empty flex flex-center subtitle">
                {isOnlineOrderingAllowed ? 'This item can\'t be customized.' : 'No additional details for this item.'}
            </div>
        );
    }

    return (
        <div className="menu-item-overview">
            <div className="flex-col flex-center">
                {
                    menuItem.description && (
                        <div className="menu-item-description">{menuItem.description}</div>
                    )
                }
                {
                    menuItem.imageUrl != null && (
                        <div className="menu-item-image-container">
                            <img src={menuItem.imageUrl}
                                alt="Menu item image"
                                className="menu-item-image"/>
                        </div>
                    )
                }
            </div>
            {
                showConfiguration && (
                    <MenuItemConfiguration
                        menuItem={menuItem}
                        notes={notes}
                        getSelectedChoiceIdsForModifier={getSelectedChoiceIdsForModifier}
                        onSelectedChoiceIdsChanged={onSelectedChoiceIdsChanged}
                        onNotesChanged={onNotesChanged}
                        isOnlineOrderingAllowed={isOnlineOrderingAllowed}
                    />
                )
            }
        </div>
    );
};
