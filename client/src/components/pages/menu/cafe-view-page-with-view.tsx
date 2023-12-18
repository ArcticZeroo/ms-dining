import React, { useMemo } from 'react';
import { CafeView } from '../../../models/cafe.ts';
import { CombinedCafeMenuList } from '../../dining-halls/combined-cafe-menu-list.tsx';

interface ICafePageWithViewProps {
    view: CafeView;
}

export const CafeViewPageWithView: React.FC<ICafePageWithViewProps> = ({ view }) => {
    const views = useMemo(() => [view], [view]);

    return (
        <CombinedCafeMenuList
            views={views}
            countTowardsLastUsed={true}
            // The user should already know what group this is in because they clicked on it.
            showGroupNames={false}
        />
    );
};