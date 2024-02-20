import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { CafeView } from '../../models/cafe.ts';
import { expandAndFlattenView } from '../../util/view.ts';
import { MenuSettings } from '../settings/menu-settings.tsx';
import { CollapsibleCafeMenu } from './collapsible-cafe-menu.tsx';
import { CartPopup } from '../order/cart/cart-popup.tsx';
import './combined-cafes.css';

interface ICombinedCafeMenuListProps {
    views: Iterable<CafeView>;
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

    return (
        <div className="collapsible-menu-list">
            {
                cafes.map(cafe => (
                    <CollapsibleCafeMenu
                        key={cafe.id}
                        cafe={cafe}
                        showGroupName={showGroupNames}
                        shouldCountTowardsLastUsed={countTowardsLastUsed}
                    />
                ))
            }
            <MenuSettings/>
            <div className="centered-content">
                <button className="default-container flex default-button">
                    <span className="material-symbols-outlined">
                        settings
                    </span>
                    <span>
                        More Settings
                    </span>
                </button>
            </div>
            <CartPopup/>
        </div>
    );
};