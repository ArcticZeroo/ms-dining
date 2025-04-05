import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';
import { AnalyticsView } from './analytics-view.tsx';
import './analytics-page.css';
import { usePageData } from '../../../hooks/location.ts';

export const AnalyticsPage = () => {
    const { isTrackingEnabled } = useContext(ApplicationContext);
    const navigate = useNavigate();

    usePageData('User Analytics', 'View user analytics for the app');

    useEffect(() => {
        // Parent page
        if (!isTrackingEnabled) {
            navigate('/info');
        }
    }, [navigate, isTrackingEnabled]);

    return (
        <div className="card" id="analytics-page">
            <div className="title">
                User Analytics
            </div>
            <AnalyticsView/>
        </div>
    );
};