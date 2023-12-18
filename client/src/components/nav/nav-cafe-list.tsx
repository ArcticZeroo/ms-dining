import React, { useContext, useMemo } from 'react';

import { NavLink } from 'react-router-dom';
import { getViewUrl } from '../../util/link.ts';
import { useViewsByGroupId, useVisibleViews } from '../../hooks/views.ts';
import { CafeView } from '../../models/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ApplicationSettings } from '../../api/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { classNames } from '../../util/react.ts';
import { NavNumberedCafeList } from './nav-numbered-cafe-list.tsx';

interface INavViewLinkProps {
    view: CafeView;

    onViewSelected(view: CafeView): void;
}

const NavViewLink: React.FC<INavViewLinkProps> = ({ view, onViewSelected }) => (
    <li key={view.value.id} className="cafe" title={`Menu for ${view.value.name}`}>
        <NavLink to={getViewUrl(view)}
                 onClick={() => onViewSelected(view)}>
            {view.value.name}
        </NavLink>
    </li>
);

interface INavCafeListProps {
    onViewSelected(view: CafeView): void;
}

export const NavCafeList: React.FC<INavCafeListProps> = ({ onViewSelected }) => {
    const { viewsById } = useContext(ApplicationContext);
    const visibleViews = useVisibleViews();
    const viewsByGroupId = useViewsByGroupId();
    const shouldCondenseNumbers = useValueNotifier(ApplicationSettings.shouldCondenseNumbers);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const viewNumbersById = useMemo(() => {
        const viewNumbersById = new Map<string, number>();

        for (const view of visibleViews) {
            if (view.value.number != null) {
                viewNumbersById.set(view.value.id, view.value.number);
            }
        }

        return viewNumbersById;
    }, [visibleViews]);

    if (!shouldUseGroups) {
        const groupIds = Array.from(viewsByGroupId.keys()).sort();

        return groupIds.map(groupId => (
            <ul className={classNames('expandable-nav-list', 'group')} key={groupId}>
                <li className="view-group-name">
                    {viewsById.get(groupId)?.value.name ?? 'Unknown Group'}
                </li>
                {
                    viewsByGroupId.get(groupId)!.map(view => (
                        <NavViewLink key={view.value.id}
                                     view={view}
                                     onViewSelected={onViewSelected}/>
                    ))
                }
            </ul>
        ));
    }

    return (
        <ul className="expandable-nav-list">
            {
                shouldCondenseNumbers && <NavNumberedCafeList viewNumbersById={viewNumbersById}/>
            }
            {
                visibleViews?.map?.(view => (
                    (!shouldCondenseNumbers || view.value.number == null) &&
                    <NavViewLink key={view.value.id}
                                 view={view}
                                 onViewSelected={onViewSelected}/>
                ))
            }
        </ul>
    );
};