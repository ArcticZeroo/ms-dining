import { Link } from 'react-router-dom';
import { IOnlineOrderingState, OnlineOrderingBlockedReason } from '../../hooks/cafe.ts';
import React from 'react';

interface IOnlineOrderingUnavailableNoticeProps {
    /**
     * State returned by useOnlineOrderingStatus. Only the `allowed: false`
     * shape is used here — the prop type stays wide so callers can pass
     * the discriminated value directly without re-checking.
     */
    state: IOnlineOrderingState;
}

const NOT_ALLOWED_MESSAGE_BY_REASON: Record<OnlineOrderingBlockedReason, string> = {
    'setting-disabled':   'Online ordering is currently disabled in your settings.',
    'not-logged-in':      'You must be logged in to place an order.',
    'weekend':            'Online ordering is unavailable on weekends. Check back on Monday!',
    'today-not-selected': 'Online ordering only works for today\'s menu. Use the date picker to switch to today.',
};

export const OnlineOrderingUnavailableNotice: React.FC<IOnlineOrderingUnavailableNoticeProps> = ({ state }) => {
    if (state.allowed) {
        return null;
    }

    return (
        <div className="card dark-blue flex-col text-center">
            <span>{NOT_ALLOWED_MESSAGE_BY_REASON[state.reason]}</span>
            <Link to="/" className="default-container default-button flex flex-center" title="Click to go home">
                <span className="material-symbols-outlined">
                    home
                </span>
                <span>
                    Go Home
                </span>
            </Link>
        </div>
    );
};
