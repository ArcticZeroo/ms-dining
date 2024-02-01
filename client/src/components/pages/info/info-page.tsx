import { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ApplicationContext } from '../../../context/app.ts';
import { setPageData } from '../../../util/title.ts';

export const InfoPage = () => {
    const { isTrackingEnabled } = useContext(ApplicationContext);


    useEffect(() => {
        setPageData('Info', 'View information about the app and privacy information.');
    }, []);

    return (
        <>
            <div className="card">
                <div className="title">
					Site Info
                </div>
                <div className="body">
					Microsoft Cafeteria Menus was created by <a href="mailto:spnovick@microsoft.com">Spencer Novick</a>.
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
                </div>
            </div>
            {
                isTrackingEnabled && (
									  <Link to="/analytics" className="card blue centered">
										  Visit User Analytics
									  </Link>
								  )
            }
            {
                !isTrackingEnabled && (
									   <div className="error-card centered">
										   Analytics graph is currently unavailable.
									   </div>
								   )
            }
        </>
    );
};