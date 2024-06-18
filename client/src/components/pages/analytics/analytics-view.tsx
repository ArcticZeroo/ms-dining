import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { AnalyticsClient } from '../../../api/analytics.ts';
import { IScenario, STATIC_SCENARIOS } from '../../../util/analytics.ts';
import { classNames } from '../../../util/react.ts';
import { pluralize } from '../../../util/string.ts';
import { BooleanSwitch } from '../../button/boolean-switch.tsx';
import { RetryButton } from '../../button/retry-button.tsx';
import { ScenarioDropdown } from './scenario-dropdown.tsx';
import { VolumeTypeButton } from './volume-type-button.tsx';
import { HourglassLoadingSpinner } from "../../icon/hourglass-loading-spinner.tsx";
import { SCENARIO_NAMES } from "@msdining/common/dist/constants/analytics";
import { AnalyticsLoadingChart } from "./analytics-loading-chart.tsx";

const TOTAL_REQUEST_VOLUME_IMPLEMENTED_DATE = new Date('2024-06-17');
const NON_PRIMARY_SCENARIO_FIX_DATE = new Date('2024-06-18');

const VisitorChart = React.lazy(() => import('./visitor-chart.tsx'));

const DAY_OPTIONS: number[] = [
    1,
    7,
    30
];

const getDataMinDate = (days: number) => {
    const dataMinDate = new Date();
    dataMinDate.setDate(dataMinDate.getDate() - days);
    return dataMinDate;
}

const isTotalCountAvailable = (days: number) => {
    const dataMinDate = getDataMinDate(days);
    return dataMinDate.getTime() > TOTAL_REQUEST_VOLUME_IMPLEMENTED_DATE.getTime();
}

const isCapturingCachedData = (scenario: IScenario, days: number) => {
    if (scenario.scenarioName == null || scenario.scenarioName === SCENARIO_NAMES.poster) {
        return true;
    }

    const dataMinDate = getDataMinDate(days);
    return dataMinDate.getTime() > NON_PRIMARY_SCENARIO_FIX_DATE.getTime();
}

const getMissingDataMessage = (scenario: IScenario, isTotalCount: boolean, days: number) => {
    if (isTotalCount && !isTotalCountAvailable(days)) {
        return 'Total request volume data is only populated for dates on or after June 17, 2024.';
    }

    if (!isCapturingCachedData(scenario, days)) {
        return 'Data may be under-counted in scenarios except "All Traffic" for dates before June 18, 2024.';
    }

    return null;
}

export const AnalyticsView = () => {
    const [currentDaysAgo, setCurrentDaysAgo] = useState(7);
    const [isTotalCount, setIsTotalCount] = useState(false);
    const [selectedScenario, setSelectedScenario] = useState(STATIC_SCENARIOS[0]);

    const retrieveVisitsCallback = useCallback(
        () => AnalyticsClient.retrieveHourlyVisitCountAsync(currentDaysAgo, selectedScenario.scenarioName),
        [currentDaysAgo, selectedScenario]
    );

    const {
        stage: visitLoadingStage,
        run: loadVisits,
        value: visits
    } = useDelayedPromiseState(retrieveVisitsCallback, true /*keepLastValue*/);

    useEffect(() => {
        loadVisits();
    }, [loadVisits]);

    const isLoading = visits == null && visitLoadingStage !== PromiseStage.error;
    const missingDataMessage = getMissingDataMessage(selectedScenario, isTotalCount, currentDaysAgo);

    const onSelectedScenarioChange = (newScenario: IScenario) => {
        if (newScenario.scenarioName === SCENARIO_NAMES.poster) {
            setIsTotalCount(false);
        }

        setSelectedScenario(newScenario);
    }

    const isTotalCountSwitchDisabled = selectedScenario.scenarioName === SCENARIO_NAMES.poster;

    return (
        <div className="body flex-col">
            <div className="flex flex-wrap">
                <div id="days-ago-selector" className="default-border-radius">
                    {
                        DAY_OPTIONS.map(daysAgoOption => (
                            <button
                                key={daysAgoOption}
                                className={classNames('days-ago-option', daysAgoOption === currentDaysAgo && 'active')}
                                onClick={() => setCurrentDaysAgo(daysAgoOption)}>
                                {daysAgoOption} {pluralize('Day', daysAgoOption)}
                            </button>
                        ))
                    }
                </div>
                <div className={classNames('flex volume-type default-border-radius', isTotalCountSwitchDisabled && 'disabled')}>
                    <VolumeTypeButton
                        type="Unique Users"
                        selected={!isTotalCount}
                        onClick={() => setIsTotalCount(false)}
                    />
                    <BooleanSwitch
                        value={isTotalCount}
                        onChange={setIsTotalCount}
                        disabled={isTotalCountSwitchDisabled}
                    />
                    <VolumeTypeButton
                        type="Total Request Volume"
                        selected={isTotalCount}
                        onClick={() => setIsTotalCount(true)}
                        disabled={isTotalCountSwitchDisabled}
                    />
                </div>
                <ScenarioDropdown
                    selectedScenario={selectedScenario}
                    onScenarioChange={onSelectedScenarioChange}
                />
            </div>
            {
                missingDataMessage && (
                    <div className="warning default-container">
                        Note: {missingDataMessage}
                    </div>
                )
            }
            <div className="chart-container flex flex-center">
                {
                    visits != null && (
                        <Suspense fallback={<AnalyticsLoadingChart/>}>
                            <VisitorChart
                                visits={visits}
                                isTotalCount={isTotalCount}
                            />
                        </Suspense>
                    )
                }
                {
                    isLoading && (
                        <>
                            <HourglassLoadingSpinner/>
                            <span>
                                Loading visits...
                            </span>
                        </>
                    )
                }
                {
                    visitLoadingStage === PromiseStage.error && (
                        <>
                            <span>
                                Could not load visit data!
                            </span>
                            <RetryButton onClick={loadVisits}/>
                        </>
                    )
                }
            </div>
        </div>
    );
}