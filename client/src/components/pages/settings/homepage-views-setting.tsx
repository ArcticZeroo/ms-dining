import { ApplicationSettings } from '../../../api/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { useVisibleViews } from '../../../hooks/views.ts';
import { CafeView } from '../../../models/cafe.ts';

export const HomepageViewsSetting = () => {
	const visibleViews = useVisibleViews();
	const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);

	const toggleHomepageView = (view: CafeView) => {
		const viewId = view.value.id;
		if (homepageViewIds.has(viewId)) {
			ApplicationSettings.homepageViews.delete(viewId);
		} else {
			ApplicationSettings.homepageViews.add(viewId);
		}
	};

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
			<div className="setting-chips">
				{
					visibleViews.map(view => {
						const viewId = view.value.id;
						const htmlId = `setting-homepage-option-${viewId}`;
						const isChecked = homepageViewIds.has(viewId);
						return (
							<div className="setting-chip" key={viewId}>
								<label htmlFor={htmlId}>
									{view.value.name}
								</label>
								<input type="checkbox"
									   id={htmlId}
									   checked={isChecked}
									   onChange={() => toggleHomepageView(view)}/>
							</div>
						);
					})
				}
			</div>
		</div>
	);
};