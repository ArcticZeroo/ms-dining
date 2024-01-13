import React, { useEffect, useMemo } from 'react';
import { useDatePicker } from '../../../hooks/date-picker.tsx';
import { CafeView } from '../../../models/cafe.ts';
import { CombinedCafeMenuList } from '../../cafes/combined-cafe-menu-list.tsx';
import { setPageSubtitle } from '../../../util/title.ts';

interface ICafePageWithViewProps {
    view: CafeView;
}

export const CafeViewPageWithView: React.FC<ICafePageWithViewProps> = ({ view }) => {
    // Avoids constant re-renders of the menu list since the view is a new object every time
    const views = useMemo(() => [view], [view]);
    const datePicker = useDatePicker();

    useEffect(() => {
        setPageSubtitle(view.value.name);
    }, [view]);

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