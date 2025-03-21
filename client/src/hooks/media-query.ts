import { RefCountedValueNotifier } from '../util/events.ts';
import { useValueNotifier } from './events.ts';

export enum DeviceType {
    Mobile,
    Desktop
}

const getDeviceType = (): DeviceType => (window.innerWidth <= mobileDeviceMaxWidthPx)
    ? DeviceType.Mobile 
    : DeviceType.Desktop;

const mobileDeviceMaxWidthPx = 800;

const deviceTypeNotifier = new class extends RefCountedValueNotifier<DeviceType>
{
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

export const useDeviceType = () => useValueNotifier(deviceTypeNotifier);
