import { useCallback, useContext, useMemo } from 'react';
import { ApplicationSettings } from '../../../api/settings.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { HomepageViewChip } from './homepage-view-chip.tsx';

export const HomepageViewsSetting = () => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const { groups } = useContext(ApplicationContext);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    const toggleHomepageView = useCallback((viewId: string) => {
        if (homepageViewIds.has(viewId)) {
            ApplicationSettings.homepageViews.delete(viewId);
        } else {
            ApplicationSettings.homepageViews.add(viewId);
        }
    }, [homepageViewIds]);

    const chipsElement = useMemo(() => {
        if (shouldUseGroups) {
            return (
                <div className="setting-chips">
                    {
                        groups.map(group => (
                            <HomepageViewChip key={group.id}
                                              viewName={group.name}
                                              viewId={group.id}
                                              homepageViewIds={homepageViewIds}
                                              onToggleClicked={() => toggleHomepageView(group.id)}/>
                        ))
                    }
                </div>
            );
        }

        return groups.map(group => (
            <div className="group" key={group.id}>
                <div className="view-group-name">
                    {group.name}
                </div>
                <div className="setting-chips">
                    {
                        group.members.map(cafe => (
                            <HomepageViewChip key={cafe.id}
                                              viewName={cafe.name}
                                              viewId={cafe.id}
                                              homepageViewIds={homepageViewIds}
                                              onToggleClicked={() => toggleHomepageView(cafe.id)}/>
                        ))
                    }
                </div>
            </div>
        ));
    }, [groups, shouldUseGroups, homepageViewIds, toggleHomepageView]);

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