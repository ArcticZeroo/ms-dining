import { ValueNotifier } from '../util/events.ts';

export class PermissionGrantedNotifier extends ValueNotifier<boolean> {
    constructor(permissionName: PermissionName) {
        super(false);

        navigator.permissions.query({ name: permissionName }).then(permissionStatus => {
            this.value = permissionStatus.state === 'granted';
            permissionStatus.addEventListener('change', () => {
                this.value = permissionStatus.state === 'granted';
            });
        });
    }
}