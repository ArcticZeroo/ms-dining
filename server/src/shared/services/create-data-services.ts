import { DATA_SERVICE_KEYS, type DataServiceMap } from './data-service-contract.generated.js';
import type { IServiceHandler } from '../../worker/rpc/handler.js';
import { keysOf } from '../util/iterable.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncMethod = (...args: any[]) => Promise<any>;
type ExtractAsyncMethod<T> = Extract<T, AsyncMethod>;
type ServiceName = keyof DataServiceMap & keyof typeof DATA_SERVICE_KEYS & string;

export type DataServices = {
    [S in keyof DataServiceMap]: {
        [M in keyof DataServiceMap[S]]: ExtractAsyncMethod<DataServiceMap[S][M]>;
    };
};

const createServiceMethods = <S extends ServiceName>(
    handler: IServiceHandler<DataServiceMap>,
    serviceName: S,
): DataServices[S] => {
    const methods = {} as Partial<DataServices[S]>;
    const methodNames = DATA_SERVICE_KEYS[serviceName] as unknown as ReadonlyArray<keyof DataServiceMap[S] & string>;

    for (const methodName of methodNames) {
        methods[methodName] = ((data: unknown) =>
            handler.sendRequest(serviceName, methodName, data as never)) as DataServices[S][typeof methodName];
    }

    return methods as DataServices[S];
};

/**
 * Builds typed DataServices wrappers by walking the generated service
 * contract. Each leaf method becomes a one-liner that delegates to
 * `handler.sendRequest(serviceName, methodName, data)`.
 *
 * No Proxy — the returned object tree is plain objects with real function
 * properties, built once and reused for the lifetime of the process.
 */
const setService = <S extends ServiceName>(
    result: Partial<DataServices>,
    serviceName: S,
    service: DataServices[S],
): void => {
    result[serviceName] = service;
};

export const createDataServices = (
    handler: IServiceHandler<DataServiceMap>,
): DataServices => {
    const result = {} as Partial<DataServices>;

    for (const serviceName of keysOf(DATA_SERVICE_KEYS) as ServiceName[]) {
        setService(result, serviceName, createServiceMethods(handler, serviceName));
    }

    return result as DataServices;
};
