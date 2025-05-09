import { PromiseStage, useImmediatePromiseState } from '@arcticzeroo/react-promise-hook';
import { DiningClient } from '../api/dining.ts';
import { updateRoamingSettingsOnBoot } from '../util/settings.ts';
import AppWithData from './app-with-data.tsx';
import { RetryButton } from './button/retry-button.tsx';
import { ReloadButton } from './button/reload-button.tsx';
import { HourglassLoadingSpinner } from './icon/hourglass-loading-spinner.tsx';
import { HttpException } from '../exception/http.ts';
import { FullHeightCenteredContainer } from './util/full-height-centered-container.tsx';

const coreDataLoader = async () => {
    const coreData = await DiningClient.retrieveCoreData();
    updateRoamingSettingsOnBoot(coreData.user);
    return coreData;
};

export const App = () => {
    const responseStatus = useImmediatePromiseState(coreDataLoader);

    if (responseStatus.stage === PromiseStage.error) {
        const isServerError = responseStatus.error instanceof HttpException && responseStatus.error.statusCode === 500;

        const reason = isServerError
            ? 'The server failed to handle your request, please try again.'
            : 'Please check your internet connection and try again.';

        return (
            <FullHeightCenteredContainer>
                <div className="card error">
                    <span>
                      Unable to load required data. {reason}
                    </span>
                    <span>
                        If this is happening a lot, <a href="mailto:spnovick@microsoft.com" className="flex-inline"><span
                            className="material-symbols-outlined">email</span> please let me know.</a>
                    </span>
                    <RetryButton onClick={responseStatus.run}/>
                    <ReloadButton/>
                </div>
            </FullHeightCenteredContainer>
        );
    }

    if (responseStatus.value != null) {
        return <AppWithData response={responseStatus.value}/>;
    }

    return (
        <FullHeightCenteredContainer>
            <HourglassLoadingSpinner/>
        </FullHeightCenteredContainer>
    );
};