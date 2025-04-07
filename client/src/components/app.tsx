import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../api/dining.ts';
import { updateRoamingSettingsOnBoot } from '../util/settings.ts';
import AppWithData from './app-with-data.tsx';
import { RetryButton } from './button/retry-button.tsx';
import { ReloadButton } from './button/reload-button.tsx';
import { HourglassLoadingSpinner } from './icon/hourglass-loading-spinner.tsx';

const coreDataLoader = async () => {
    const coreData = await DiningClient.retrieveCoreData();
    updateRoamingSettingsOnBoot(coreData.user);
    return coreData;
};

export const App = () => {
    const responseStatus = useImmediatePromiseState(coreDataLoader);

    if (responseStatus.stage === PromiseStage.error) {
        return (
            <div className="card error">
                <span>
                  Unable to load required data. Please check your internet connection and try again.
                </span>
                <RetryButton onClick={responseStatus.run}/>
                <ReloadButton/>
            </div>
        );
    }

    if (responseStatus.value != null) {
        return <AppWithData response={responseStatus.value}/>
    }

    return (
        <div className="flex flex-center" style={{ height: '100%' }}>
            <HourglassLoadingSpinner/>
        </div>
    );
}