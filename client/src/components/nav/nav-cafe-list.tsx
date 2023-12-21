import React, { useContext, useMemo } from 'react';

import { NavLink } from 'react-router-dom';
import { getViewUrl } from '../../util/link.ts';
import { CafeView } from '../../models/cafe.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { ApplicationSettings } from '../../api/settings.ts';
import { ApplicationContext } from '../../context/app.ts';
import { classNames } from '../../util/react.ts';
import { NavNumberedCafeList } from './nav-numbered-cafe-list.tsx';
import { useVisibleViews } from '../../hooks/views.ts';

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
    const { groups, viewsById } = useContext(ApplicationContext);
    const shouldCondenseNumbers = useValueNotifier(ApplicationSettings.shouldCondenseNumbers);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    const visibleViews = useVisibleViews();

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
        return groups.map(group => (
            <ul className={classNames('expandable-nav-list', 'group')} key={group.id}>
                <li className="view-group-name">
                    {group.name}
                </li>
                {
                    group.members.map(cafe => (
                        <NavViewLink key={cafe.id}
                                     view={viewsById.get(cafe.id)!}
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