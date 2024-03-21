import { DeviceType, useDeviceType } from '../../../hooks/media-query.ts';
import { NavExpansionContext } from '../../../context/nav.ts';
import { useContext } from 'react';

export const HomeWelcomeMessage = () => {
    const deviceType = useDeviceType();
    const [, setIsNavExpanded] = useContext(NavExpansionContext);

    const selectMenuText = `View today's lunch menu by selecting a cafe from ${deviceType === DeviceType.Mobile ? 'the bar above' : 'the sidebar on the left'}.`

    return (
        <div className="card centered-content" id="home-welcome-message">
            <div className="title">
                Welcome to MSDining! 🎉
            </div>
            <div className="subtitle">
                View cafe menus, search for items across campus, easily find favorites, and more!
            </div>
            <div className="body flex-col">
                <p>
                    How to get started:
                </p>
                {
                    deviceType === DeviceType.Mobile && (
                        <button className="flex default-button default-container" onClick={() => setIsNavExpanded(true)}>
                            <span className="material-symbols-outlined">
                                menu
                            </span>
                            {selectMenuText}
                        </button>
                    )
                }
                {
                    deviceType === DeviceType.Desktop && (
                        <p className="flex">
                            <span className="material-symbols-outlined">
                                restaurant
                            </span>
                            {selectMenuText}
                        </p>
                    )
                }
                <p className="flex">
                    <span className="material-symbols-outlined">
                        home
                    </span>
                    Add your favorite cafes directly to this homepage! Select them below to get started.
                </p>
            </div>
        </div>
    );
}