import React, { useContext, useEffect, useState } from 'react';
import { ApplicationContext } from '../../../context/app';
import { DiningHallView } from '../../../models/dining-halls.ts';
import { expandAndFlattenView } from '../../../util/view';
import { CombinedDiningHallMenuList } from '../../dining-halls/combined-dining-hall-menu-list';

interface IDiningHallPageWithViewProps {
    view: DiningHallView;
}

export const DiningHallPageWithView: React.FC<IDiningHallPageWithViewProps> = ({ view }) => {
    const { viewsById } = useContext(ApplicationContext);
    const [diningHallIds, setDiningHallIds] = useState<Array<string>>([]);

    useEffect(() => {
        const diningHalls = expandAndFlattenView(view, viewsById);
        setDiningHallIds(diningHalls.map(diningHall => diningHall.id));
    }, [view.value.id]);

    return (
        <CombinedDiningHallMenuList diningHallIds={diningHallIds} countTowardsLastUsed={true}/>
    );
};