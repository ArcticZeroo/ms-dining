import { InfoCard } from './info-card.tsx';
import { PrivacyAnalyticsSection } from './privacy-analytics-section.tsx';
import { PrivacyUserDataSection } from './privacy-user-data-section.tsx';

export const PrivacyInfoCard = () => (
    <InfoCard title="Privacy Information">
        <article className="body flex-col">
            <PrivacyAnalyticsSection/>
            <PrivacyUserDataSection/>
        </article>
    </InfoCard>
);
