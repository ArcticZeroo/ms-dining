import React, { useContext, useEffect, useState } from 'react';
import { ApplicationContext } from '../../../context/app';
import { CafeView } from '../../../models/cafe.ts';
import { expandAndFlattenView } from '../../../util/view';
import { CombinedCafeMenuList } from '../../dining-halls/combined-cafe-menu-list.tsx';

interface ICafePageWithViewProps {
    view: CafeView;
}

export const CafeViewPageWithView: React.FC<ICafePageWithViewProps> = ({ view }) => {
    const { viewsById } = useContext(ApplicationContext);
    const [cafeIds, setCafeIds] = useState<Array<string>>([]);

    useEffect(() => {
        const cafes = expandAndFlattenView(view, viewsById);
        setCafeIds(cafes.map(diningHall => diningHall.id));
    }, [view.value.id]);

    return (
        <CombinedCafeMenuList cafeIds={cafeIds} countTowardsLastUsed={true}/>
    );
};