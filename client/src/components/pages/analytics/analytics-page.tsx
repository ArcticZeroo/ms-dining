import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';
import { setPageData } from '../../../util/title.ts';
import { AnalyticsView } from "./analytics-view.tsx";
import './analytics-page.css';

export const AnalyticsPage = () => {
    const { isTrackingEnabled } = useContext(ApplicationContext);
    const navigate = useNavigate();

    useEffect(() => {
        setPageData('User Analytics', 'View user analytics for the app');
    }, []);

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