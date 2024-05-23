import React, { useEffect, useMemo } from 'react';
import { useDatePicker } from '../../../hooks/date-picker.tsx';
import { CafeView } from '../../../models/cafe.ts';
import { setPageData } from '../../../util/title.ts';
import { MoreSettingsButton } from '../../button/more-settings-button.tsx';
import { CombinedCafeMenuList } from '../../cafes/combined-cafe-menu-list.tsx';
import { getViewLocation } from '../../../util/cafe.ts';

interface ICafePageWithViewProps {
    view: CafeView;
}

export const CafeViewPageWithView: React.FC<ICafePageWithViewProps> = ({ view }) => {
    // Avoids constant re-renders of the menu list since the array is a new instance on every re-render
    const views = useMemo(() => [view], [view]);
    const datePicker = useDatePicker();
    const suggestedLocationCenter = useMemo(() => getViewLocation(view), [view]);

    useEffect(() => {
        setPageData(view.value.name, `View the cafe menu for ${view.value.name} on Microsoft Redmond Campus.`);
    }, [view]);

    return (
        <>
            {datePicker}
            <CombinedCafeMenuList
                views={views}
                countTowardsLastUsed={true}
                // The user should already know what group this is in because they clicked on it.
                showGroupNames={false}
                suggestedLocationCenter={suggestedLocationCenter}
            />
            <MoreSettingsButton/>
        </>
    );
};