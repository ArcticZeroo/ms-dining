import React, { useMemo } from 'react';
import { useDatePicker } from '../../../hooks/date-picker.tsx';
import { CafeView } from '../../../models/cafe.ts';
import { CombinedCafeMenuList } from '../../cafes/combined-cafe-menu-list.tsx';

interface ICafePageWithViewProps {
    view: CafeView;
}

export const CafeViewPageWithView: React.FC<ICafePageWithViewProps> = ({ view }) => {
    const views = useMemo(() => [view], [view]);
    const datePicker = useDatePicker();

    return (
        <>
            {datePicker}
            <CombinedCafeMenuList
                views={views}
                countTowardsLastUsed={true}
                // The user should already know what group this is in because they clicked on it.
                showGroupNames={false}
            />
        </>
    );
};