import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { CafeView } from '../../models/cafe.ts';
import { expandAndFlattenView, getViewLocation } from '../../util/view.ts';
import { CartPopup } from '../order/cart/cart-popup.tsx';
import { MenuSettings } from '../settings/menu-settings.tsx';
import { CafeMenuView } from './cafe-menu-view.tsx';
import { NextCafeSuggestions } from './next-cafe-suggestions.tsx';
import './combined-cafes.css';

interface ICombinedCafeMenuListProps {
    views: CafeView[];
    countTowardsLastUsed: boolean;
    showGroupNames: boolean;
}

export const CombinedCafeMenuList: React.FC<ICombinedCafeMenuListProps> = ({
    views,
    countTowardsLastUsed,
    showGroupNames
}) => {
    const { viewsById } = useContext(ApplicationContext);

    const cafes = useMemo(
        () => Array.from(views).flatMap(view => expandAndFlattenView(view, viewsById)),
        [views, viewsById]
    );
    
    const viewLocations = useMemo(
        () => views.map(getViewLocation),
        [views]
    );

    return (
        <>
            <div className="collapsible-menu-list">
                {
                    cafes.map(cafe => (
                        <CafeMenuView
                            key={cafe.id}
                            cafe={cafe}
                            showGroupName={showGroupNames}
                            shouldCountTowardsLastUsed={countTowardsLastUsed}
                        />
                    ))
                }
            </div>
            <NextCafeSuggestions excludeViews={views} locations={viewLocations}/>
            <MenuSettings/>
            <CartPopup/>
        </>
    );
};