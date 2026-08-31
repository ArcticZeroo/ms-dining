import { SearchEntityType } from '@msdining/common/models/search';
import React, { JSX, useCallback, useMemo } from 'react';
import { ITabOption, TabView } from '../../../../view/tab-view.tsx';
import { MenuItemReviewsTab } from '../../../../reviews/menu-item-reviews-tab.tsx';
import { ReviewsTabTitle } from '../../../../reviews/reviews-tab-title.tsx';
import { SearchResultVisitHistory } from '../../../../search/schedule/search-result-visit-history.tsx';
import { CafeTypes } from '@msdining/common';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { MenuItemOverviewTab } from './menu-item-overview-tab.tsx';
import type { MenuItemPopupMode } from './menu-item-popup.tsx';

export const TAB_ID_OVERVIEW = 'overview';
export const TAB_ID_REVIEWS = 'reviews';
export const TAB_ID_HISTORY = 'history';

interface IMenuItemPopupBodyProps {
    menuItem: IMenuItemBase;
    notes: string;
    getSelectedChoiceIdsForModifier: (modifier: CafeTypes.IMenuItemModifier) => Set<string>;
    onSelectedChoiceIdsChanged: (modifier: CafeTypes.IMenuItemModifier, selection: Set<string>) => void;
    onNotesChanged: (notes: string) => void;
    isOnlineOrderingAllowed: boolean;
    /** Drives whether the modifier picker block is shown. See {@link MenuItemPopupMode}. */
    mode?: MenuItemPopupMode;
    showReviews: boolean;
    stationId?: string;
    stationName?: string;
    // Controlled by the popup so its footer can react to the active tab.
    selectedTabId: string;
    onSelectedTabChanged: (tabId: string) => void;
}

export const MenuItemPopupBody: React.FC<IMenuItemPopupBodyProps> = ({
    menuItem,
    notes,
    getSelectedChoiceIdsForModifier,
    onSelectedChoiceIdsChanged,
    onNotesChanged,
    isOnlineOrderingAllowed,
    mode = 'default',
    showReviews,
    stationId,
    stationName,
    selectedTabId,
    onSelectedTabChanged,
}) => {
    const isOrderReview = mode === 'orderReview';

    const lookup = useMemo(() => ({ menuItemId: menuItem.id, menuItemName: menuItem.name }), [menuItem.id, menuItem.name]);
    const stationLookup = useMemo(
        () => stationId ? { stationId, stationName: stationName ?? '' } : undefined,
        [stationId, stationName]
    );

    const tabOptions = useMemo(() => {
        const tabs: ITabOption[] = [
            { id: TAB_ID_OVERVIEW, name: isOnlineOrderingAllowed ? 'Overview & Order' : 'Overview' }
        ];

        if (showReviews) {
            tabs.push({ id: TAB_ID_REVIEWS, name: <ReviewsTabTitle lookup={lookup}/> });
        }

        tabs.push({ id: TAB_ID_HISTORY, name: 'Visit History' });

        return tabs;
    }, [isOnlineOrderingAllowed, showReviews, lookup]);

    const effectiveTabId = tabOptions.some(tab => tab.id === selectedTabId) ? selectedTabId : TAB_ID_OVERVIEW;

    const renderTab = useCallback((tabId: string): JSX.Element => {
        switch (tabId) {
        case TAB_ID_REVIEWS:
            return (
                <MenuItemReviewsTab
                    cafeId={menuItem.cafeId}
                    lookup={lookup}
                    stationLookup={stationLookup}
                />
            );
        case TAB_ID_HISTORY:
            return <SearchResultVisitHistory entityType={SearchEntityType.menuItem} name={menuItem.name}/>;
        case TAB_ID_OVERVIEW:
        default:
            return (
                <MenuItemOverviewTab
                    menuItem={menuItem}
                    notes={notes}
                    getSelectedChoiceIdsForModifier={getSelectedChoiceIdsForModifier}
                    onSelectedChoiceIdsChanged={onSelectedChoiceIdsChanged}
                    onNotesChanged={onNotesChanged}
                    isOnlineOrderingAllowed={isOnlineOrderingAllowed}
                    isOrderReview={isOrderReview}
                />
            );
        }
    }, [menuItem, notes, getSelectedChoiceIdsForModifier, onSelectedChoiceIdsChanged, onNotesChanged, isOnlineOrderingAllowed, isOrderReview, lookup, stationLookup]);

    return (
        <div className="menu-item-popup-body">
            <TabView
                options={tabOptions}
                selectedTabId={effectiveTabId}
                onTabIdChanged={onSelectedTabChanged}
                renderTab={renderTab}
                enableSwipe
            />
        </div>
    );
};
