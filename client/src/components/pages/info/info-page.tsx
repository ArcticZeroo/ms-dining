import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';
import { usePageData } from '../../../hooks/location.ts';

export const InfoPage = () => {
    const { isTrackingEnabled } = useContext(ApplicationContext);


    usePageData('Info', 'View information about the app and privacy information.');

    return (
        <>
            <div className="card">
                <div className="title">
                    Data/Legal Info
                </div>
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
            </div>
            <div className="card">
                <div className="title">
                    Site Info
                </div>
                <div className="body">
                    This website was created by <a href="mailto:spnovick@microsoft.com">Spencer Novick</a>.
                    Please feel free to send thoughts, issues, or feedback!
                    <br/>
                    Source code can be found on <a href="https://github.com/arcticzeroo/ms-dining"
                        target="_blank">GitHub</a>.
                    Contributions are also welcome!
                </div>
            </div>
            <div className="card">
                <div className="title">
                    Privacy Information
                </div>
                <article className="body flex-col">
                    <section>
                        <div className="bold">
                            Analytics/User Tracking
                        </div>
                        <div>
                            Google analytics is used in this application only for tracking pageview counts.
                            <br/>
                            A randomly-generated user id is also used for custom pageview tracking. Source code for the
                            pageview
                            tracking is available <a href="https://github.com/arcticzeroo/frozor-analytics"
                                target="_blank">here
                            on GitHub</a>.
                        </div>
                    </section>
                    <section>
                        <div className="bold">
                            User Data
                        </div>
                        <ul>
                            <li>
                                When you search, your query is stored as a vector embedding in order to speed up similar searches in the future.
                                There might eventually be a feature to show suggested search queries, which will use these embeddings and may show users your exact query.
                                Please don't type anything sensitive into the search query box.
                            </li>
                            <li>
                                Reviews (number ratings and textual comments) are stored and shown to other users. You can delete them at any time.
                            </li>
                            <li>
                                When you sign in, your 3rd-party user id is stored alongside your display name from that 3rd-party service.
                                You can change your display name at any time on your profile page.
                                Please don't put anything inappropriate as your display name. Emoji is ok.
                            </li>
                        </ul>
                    </section>
                </article>
            </div>
            {
                isTrackingEnabled && (
                    <Link to="/analytics" className="card blue text-center">
                        Visit User Analytics
                    </Link>
                )
            }
            {
                !isTrackingEnabled && (
                    <div className="error-card text-center">
                        Analytics graph is currently unavailable.
                    </div>
                )
            }
        </>
    );
};