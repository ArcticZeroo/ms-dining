import { Outlet, useLoaderData } from 'react-router-dom';
import { IDiningHall } from './models/dining-halls.ts';
import { Nav } from './components/nav/nav.tsx';
import { useEffect, useRef, useState } from 'react';
import { NavVisibilityContext } from './context/nav.ts';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { SelectedDiningHallContext } from './context/dining-hall.ts';
import { ISettingsContext, SettingsContext } from './context/settings.ts';
import { getBooleanSetting } from './api/settings.ts';
import { settingNames } from './constants/settings.ts';
import { DiningHallClient } from './api/dining.ts';
import { ApplicationContext } from './context/app.ts';

function App() {
    const diningHallList = useLoaderData() as Array<IDiningHall>;

    const [diningHallsById, setDiningHallsById] = useState<Map<string, IDiningHall>>(new Map());

    useEffect(() => {
        const diningHallsById = new Map<string, IDiningHall>();
        for (const diningHall of diningHallList) {
            diningHallsById.set(diningHall.id, diningHall);
        }
        setDiningHallsById(diningHallsById);
    }, [diningHallList]);

    const settingsState = useState<ISettingsContext>({
        showImages: getBooleanSetting(settingNames.showImages, false /*defaultValue*/)
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
            <ApplicationContext.Provider value={{ diningHallsById }}>
                <SettingsContext.Provider value={settingsState}>
                    <NavVisibilityContext.Provider value={[isNavVisible, setIsNavToggleEnabled]}>
                        <SelectedDiningHallContext.Provider value={[selectedDiningHall, setSelectedDiningHall]}>
                            <Nav diningHalls={diningHallList}/>
                            <div className={`content${shouldStopScroll ? ' noscroll' : ''}`} ref={menuDivRef}>
                                <Outlet/>
                            </div>
                        </SelectedDiningHallContext.Provider>
                    </NavVisibilityContext.Provider>
                </SettingsContext.Provider>
            </ApplicationContext.Provider>
        </div>
    )
}

export default App
