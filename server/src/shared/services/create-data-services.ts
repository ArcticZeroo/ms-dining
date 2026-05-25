import type { DataServiceMap } from '../../worker/data/data-services.js';
import type { IServiceHandler } from '../../worker/rpc/handler.js';
import { keysOf } from '../util/iterable.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncMethod = (...args: any[]) => Promise<any>;

export type DataServices = {
    [S in keyof DataServiceMap]: {
        [M in keyof DataServiceMap[S]]: Extract<DataServiceMap[S][M], AsyncMethod>;
    };
};

/**
 * Builds typed DataServices wrappers by walking the service map object
 * tree at construction time. Each leaf method becomes a one-liner that
 * delegates to `handler.sendRequest(serviceName, methodName, data)`.
 *
 * No Proxy — the returned object tree is plain objects with real function
 * properties, built once and reused for the lifetime of the process.
 *
 * @param serviceMap The actual DATA_SERVICES object (or any object with
 *   the same shape). Only its keys are read — the method implementations
 *   are replaced by handler.sendRequest wrappers.
 */
export const createDataServices = (
    handler: IServiceHandler<DataServiceMap>,
    serviceMap: DataServiceMap,
): DataServices => {
    const result = {} as Record<string, Record<string, AsyncMethod>>;

    for (const serviceName of keysOf(serviceMap)) {
        const methods = {} as Record<string, AsyncMethod>;
        for (const methodName of keysOf(serviceMap[serviceName])) {
            methods[methodName as string] = (data: unknown) =>
                handler.sendRequest(serviceName, methodName, data as never);
        }
        result[serviceName as string] = methods;
    }

    return result as DataServices;
};
