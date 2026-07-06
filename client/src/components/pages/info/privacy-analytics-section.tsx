export const PrivacyAnalyticsSection = () => (
    <section>
        <div className="bold">
            Analytics/User Tracking
        </div>
        <div>
            Google analytics & cloudflare analytics are used in this application only for tracking pageview counts.
            <br/>
            A randomly-generated device id is also used for server-side telemetry. It should not be possible to identify anyone from this id, and it is only used to track usage statistics such as number of unique users and user retention.
        </div>
    </section>
);
