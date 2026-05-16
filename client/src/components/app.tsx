import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '../store/query-client.ts';
import { useCoreDataQuery } from '../store/queries/app.ts';
import AppWithData from './app-with-data.tsx';
import { RetryButton } from './button/retry-button.tsx';
import { ReloadButton } from './button/reload-button.tsx';
import { HourglassLoadingSpinner } from './icon/hourglass-loading-spinner.tsx';
import { HttpException } from '../exception/http.ts';
import { FullHeightCenteredContainer } from './util/full-height-centered-container.tsx';

const AppInner = () => {
    const { data, error, isError, refetch } = useCoreDataQuery();

    if (isError) {
        const isServerError = error instanceof HttpException && error.statusCode === 500;

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
                    <RetryButton onClick={() => refetch()}/>
                    <ReloadButton/>
                </div>
            </FullHeightCenteredContainer>
        );
    }

    if (data != null) {
        const [coreData, user] = data;
        return <AppWithData coreData={coreData} user={user} />;
    }

    return (
        <FullHeightCenteredContainer>
            <HourglassLoadingSpinner/>
        </FullHeightCenteredContainer>
    );
};

export const App = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <AppInner/>
            {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false}/>}
        </QueryClientProvider>
    );
};