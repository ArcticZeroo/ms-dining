import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';

export const AnalyticsStatusCard = () => {
    const { isTrackingEnabled } = useContext(ApplicationContext);

    if (isTrackingEnabled) {
        return (
            <Link to="/analytics" className="card blue text-center">
                Visit User Analytics
            </Link>
        );
    }

    return (
        <div className="error-card text-center">
            Analytics graph is currently unavailable.
        </div>
    );
};
