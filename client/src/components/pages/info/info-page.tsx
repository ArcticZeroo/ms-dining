import { usePageData } from '../../../hooks/location.ts';
import { AnalyticsStatusCard } from './analytics-status-card.tsx';
import { DataLegalInfoCard } from './data-legal-info-card.tsx';
import { PrivacyInfoCard } from './privacy-info-card.tsx';
import { SiteInfoCard } from './site-info-card.tsx';

export const InfoPage = () => {
    usePageData('Info', 'View information about the app and privacy information.');

    return (
        <>
            <DataLegalInfoCard/>
            <SiteInfoCard/>
            <PrivacyInfoCard/>
            <AnalyticsStatusCard/>
        </>
    );
};