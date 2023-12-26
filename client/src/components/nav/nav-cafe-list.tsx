import React, { useMemo } from 'react';

import { NavLink } from 'react-router-dom';
import { ApplicationSettings } from '../../api/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { useViewsForNav } from '../../hooks/views.ts';
import { CafeView } from '../../models/cafe.ts';
import { getViewMenuUrl } from '../../util/link.ts';
import { NavNumberedCafeList } from './nav-numbered-cafe-list.tsx';

interface INavViewLinkProps {
	view: CafeView;

	onViewSelected(view: CafeView): void;
}

const NavViewLink: React.FC<INavViewLinkProps> = ({ view, onViewSelected }) => (
	<li key={view.value.id} className="cafe" title={`Menu for ${view.value.name}`}>
		<NavLink to={getViewMenuUrl(view)}
				 onClick={() => onViewSelected(view)}>
			{view.value.name}
		</NavLink>
	</li>
);

interface INavCafeListProps {
	onViewSelected(view: CafeView): void;
}

export const NavCafeList: React.FC<INavCafeListProps> = ({ onViewSelected }) => {
	const views = useViewsForNav();
	const shouldCondenseNumbers = useValueNotifier(ApplicationSettings.shouldCondenseNumbers);

	const viewNumbersById = useMemo(() => {
		const viewNumbersById = new Map<string, number>();

		for (const view of views) {
			if (view.value.number != null) {
				viewNumbersById.set(view.value.id, view.value.number);
			}
		}

		return viewNumbersById;
	}, [views]);

	return (
		<ul className="expandable-nav-list">
			{
				shouldCondenseNumbers && <NavNumberedCafeList viewNumbersById={viewNumbersById}/>
			}
			{
				views.map(view => (
					(!shouldCondenseNumbers || view.value.number == null) &&
					<NavViewLink key={view.value.id}
								 view={view}
								 onViewSelected={onViewSelected}/>
				))
			}
		</ul>
	);
};