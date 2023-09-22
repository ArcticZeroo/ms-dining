import { useEffect, useRef, useState } from 'react';
import { Outlet, useLoaderData } from 'react-router-dom';
import { DiningHallClient } from './api/dining.ts';
import { ApplicationSettings } from './api/settings.ts';
import { Nav } from './components/nav/nav.tsx';
import { ApplicationContext } from './context/app.ts';
import { SelectedViewContext } from './context/dining-hall.ts';
import { NavExpansionContext } from './context/nav.ts';
import { ISettingsContext, SettingsContext } from './context/settings.ts';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { useViewData } from './hooks/views';
import { DiningHallView, IDiningHall, IViewListResponse } from './models/dining-halls.ts';
import { ICancellationToken } from './util/async';
import { classNames } from './util/react';

function App() {
	const { diningHalls, groups } = useLoaderData() as IViewListResponse;

	const { viewsById, viewsInOrder } = useViewData(diningHalls, groups);
	const retrieveDiningHallMenusCancellationToken = useRef<ICancellationToken | undefined>(undefined);

	const settingsState = useState<ISettingsContext>(() => ({
		useGroups:                ApplicationSettings.useGroups.get(),
		showImages:               ApplicationSettings.showImages.get(),
		showCalories:             ApplicationSettings.showCalories.get(),
		requestMenusInBackground: ApplicationSettings.requestMenusInBackground.get(),
		homepageViewIds:          new Set(ApplicationSettings.homepageViews.get())
	}));
	const [{ requestMenusInBackground }] = settingsState;

	const [selectedView, setSelectedView] = useState<DiningHallView>();
	const menuDivRef = useRef<HTMLDivElement>(null);

	const [isNavToggleEnabled, setIsNavToggleEnabled] = useState(true);
	const deviceType = useDeviceType();

	const isNavVisible = deviceType === DeviceType.Desktop || isNavToggleEnabled;
	const shouldStopScroll = isNavToggleEnabled && deviceType === DeviceType.Mobile;

	useEffect(() => {
		if (menuDivRef.current) {
			menuDivRef.current.scrollTop = 0;
		}
	}, [selectedView]);

	useEffect(() => {
		if (!requestMenusInBackground || diningHalls.length === 0 || viewsById.size === 0) {
			return;
		}

		const lastCancellationToken = retrieveDiningHallMenusCancellationToken.current;
		if (lastCancellationToken) {
			lastCancellationToken.isCancelled = true;
		}

		const cancellationToken: ICancellationToken = { isCancelled: false };
		retrieveDiningHallMenusCancellationToken.current = cancellationToken;

		DiningHallClient.retrieveAllMenusInOrder(diningHalls, viewsById, cancellationToken)
			.then(() => console.log('Retrieved all dining hall menus!'))
			.catch(err => console.error('Failed to retrieve all dining hall menus:', err));
	}, [diningHalls, viewsById, requestMenusInBackground]);

	return (
		<div className="App">
			<ApplicationContext.Provider value={{ viewsById, viewsInOrder, diningHalls, groups }}>
				<SettingsContext.Provider value={settingsState}>
					<NavExpansionContext.Provider value={[isNavVisible, setIsNavToggleEnabled]}>
						<SelectedViewContext.Provider value={[selectedView, setSelectedView]}>
							<Nav/>
							<div className={classNames('content', shouldStopScroll && 'noscroll')} ref={menuDivRef}>
								{
									viewsById.size > 0 && (
										               <Outlet/>
									               )
								}
								{
									viewsById.size === 0 && (
										               <div className="error-card">
											               There are no views available!
										               </div>
									               )
								}
							</div>
						</SelectedViewContext.Provider>
					</NavExpansionContext.Provider>
				</SettingsContext.Provider>
			</ApplicationContext.Provider>
		</div>
	);
}

export default App;
