import { useState } from 'react';

export const useHasPermissionBeenGranted = (permission: PermissionName) => {
    const [hasPermissionBeenGranted, setHasPermissionBeenGranted] = useState(false);

    navigator.permissions.query({ name: permission })
        .then((result) => {
            const onUpdate = () => setHasPermissionBeenGranted(result.state === 'granted');

            onUpdate();

            result.addEventListener('change', () => {
                onUpdate();
            });
        })
        .catch(err => {
            console.error(`Could not determine whether permission '${permission}' has been granted: ${err}`);
        });

    return hasPermissionBeenGranted;
}