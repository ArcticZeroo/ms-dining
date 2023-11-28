import { useContext, useMemo } from 'react';
import { ApplicationSettings } from '../../../api/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { useViewsByGroupId, useVisibleViews } from '../../../hooks/views.ts';
import { CafeView } from '../../../models/cafe.ts';
import { HomepageViewChip } from './homepage-view-chip.tsx';

export const HomepageViewsSetting = () => {
	const visibleViews = useVisibleViews();
	const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
	const { viewsById } = useContext(ApplicationContext);
	const viewsByGroupId = useViewsByGroupId();
	const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

	const toggleHomepageView = (view: CafeView) => {
		const viewId = view.value.id;
		if (homepageViewIds.has(viewId)) {
			ApplicationSettings.homepageViews.delete(viewId);
		} else {
			ApplicationSettings.homepageViews.add(viewId);
		}
	};

	const chipsElement = useMemo(() => {
		if (shouldUseGroups) {
			return (
				<div className="setting-chips">
					{
						visibleViews.map(view => (
							<HomepageViewChip key={view.value.id}
											  view={view}
											  homepageViewIds={homepageViewIds}
											  onToggleClicked={() => toggleHomepageView(view)}/>
						))
					}
				</div>
			);
		}

		const groupIds = Array.from(viewsByGroupId.keys()).sort();

		return groupIds.map(groupId => (
			<div className="group" key={groupId}>
				<div className="view-group-name">
					{viewsById.get(groupId)?.value.name ?? 'Unknown Group'}
				</div>
				<div className="setting-chips">
					{
						viewsByGroupId.get(groupId)!.map(view => (
							<HomepageViewChip key={view.value.id}
											  view={view}
											  homepageViewIds={homepageViewIds}
											  onToggleClicked={() => toggleHomepageView(view)}/>
						))
					}
				</div>
			</div>
		));
	}, [shouldUseGroups, homepageViewIds, viewsById, viewsByGroupId, visibleViews]);

	return (
		<div className="setting" id="setting-homepage">
			<div className="setting-info">
				<div className="setting-name">
                            <span className="material-symbols-outlined">
                                home
                            </span>
					Homepage Views
				</div>
				<div className="setting-description">
					Select the views that you want to appear on the homepage.
				</div>
			</div>
			{chipsElement}
		</div>
	);
};