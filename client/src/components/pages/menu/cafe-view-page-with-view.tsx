import React, { useContext, useEffect, useState } from 'react';
import { ApplicationContext } from '../../../context/app';
import { CafeView, ICafe } from '../../../models/cafe.ts';
import { expandAndFlattenView } from '../../../util/view';
import { CombinedCafeMenuList } from '../../dining-halls/combined-cafe-menu-list.tsx';

interface ICafePageWithViewProps {
    view: CafeView;
}

export const CafeViewPageWithView: React.FC<ICafePageWithViewProps> = ({ view }) => {
    const { viewsById } = useContext(ApplicationContext);
    const [cafes, setCafes] = useState<Array<ICafe>>([]);

    useEffect(() => {
        setCafes(expandAndFlattenView(view, viewsById));
    }, [view, viewsById]);

    return (
        <CombinedCafeMenuList cafes={cafes} countTowardsLastUsed={true}/>
    );
};