import { useQuery } from '@tanstack/react-query';
import { IClientUser } from '@msdining/common/models/auth';
import { IDiningCoreResponse } from '@msdining/common/models/http';
import { DiningClient } from '../../api/client/dining.ts';
import { queryKeys } from './keys.ts';
import { updateRoamingSettingsOnBoot } from '../../util/settings.ts';

/**
 * Boot-time fetch: core dining metadata + (optionally) the authenticated user.
 * Auth failures intentionally swallow to `undefined` so unauthenticated users
 * still see the rest of the app.
 */
export const useCoreDataQuery = () =>
    useQuery<readonly [IDiningCoreResponse, IClientUser | undefined]>({
        queryKey: queryKeys.app.coreData,
        queryFn:  async () => {
            const [coreData, user] = await Promise.all([
                DiningClient.retrieveCoreData(),
                (async (): Promise<IClientUser | undefined> => {
                    try {
                        const fetched = await DiningClient.retrieveAuthenticatedUser();
                        updateRoamingSettingsOnBoot(fetched);
                        return fetched;
                    } catch {
                        return undefined;
                    }
                })(),
            ]);
            return [coreData, user] as const;
        },
        staleTime: Infinity,
        gcTime:    Infinity,
    });
