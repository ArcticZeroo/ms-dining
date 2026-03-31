import { RefCountedValueNotifier } from '../util/events.ts';
import { useValueNotifier } from './events.ts';

export enum DeviceType {
    Mobile,
    Desktop
}

const mobileDeviceMaxWidthPx = 800;
const wideDesktopMinWidthPx = 1200;

const getDeviceType = (): DeviceType => (window.innerWidth <= mobileDeviceMaxWidthPx)
    ? DeviceType.Mobile 
    : DeviceType.Desktop;

const getIsWideDesktop = (): boolean => window.innerWidth >= wideDesktopMinWidthPx;

const deviceTypeNotifier = new class extends RefCountedValueNotifier<DeviceType> {
    constructor() {
        super(getDeviceType());
    }

    setup() {
        const listener = () => {
            this.value = getDeviceType();
        };

        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    }
}

const wideDesktopNotifier = new class extends RefCountedValueNotifier<boolean> {
    constructor() {
        super(getIsWideDesktop());
    }

    setup() {
        const listener = () => {
            this.value = getIsWideDesktop();
        };

        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    }
}

export const useDeviceType = () => useValueNotifier(deviceTypeNotifier);
export const useIsWideDesktop = () => useValueNotifier(wideDesktopNotifier);
