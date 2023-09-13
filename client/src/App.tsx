import { Outlet, useLoaderData } from 'react-router-dom';
import { IDiningHall } from './models/dining-halls.ts';
import { DiningHallList } from './components/dining-halls/list/dining-hall-list.tsx';
import { useState } from 'react';
import { NavVisibilityContext } from './context/nav.ts';
import { DeviceType, useDeviceType } from './hooks/media-query.ts';

function App() {
    const diningHallList = useLoaderData() as Array<IDiningHall>;

    const [isNavToggleEnabled, setIsNavToggleEnabled] = useState(true);
    const deviceType = useDeviceType();

    const isNavVisible = deviceType === DeviceType.Desktop || isNavToggleEnabled;
    const shouldStopScroll = isNavToggleEnabled && deviceType === DeviceType.Mobile;

    return (
        <div className="App">
            <NavVisibilityContext.Provider value={[isNavVisible, setIsNavToggleEnabled]}>
                <DiningHallList diningHalls={diningHallList}/>
                <div className={`menu${shouldStopScroll ? ' noscroll' : ''}`}>
                    <Outlet/>
                </div>
            </NavVisibilityContext.Provider>
        </div>
    )
}

export default App
