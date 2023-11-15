import React, { useContext } from 'react';

import { NavLink } from 'react-router-dom';
import { getViewUrl } from '../../util/link.ts';
import { useViewsByGroupId, useVisibleViews } from '../../hooks/views.ts';
import { CafeView } from '../../models/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ApplicationSettings } from '../../api/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { classNames } from '../../util/react.ts';

interface INavViewLinkProps {
    view: CafeView;

    onViewSelected(view: CafeView): void;
}

const NavViewLink: React.FC<INavViewLinkProps> = ({ view, onViewSelected }) => (
    <li key={view.value.id} className="cafe">
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
    const shouldUseGroups = useValueNotifier(ApplicationSettings.useGroups);

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
                visibleViews?.map?.(view => (
                    <NavViewLink key={view.value.id}
                        view={view}
                        onViewSelected={onViewSelected}/>
                ))
            }
        </ul>
    );
};