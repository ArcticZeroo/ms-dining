import React, { useMemo } from 'react';

import { NavLink } from 'react-router-dom';
import { ApplicationSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { useViewsForNav } from '../../hooks/views.ts';
import { CafeView, CafeViewType, ICafeGroup } from '../../models/cafe.ts';
import { getViewMenuUrl } from '../../util/link.ts';
import { classNames } from '../../util/react.ts';
import { NavNumberedCafeList } from './nav-numbered-cafe-list.tsx';

interface INavViewLinkProps {
    view: CafeView;
}

const NavViewLink: React.FC<INavViewLinkProps> = ({ view }) => (
    <li key={view.value.id} className="cafe" title={`Menu for ${view.value.name}`}>
        <NavLink to={getViewMenuUrl(view)}>
            {view.value.name}
        </NavLink>
    </li>
);

export const NavCafeList: React.FC = () => {
    const views = useViewsForNav();
    const shouldCondenseNumbers = useValueNotifier(ApplicationSettings.shouldCondenseNumbers);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const viewNumbersById = useMemo(() => {
        const viewNumbersById = new Map<string, number>();

        for (const view of views) {
            if (typeof view.value.shortName === 'number') {
                viewNumbersById.set(view.value.id, view.value.shortName);
            }
        }

        return viewNumbersById;
    }, [views]);

    const nonCondensedViews = useMemo(
        () => {
            if (!shouldCondenseNumbers) {
                return views;
            }

            return views.filter(view => typeof view.value.shortName !== 'number');
        },
        [views, shouldCondenseNumbers]
    );

    const nonNumberedViewDisplay = useMemo(
        () => {
            if (!shouldUseGroups) {
                const groupedViews = new Map<ICafeGroup, Array<CafeView>>();

                for (const view of nonCondensedViews) {
                    if (view.type === CafeViewType.group) {
                        console.error(`Unexpected group view with shouldUseGroups=false: ${view.value.name}`);
                        continue;
                    }

                    const group = view.value.group;
                    if (group == null) {
                        console.error(`Unexpected view with no group: ${view.value.name}`);
                        continue;
                    }

                    if (!groupedViews.has(group)) {
                        groupedViews.set(group, []);
                    }

                    groupedViews.get(group)!.push(view);
                }

                return Array.from(groupedViews.entries()).map(([group, views]) => (
                    <ul className={classNames('expandable-nav-list', 'group')} key={group.id}>
                        <li className="view-group-name">
                            {group.name}
                        </li>
                        {
                            views.map(cafeView => (
                                <NavViewLink key={cafeView.value.id} view={cafeView}/>
                            ))
                        }
                    </ul>
                ));
            }

            return nonCondensedViews.map(view => <NavViewLink key={view.value.id} view={view}/>)
        },
        [nonCondensedViews, shouldUseGroups]
    );

    return (
        <ul className="expandable-nav-list" id="cafe-list">
            {
                shouldCondenseNumbers && <NavNumberedCafeList viewNumbersById={viewNumbersById}/>
            }
            { nonNumberedViewDisplay }
        </ul>
    );
};