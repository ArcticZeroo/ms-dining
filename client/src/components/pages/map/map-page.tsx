import React from 'react';
import { Navigate } from 'react-router-dom';
import { DebugSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { MapPageView } from './map-page-view.js';
import './map-page.css';

export const MapPage: React.FC = () => {
    const isEnabled = useValueNotifier(DebugSettings.enableMapPage);

    if (!isEnabled) {
        return <Navigate to="/" replace/>;
    }

    return (
        <MapPageView/>
    );
};
