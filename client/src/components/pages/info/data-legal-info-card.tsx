import { InfoCard } from './info-card.tsx';

export const DataLegalInfoCard = () => (
    <InfoCard title="Data/Legal Info">
        <div className="body">
            This website is unofficial and has no affiliation with Microsoft. It is not a Microsoft product in any way.
            <br/>
            All data is sourced from the buy-ondemand.com websites, which have no authentication and
            do not require any Microsoft credentials (they can be accessed by guests from any device on any network).
            There is no Microsoft-internal data being exposed by this website.
            <br/>
            Users can optionally sign in, but a microsoft.com account is not required to use this site. Further,
            email addresses are not intentionally stored (see below).
        </div>
    </InfoCard>
);
