import type { ICafeAvailability } from '@msdining/common/models/cart';
import React from 'react';
import { minutesToTimeString } from '@msdining/common/util/date-util';
import { UnhandledDefaultError } from '@msdining/common/util/switch-util';

const WarningCard: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
    <div className="card warning-overlay horizontal align-center">
        <span className="material-symbols-outlined">{icon}</span>
        {children}
    </div>
);

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
                <WarningCard icon="schedule">
                    <span>This cafe opens at {minutesToTimeString(availability.hours.opensAt)}</span>
                </WarningCard>
            );
        }

        if (currentMinutes >= availability.hours.closesAt) {
            return (
                <WarningCard icon="schedule">
                    <span>This cafe closed at {minutesToTimeString(availability.hours.closesAt)}</span>
                </WarningCard>
            );
        }

        return null;
    }
    case 'shutdown': {
        const shutdownType = availability.shutdown.type === 'online_ordering_only'
            ? 'Online ordering is currently unavailable for this cafe.'
            : 'This cafe is currently closed.';

        return (
            <WarningCard icon="warning">
                <div>
                    <span>{shutdownType}</span>
                    {
                        availability.shutdown.message && (
                            <span className="warning-detail">{availability.shutdown.message}</span>
                        )
                    }
                    {
                        availability.shutdown.isTemporary && availability.shutdown.resumeInfo && (
                            <span className="warning-detail">{availability.shutdown.resumeInfo}</span>
                        )
                    }
                </div>
            </WarningCard>
        );
    }
    case 'unknown':
        return (
            <WarningCard icon="help">
                <span>We don't have hours for this cafe today, it may be closed.</span>
            </WarningCard>
        );
    default:
        throw new UnhandledDefaultError(availability);
    }
};
