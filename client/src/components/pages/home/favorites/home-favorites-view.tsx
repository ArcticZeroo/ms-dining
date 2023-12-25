import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { ISearchQuery } from '@msdining/common/dist/models/search.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DiningClient } from '../../../../api/dining.ts';
import { SelectedDateContext } from '../../../../context/time.ts';
import { useValueNotifierContext } from '../../../../hooks/events.ts';
import { classNames } from '../../../../util/react.ts';
import { isAnyDateToday } from '../../../../util/search.ts';
import { ExpandIcon } from '../../../icon/expand.tsx';
import { HomeFavoriteResult } from './home-favorite-result.tsx';

const useFavoriteSearchResults = (queries: ISearchQuery[]) => {
	const selectedDate = useValueNotifierContext(SelectedDateContext);

	const retrieveFavoriteSearchResults = useCallback(async () => {
		if (queries.length === 0) {
			return [];
		}

		return DiningClient.retrieveFavoriteSearchResults(queries);
	}, [queries]);

	const { stage, value, run } = useDelayedPromiseState(
		retrieveFavoriteSearchResults,
		true /*keepLastValue*/
	);

	useEffect(() => {
		run();
	}, [run]);

	const filteredResults = useMemo(
		() => {
			const results = value ?? [];
			return results.filter(item => isAnyDateToday(item.locationDatesByCafeId, selectedDate));
		},
		[value, selectedDate]
	);

	return { stage, results: filteredResults } as const;
};

interface IHomeFavoritesViewProps {
	queries: ISearchQuery[];
}

export const HomeFavoritesView: React.FC<IHomeFavoritesViewProps> = ({ queries }) => {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const selectedDate = useValueNotifierContext(SelectedDateContext);

	const onToggleExpansion = () => {
		setIsCollapsed(!isCollapsed);
	};

	const { stage, results } = useFavoriteSearchResults(queries);

	const bodyView = useMemo(() => {
		if (stage === PromiseStage.running) {
			return (
				<div className="centered-content">
					<span className="loading-spinner"/>
					Loading favorites...
				</div>
			);
		}

		if (stage === PromiseStage.error) {
			return (
				<div className="error-card">
					Could not load favorites.
				</div>
			);
		}

		if (results.length === 0) {
			return;
		}

		return (
			<div id="home-favorites-results">
				{
					results.map(result => (
						<HomeFavoriteResult
							key={result.name}
							result={result}
							date={selectedDate}
						/>
					))
				}
			</div>
		);
	}, [stage, results, selectedDate]);

	return (
		<div className={classNames('collapsible-content flex-col', isCollapsed && 'collapsed')} id="home-favorites">
			<div className="collapse-toggle" onClick={onToggleExpansion}>
				<div className="flex-row">
					Favorites Across Campus on {selectedDate.toLocaleDateString()}
				</div>
				<ExpandIcon isExpanded={!isCollapsed}/>
			</div>
			<div className="collapse-body">
				{bodyView}
			</div>
		</div>
	);
};