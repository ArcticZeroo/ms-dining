import React from 'react';

interface IOverlayNoticeProps {
    message: string;
    actionLabel: string;
    onAction: () => void;
}

/**
 * A message card with a single action button, shown inside the payment overlay
 * for both the terminal error and the advisory stall states.
 */
export const OverlayNotice: React.FC<IOverlayNoticeProps> = ({ message, actionLabel, onAction }) => (
    <div className="card error">
        <div>{message}</div>
        <button className="default-container" onClick={onAction}>
            {actionLabel}
        </button>
    </div>
);
