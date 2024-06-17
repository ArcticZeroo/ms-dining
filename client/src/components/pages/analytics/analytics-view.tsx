import React, { Suspense, useCallback, useEffect, useState } from "react";
import { AnalyticsClient } from "../../../api/analytics.ts";
import { PromiseStage, useDelayedPromiseState } from "@arcticzeroo/react-promise-hook";
import { HourglassLoadingSpinner } from "../../icon/hourglass-loading-spinner.tsx";
import { RetryButton } from "../../button/retry-button.tsx";
import { classNames } from "../../../util/react.ts";
import { pluralize } from "../../../util/string.ts";
import { BooleanSwitch } from "../../button/boolean-switch.tsx";
import { VolumeTypeButton } from "./volume-type-button.tsx";
import { ScenarioDropdown } from "./scenario-dropdown.tsx";
import { STATIC_SCENARIOS } from "../../../util/analytics.ts";

const TOTAL_REQUEST_VOLUME_IMPLEMENTED_DATE = new Date('2024-06-17');

const VisitorChart = React.lazy(() => import('./visitor-chart.tsx'));

const DAY_OPTIONS: number[] = [
    1,
    7,
    30
];

const isTotalCountAvailable = (days: number) => {
    const now = new Date();
    now.setDate(now.getDate() - days);
    return now.getTime() > TOTAL_REQUEST_VOLUME_IMPLEMENTED_DATE.getTime();
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

    if ([PromiseStage.notRun, PromiseStage.running].includes(visitLoadingStage)) {
        return (
            <div className="card">
                <HourglassLoadingSpinner/>
                <span>
                    Loading visit data...
                </span>
            </div>
        );
    }

    if (visitLoadingStage === PromiseStage.error || visits == null) {
        return (
            <div className="card error">
                <div>
                    Could not load visit data!
                </div>
                <RetryButton onClick={loadVisits}/>
            </div>
        );
    }

    const isMaybeMissingData = isTotalCount && !isTotalCountAvailable(currentDaysAgo);

    return (
        <div className="body flex-col">
            <div className="flex">
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
                <div className="flex volume-type default-border-radius">
                    <VolumeTypeButton
                        type="Unique Users"
                        selected={!isTotalCount}
                        onClick={() => setIsTotalCount(false)}
                    />
                    <BooleanSwitch
                        value={isTotalCount}
                        onChange={setIsTotalCount}
                    />
                    <VolumeTypeButton
                        type="Total Request Volume"
                        selected={isTotalCount}
                        onClick={() => setIsTotalCount(true)}
                    />
                </div>
                <ScenarioDropdown
                    selectedScenario={selectedScenario}
                    onScenarioChange={setSelectedScenario}
                />
            </div>
            {
                isMaybeMissingData && (
                    <div className="warning default-container">
                        Note: Total request volume data is only populated for dates on or after June 17, 2024.
                    </div>
                )
            }
            <Suspense fallback={<div>Loading chart...</div>}>
                <VisitorChart
                    visits={visits}
                    isTotalCount={isTotalCount}
                />
            </Suspense>
        </div>
    );
}