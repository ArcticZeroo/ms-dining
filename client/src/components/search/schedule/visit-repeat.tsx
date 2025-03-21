import React from 'react';

interface IVisitRepeatProps {
    children: React.ReactNode;
}

export const VisitRepeat: React.FC<IVisitRepeatProps> = ({ children }) => {
    return (
        <div className="flex" title="Estimated schedule. Some visits may occur outside of this schedule.">
            <span className="material-symbols-outlined">
                event_repeat
            </span>
            <div className="flex flex-col">
                {children}
            </div>
        </div>
    );
}