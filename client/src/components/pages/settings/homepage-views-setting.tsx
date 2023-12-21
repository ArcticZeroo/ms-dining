import { useCallback, useMemo } from 'react';
import { ApplicationSettings } from '../../../api/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { useViewsForNav } from '../../../hooks/views.ts';
import { HomepageViewChip } from './homepage-view-chip.tsx';

export const HomepageViewsSetting = () => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const views = useViewsForNav();

    const toggleHomepageView = useCallback((viewId: string) => {
        if (homepageViewIds.has(viewId)) {
            ApplicationSettings.homepageViews.delete(viewId);
        } else {
            ApplicationSettings.homepageViews.add(viewId);
        }
    }, [homepageViewIds]);

    const chipsElement = useMemo(() => {
        return (
            <div className="setting-chips">
                {
                    views.map(view => (
                        <HomepageViewChip key={view.value.id}
                                          viewName={view.value.name}
                                          viewId={view.value.id}
                                          homepageViewIds={homepageViewIds}
                                          onToggleClicked={() => toggleHomepageView(view.value.id)}/>
                    ))
                }
            </div>
        );
    }, [homepageViewIds, toggleHomepageView, views]);

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