import React from 'react';
import { StarRating } from './star-rating.tsx';

const OPTION_LABELS = ['Review this station instead', 'Submit as anonymous'];
const ACTION_ICONS = ['close', 'save'];

/** Disabled placeholder mirroring PostReviewInput's layout for the loading state. */
export const ReviewFormSkeleton: React.FC = () => (
    <div className="flex-col align-center default-container bg-raised-4">
        <div className="flex">
            Leave a review! Comments are optional.
        </div>
        {
            OPTION_LABELS.map(label => (
                <label key={label} className="flex align-center" style={{ gap: '0.5rem' }}>
                    <input type="checkbox" disabled={true}/>
                    {label}
                </label>
            ))
        }
        <StarRating value={0} readOnly={true} size="large"/>
        <textarea
            className="self-stretch"
            placeholder="Comments (optional)"
            rows={5}
            disabled={true}
        />
        <div className="flex">
            {
                ACTION_ICONS.map(icon => (
                    <button key={icon} className="icon-container default-button default-container" disabled={true}>
                        <span className="material-symbols-outlined">{icon}</span>
                    </button>
                ))
            }
        </div>
    </div>
);
