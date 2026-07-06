import { InfoCard } from './info-card.tsx';

export const SiteInfoCard = () => (
    <InfoCard title="Site Info">
        <div className="body">
            This website was created by <a href="mailto:spnovick@microsoft.com">Spencer Novick</a>.
            Please feel free to send thoughts, issues, or feedback!
            <br/>
            Source code can be found on <a href="https://github.com/arcticzeroo/ms-dining"
                target="_blank">GitHub</a>.
            Contributions are also welcome!
        </div>
    </InfoCard>
);
