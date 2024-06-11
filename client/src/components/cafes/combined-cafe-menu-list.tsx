import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { CafeView } from '../../models/cafe.ts';
import { expandAndFlattenView } from '../../util/view.ts';
import { CartPopup } from '../order/cart/cart-popup.tsx';
import { MenuSettings } from '../settings/menu-settings.tsx';
import { CafeMenu } from './cafe-menu.tsx';
import { NextCafeSuggestions } from './next-cafe-suggestions.tsx';
import './combined-cafes.css';
import { ILocationCoordinates } from '@msdining/common/dist/models/util';

interface ICombinedCafeMenuListProps {
    views: CafeView[];
    countTowardsLastUsed: boolean;
    showGroupNames: boolean;
    suggestedLocationCenter?: ILocationCoordinates;
}

export const CombinedCafeMenuList: React.FC<ICombinedCafeMenuListProps> = ({
    views,
    countTowardsLastUsed,
    showGroupNames,
    suggestedLocationCenter
}) => {
    const { viewsById } = useContext(ApplicationContext);

    const cafes = useMemo(
        () => Array.from(views).flatMap(view => expandAndFlattenView(view, viewsById)),
        [views, viewsById]
    );

    return (
        <>
            <div className="collapsible-menu-list">
                {
                    cafes.map(cafe => (
                        <CafeMenu
                            key={cafe.id}
                            cafe={cafe}
                            showGroupName={showGroupNames}
                            shouldCountTowardsLastUsed={countTowardsLastUsed}
                        />
                    ))
                }
            </div>
            <NextCafeSuggestions excludeViews={views} location={suggestedLocationCenter}/>
            <MenuSettings/>
            <CartPopup/>
        </>
    );
};