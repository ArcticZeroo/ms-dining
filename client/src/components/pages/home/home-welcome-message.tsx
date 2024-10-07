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
            <div className="flex">
                <span className="material-symbols-outlined">
                    restaurant
                </span>
                <div>
                    <span>
                        View today's lunch menu by selecting a cafe from
                        {deviceType === DeviceType.Mobile ? ' the ☰ icon above' : ' the sidebar on the left'}.
                    </span>
                </div>
            </div>
            <div className="subtitle">
                Note: This website is unofficial and not affiliated with Microsoft. See more at <a href="/info">the info page.</a>
            </div>
        </div>
    );
}