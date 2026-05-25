import type { ICafeAvailability } from '@msdining/common/models/cart';
import React from 'react';
import { minutesToTimeString } from '@msdining/common/util/date-util';

interface ICafeAvailabilityWarningProps {
    availability: ICafeAvailability;
}

export const CafeAvailabilityWarning: React.FC<ICafeAvailabilityWarningProps> = ({ availability }) => {
    switch (availability.status) {
    case 'open': {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        if (currentMinutes < availability.hours.opensAt) {
            return (
                <div className="order-cafe-warning">
                    <span className="material-symbols-outlined">schedule</span>
                    <span>This cafe opens at {minutesToTimeString(availability.hours.opensAt)}</span>
                </div>
            );
        }

        if (currentMinutes >= availability.hours.closesAt) {
            return (
                <div className="order-cafe-warning">
                    <span className="material-symbols-outlined">schedule</span>
                    <span>This cafe closed at {minutesToTimeString(availability.hours.closesAt)}</span>
                </div>
            );
        }

        return null;
    }
    case 'shutdown': {
        const shutdownType = availability.shutdown.type === 'online_ordering_only'
            ? 'Online ordering is currently unavailable for this cafe.'
            : 'This cafe is currently closed.';

        return (
            <div className="order-cafe-warning">
                <span className="material-symbols-outlined">warning</span>
                <div>
                    <div>{shutdownType}</div>
                    {
                        availability.shutdown.message && (
                            <div className="order-cafe-warning-detail">{availability.shutdown.message}</div>
                        )
                    }
                    {
                        availability.shutdown.isTemporary && availability.shutdown.resumeInfo && (
                            <div className="order-cafe-warning-detail">{availability.shutdown.resumeInfo}</div>
                        )
                    }
                </div>
            </div>
        );
    }
    case 'unknown':
        return (
            <div className="order-cafe-warning">
                <span className="material-symbols-outlined">help</span>
                <span>We don't have hours for this cafe today — it may be closed.</span>
            </div>
        );
    }
};
