import React, { useContext } from 'react';
import { CurrentCafeContext } from '../../context/menu-item.ts';
import { RetryButton } from '../button/retry-button.tsx';
import { StationList } from './station/station-list.tsx';
import { StationListSkeleton } from '../skeleton/station-list-skeleton.tsx';
import { IngredientsInfoBanner } from './station/ingredients-menu-view.tsx';
import { ICafeMenuView } from './cafe-menu-view.tsx';

interface ICollapsibleCafeMenuBodyProps {
    isExpanded: boolean;
    menuData: ICafeMenuView;
}

export const CafeMenuBody: React.FC<ICollapsibleCafeMenuBodyProps> = ({
    isExpanded,
    menuData: { data, isError, refetch }
}) => {
    const cafe = useContext(CurrentCafeContext);
    const isIngredients = cafe.id === 'in-gredients';

    if (!isExpanded) {
        return null;
    }

    if (isError) {
        return (
            <div className="cafe-error centered-content collapse-body">
                Failed to load menu.
                <br/>
                <RetryButton onClick={refetch}/>
            </div>
        );
    }

    if (data != null) {
        return (
            <>
                {isIngredients && <IngredientsInfoBanner/>}
                <StationList
                    stations={data.stations}
                    isAvailable={data.isAvailable}
                    shutdownState={data.shutdownState}
                    ingredientsMenu={data?.ingredientsMenu}
                />
            </>
        );
    }

    return (
        <StationListSkeleton/>
    );
}