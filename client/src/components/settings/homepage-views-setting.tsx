import React, { useCallback, useMemo, useState } from 'react';
import { ApplicationSettings } from '../../api/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { useViewsForNav } from '../../hooks/views.ts';
import { HomepageViewChip } from './homepage-view-chip.tsx';

import '../pages/settings/settings.css';

interface IHomepageViewsSettingProps {
	requireButtonToCommit?: boolean;
}

export const HomepageViewsSetting: React.FC<IHomepageViewsSettingProps> = ({ requireButtonToCommit = false }) => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const views = useViewsForNav();
    const [localHomepageViewIds, setLocalHomepageViewIds] = useState(new Set(homepageViewIds.values()));

    const toggleViewInLocalState = useCallback((viewId: string) => {
        const newLocalHomepageViewIds = new Set(localHomepageViewIds);

        if (localHomepageViewIds.has(viewId)) {
            newLocalHomepageViewIds.delete(viewId);
        } else {
            newLocalHomepageViewIds.add(viewId);
        }

        setLocalHomepageViewIds(newLocalHomepageViewIds);
    }, [localHomepageViewIds]);

    const toggleViewInGlobalState = useCallback((viewId: string) => {
        if (homepageViewIds.has(viewId)) {
            ApplicationSettings.homepageViews.delete(viewId);
        } else {
            ApplicationSettings.homepageViews.add(viewId);
        }
    }, [homepageViewIds]);

    const toggleHomepageView = useCallback((viewId: string) => {
        if (requireButtonToCommit) {
            toggleViewInLocalState(viewId);
        } else {
            toggleViewInGlobalState(viewId);
        }
    }, [requireButtonToCommit, toggleViewInLocalState, toggleViewInGlobalState]);

    const sourceHomepageViewIds = requireButtonToCommit ? localHomepageViewIds : homepageViewIds;

    const onCommit = () => {
        if (!requireButtonToCommit) {
            return;
        }

        ApplicationSettings.homepageViews.value = localHomepageViewIds;
    };

    const chipsElement = useMemo(() => {
        return (
            <div className="setting-chips">
                {
                    views.map(view => (
                        <HomepageViewChip key={view.value.id}
										  viewName={view.value.name}
										  viewId={view.value.id}
										  homepageViewIds={sourceHomepageViewIds}
										  onToggleClicked={() => toggleHomepageView(view.value.id)}/>
                    ))
                }
            </div>
        );
    }, [sourceHomepageViewIds, toggleHomepageView, views]);

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
            {
                requireButtonToCommit && (
										  <button onClick={onCommit} id="homepage-views-commit-button">
											  Save Homepage Views
										  </button>
									  )
            }
        </div>
    );
};