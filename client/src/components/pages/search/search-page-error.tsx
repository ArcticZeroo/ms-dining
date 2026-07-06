import React from 'react';
import { RetryButton } from '../../button/retry-button.tsx';

interface ISearchPageErrorProps {
    isError: boolean;
    onRetry: () => void;
}

export const SearchPageError: React.FC<ISearchPageErrorProps> = ({ isError, onRetry }) => {
    if (!isError) {
        return null;
    }

    return (
        <div className="error-card">
            <p>
                Error loading search results!
            </p>
            <p>
                <RetryButton onClick={onRetry}/>
            </p>
        </div>
    );
};
