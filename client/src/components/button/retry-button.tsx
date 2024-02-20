import React from 'react';

import './retry-button.css';

interface IRetryButtonProps {
    onClick: () => void;
    isDisabled?: boolean;
}

export const RetryButton: React.FC<IRetryButtonProps> = ({ onClick, isDisabled = false }) => {
    const onButtonClicked = () => {
        if (!isDisabled) {
            onClick();
        }
    }

    return (
        <button onClick={onButtonClicked} className="default-container default-button flex retry-button" disabled={isDisabled}>
            <span className="material-symbols-outlined">
                replay
            </span>
            Retry
        </button>
    );
};