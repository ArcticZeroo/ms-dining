import React from 'react';

interface IStationListEmptyProps {
    message?: string;
}

export const StationListEmpty: React.FC<IStationListEmptyProps> = ({ message }) => {
    return (
        <div className="centered-content">
            There's nothing here! {message}
        </div>
    );
};