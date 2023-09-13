import { Outlet, useLoaderData } from 'react-router-dom';
import { IDiningHall } from './models/dining-halls.ts';
import { Nav } from './components/nav/nav.tsx';
import { useEffect, useRef, useState } from 'react';
import { NavVisibilityContext } from './context/nav.ts';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';
import { SelectedDiningHallContext } from './context/dining-hall.ts';

function App() {
    const diningHallList = useLoaderData() as Array<IDiningHall>;

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

    return (
        <div className="App">
            <NavVisibilityContext.Provider value={[isNavVisible, setIsNavToggleEnabled]}>
                <SelectedDiningHallContext.Provider value={[selectedDiningHall, setSelectedDiningHall]}>
                    <Nav diningHalls={diningHallList}/>
                    <div className={`menu${shouldStopScroll ? ' noscroll' : ''}`} ref={menuDivRef}>
                        <Outlet/>
                    </div>
                </SelectedDiningHallContext.Provider>
            </NavVisibilityContext.Provider>
        </div>
    )
}

export default App
