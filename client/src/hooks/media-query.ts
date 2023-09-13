import { useEffect, useState } from 'react';

export enum DeviceType {
    Mobile,
    Desktop
}

export const useDeviceWidth = () => {
    const [deviceWidth, setDeviceWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => {
            setDeviceWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return deviceWidth;
};

const mobileDeviceMaxWidthPx = 800;

export const useDeviceType = () => {
    const deviceWidth = useDeviceWidth();
    return deviceWidth <= mobileDeviceMaxWidthPx ? DeviceType.Mobile : DeviceType.Desktop;
};