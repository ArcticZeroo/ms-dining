import React, { useEffect } from 'react';
import { useDatePicker } from '../../../hooks/date-picker.tsx';
import { CafeView } from '../../../models/cafe.ts';
import { setPageData } from '../../../util/title.ts';
import { MoreSettingsButton } from '../../button/more-settings-button.tsx';
import { CombinedCafeMenuList } from '../../cafes/combined-cafe-menu-list.tsx';

interface ICafePageWithViewProps {
    views: CafeView[];
}

export const MenuPageWithViews: React.FC<ICafePageWithViewProps> = ({ views }) => {
    const datePicker = useDatePicker();

    useEffect(() => {
        const viewNames = views.map(view => view.value.name).join(' + ');
        setPageData(viewNames, `View the cafe menu for ${viewNames} on Microsoft Redmond Campus.`);
    }, [views]);

    return (
        <>
            {datePicker}
            <CombinedCafeMenuList
                views={views}
                countTowardsLastUsed={true}
                // The user should already know what group this is in because they clicked on it.
                showGroupNames={false}
            />
            <MoreSettingsButton/>
        </>
    );
};