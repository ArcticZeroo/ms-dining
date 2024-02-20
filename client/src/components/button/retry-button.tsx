import React from 'react';

interface IRetryButtonProps {
    onClick: () => void;
}

export const RetryButton: React.FC<IRetryButtonProps> = ({ onClick }) => {
    return (
        <button onClick={onClick} className="default-container default-button flex">
            <span className="material-symbols-outlined">
                replay
            </span>
            Retry
        </button>
    );
};