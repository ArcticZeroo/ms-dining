import { DeviceType, useDeviceType } from '../../../hooks/media-query.ts';

export const HomeWelcomeMessage = () => {
    const deviceType = useDeviceType();

    return (
        <div className="card theme centered-content" id="home-welcome-message">
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
                <p className="flex">
                    <span className="material-symbols-outlined">
                        restaurant
                    </span>
                    View today's lunch menu by selecting a cafe from {deviceType === DeviceType.Mobile ? 'the bar above' : 'the sidebar on the left'}.
                </p>
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