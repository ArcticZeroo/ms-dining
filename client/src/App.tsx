import { Outlet, useLoaderData } from 'react-router-dom';
import { IDiningHall } from './models/dining-halls.ts';
import { Nav } from './components/nav/nav.tsx';
import { useEffect, useRef, useState } from 'react';
import { NavExpansionContext } from './context/nav.ts';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { SelectedDiningHallContext } from './context/dining-hall.ts';
import { ISettingsContext, SettingsContext } from './context/settings.ts';
import { DiningHallClient } from './api/dining.ts';
import { ApplicationContext } from './context/app.ts';
import { ApplicationSettings } from './api/settings.ts';

function App() {
    const diningHallList = useLoaderData() as Array<IDiningHall>;

    const [diningHallsById, setDiningHallsById] = useState<Map<string, IDiningHall>>(new Map());
    const [diningHallIdsInOrder, setDiningHallIdsInOrder] = useState<Array<string>>([]);

    useEffect(() => {
        const diningHallsById = new Map<string, IDiningHall>();

        for (const diningHall of diningHallList) {
            diningHallsById.set(diningHall.id, diningHall);
        }

        setDiningHallsById(diningHallsById);
        setDiningHallIdsInOrder(diningHallList.map(diningHall => diningHall.id).sort());
    }, [diningHallList]);

    const settingsState = useState<ISettingsContext>({
        showImages: ApplicationSettings.showImages.get(),
        homepageDiningHallIds: new Set(ApplicationSettings.homepageDiningHalls.get())
    });

    const [selectedDiningHall, setSelectedDiningHall] = useState<IDiningHall>();
    const menuDivRef = useRef<HTMLDivElement>(null);

    const [isNavToggleEnabled, setIsNavToggleEnabled] = useState(true);
    const deviceType = useDeviceType();

    const isNavVisible = deviceType === DeviceType.Desktop || isNavToggleEnabled;
    const shouldStopScroll = isNavToggleEnabled && deviceType === DeviceType.Mobile;

    useEffect(() => {
        if (menuDivRef.current) {
            menuDivRef.current.scrollTop = 0;
        }
    }, [selectedDiningHall]);

    useEffect(() => {
        DiningHallClient.retrieveAllMenusInOrder(diningHallList)
            .then(() => console.log('Retrieved all dining hall menus!'))
            .catch(err => console.error('Failed to retrieve all dining hall menus:', err));
    }, [diningHallList]);

    return (
        <div className="App">
            <ApplicationContext.Provider value={{ diningHallsById, diningHallIdsInOrder }}>
                <SettingsContext.Provider value={settingsState}>
                    <NavExpansionContext.Provider value={[isNavVisible, setIsNavToggleEnabled]}>
                        <SelectedDiningHallContext.Provider value={[selectedDiningHall, setSelectedDiningHall]}>
                            <Nav/>
                            <div className={`content${shouldStopScroll ? ' noscroll' : ''}`} ref={menuDivRef}>
                                <Outlet/>
                            </div>
                        </SelectedDiningHallContext.Provider>
                    </NavExpansionContext.Provider>
                </SettingsContext.Provider>
            </ApplicationContext.Provider>
        </div>
    )
}

export default App
