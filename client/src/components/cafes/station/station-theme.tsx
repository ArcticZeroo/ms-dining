import React from 'react';

import './station-theme.css';

interface IStationThemeProps {
    theme: string | undefined;
}

export const StationTheme: React.FC<IStationThemeProps> = ({ theme }) => {
    if (!theme) {
        return null;
    }

    return (
        <div className="card station-theme flex" title="This theme is AI-generated and may not be accurate.">
            <span>
                📒
            </span>
            <span>
                {theme}
            </span>
        </div>
    );
};