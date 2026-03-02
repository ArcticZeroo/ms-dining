import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import {
    IRecommendationsResponse,
    RECOMMENDATION_SECTION_DISPLAY_NAMES,
    RecommendationSectionType
} from '@msdining/common/models/recommendation';
import { toDateString } from '@msdining/common/util/date-util';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../../../api/client/dining.ts';
import { ApplicationSettings } from '../../../../constants/settings.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifier, useValueNotifierContext } from '../../../../hooks/events.ts';
import { useTitleWithSelectedDate } from '../../../../hooks/string.ts';
import { RetryButton } from '../../../button/retry-button.tsx';
import { ITabOption, TabView } from '../../../view/tab-view.tsx';
import { HomeCollapse } from '../home-collapse.tsx';
import { FavoritesSectionView } from './favorites-section-view.tsx';
import { RecommendationSectionView } from './recommendation-section-view.tsx';
import { useFavoritesSection } from '../../../../hooks/recommendations.js';
import { RecommendationSectionItemsSkeleton } from './recommendation-section-items-skeleton.js';

const FAVORITES_TAB_ID = RecommendationSectionType.favorites;
const LOADING_TAB_COUNT_WHILE_FETCHING = 3;

const useRecommendations = () => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const dateString = toDateString(selectedDate);

    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);

    const retrieveRecommendations = useCallback(async () => {
        return DiningClient.retrieveRecommendations(dateString, homepageViewIds);
    }, [dateString, homepageViewIds]);

    const recommendationsState = useDelayedPromiseState(
        retrieveRecommendations,
        true /*keepLastValue*/
    );

    const { run } = recommendationsState;
    useEffect(() => {
        run();
    }, [run]);

    return recommendationsState;
}

// --- Main view ---

const useTabOptions = (shouldShowFavorites: boolean, recommendations: IRecommendationsResponse | undefined) => {
    return useMemo(() => {
        const options: Array<{ id: string; name: string }> = [];

        if (shouldShowFavorites) {
            options.push({
                id:   FAVORITES_TAB_ID,
                name: RECOMMENDATION_SECTION_DISPLAY_NAMES[RecommendationSectionType.favorites],
            });
        }

        if (recommendations) {
            for (const section of recommendations.sections) {
                options.push({
                    id:   section.type,
                    name: section.title,
                });
            }
        }

        return options;
    }, [recommendations, shouldShowFavorites]);
}

const useSelectedTabState = (tabOptions: ITabOption[]) => {
    const [selectedTabId, setSelectedTabId] = useState<string>('');

    // Auto-select first tab when options change and current selection is invalid
    useEffect(() => {
        if (tabOptions.length > 0 && !tabOptions.some(option => option.id === selectedTabId)) {
            setSelectedTabId(tabOptions[0]!.id);
        }
    }, [tabOptions, selectedTabId]);
    
    return [selectedTabId, setSelectedTabId] as const;
}

export const HomeRecommendationsView: React.FC = () => {
    const title = useTitleWithSelectedDate('Recommended for You');

    const favorites = useFavoritesSection();
    const {
        stage: recommendationsStage,
        value: recommendationsValue,
        actualStage: recommendationsActualStage,
        run: recommendationsRun,
    } = useRecommendations();

    const isRecommendationsLoading = !recommendationsValue && recommendationsStage !== PromiseStage.error;

    const tabOptions = useTabOptions(favorites.shouldShow, recommendationsValue);
    const [selectedTabId, setSelectedTabId] = useSelectedTabState(tabOptions);
    const loadingTabCount = isRecommendationsLoading ? LOADING_TAB_COUNT_WHILE_FETCHING : 0;

    const renderTab = useCallback((tabId: string) => {
        if (tabId === FAVORITES_TAB_ID && favorites.shouldShow) {
            return <FavoritesSectionView favorites={favorites}/>;
        }

        if (recommendationsValue) {
            const section = recommendationsValue.sections.find(section => section.type === tabId);
            if (section) {
                return <RecommendationSectionView section={section}/>;
            }
        }

        if (recommendationsStage === PromiseStage.error) {
            return (
                <div className="error-card">
                    <span>Could not load recommendations.</span>
                    <span className="centered-content">
                        <RetryButton onClick={recommendationsRun} isDisabled={recommendationsActualStage !== PromiseStage.error}/>
                    </span>
                </div>
            );
        }

        return <RecommendationSectionItemsSkeleton/>;
    }, [favorites, recommendationsValue, recommendationsStage, recommendationsActualStage, recommendationsRun]);

    return (
        <HomeCollapse
            title={title}
            id="home-recommendations"
        >
            <TabView
                options={tabOptions}
                selectedTabId={selectedTabId}
                onTabIdChanged={setSelectedTabId}
                renderTab={renderTab}
                loadingTabCount={loadingTabCount}
            />
        </HomeCollapse>
    );
};
