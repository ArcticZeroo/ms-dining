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
                <div className="body">
                    Google analytics is used in this application only for tracking pageview counts.
                    <br/>
                    A randomly-generated user id is also used for custom pageview tracking. Source code for the pageview
                    tracking is available <a href="https://github.com/arcticzeroo/frozor-analytics" target="_blank">here
                    on GitHub</a>.
                    <br/>
                    Search query strings are cached as vector embeddings in order to speed up similar searches in the future.
                </div>
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