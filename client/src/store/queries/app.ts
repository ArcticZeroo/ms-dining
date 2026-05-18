import { useQuery } from '@tanstack/react-query';
import { IClientUser } from '@msdining/common/models/auth';
import { IDiningCoreResponse } from '@msdining/common/models/http';
import { DiningClient } from '../../api/client/dining.ts';
import { queryKeys } from './keys.ts';
import { updateRoamingSettingsOnBoot } from '../../util/settings.ts';

const retrieveAuthenticatedUserAndUpdateSettings = async (): Promise<IClientUser | undefined> => {
    try {
        const user = await DiningClient.retrieveAuthenticatedUser();
        updateRoamingSettingsOnBoot(user);
        return user;
    } catch {
        return undefined;
    }
}

/**
 * Boot-time fetch: core dining metadata + (optionally) the authenticated user.
 * Auth failures intentionally swallow to `undefined` so unauthenticated users
 * still see the rest of the app.
 */
export const useCoreDataQuery = () =>
    useQuery<readonly [IDiningCoreResponse, IClientUser | undefined]>({
        queryKey: queryKeys.app.coreData,
        queryFn:  async () => {
            return Promise.all([
                DiningClient.retrieveCoreData(),
                retrieveAuthenticatedUserAndUpdateSettings()
            ]);
        },
        staleTime: Infinity,
        gcTime:    Infinity,
    });
