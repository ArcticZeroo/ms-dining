import type { DataServiceMap } from '../../worker/data/data-services.js';
import type { IServiceHandler } from '../../worker/rpc/handler.js';

type AsyncMethod = (...args: any[]) => Promise<any>;

type DataServiceMethod<
    S extends keyof DataServiceMap & string,
    M extends keyof DataServiceMap[S] & string,
> = Extract<DataServiceMap[S][M], AsyncMethod>;

export type DataServices = {
    [S in keyof DataServiceMap]: {
        [M in keyof DataServiceMap[S]]: Extract<DataServiceMap[S][M], AsyncMethod>;
    };
};

const createDataServiceMethod = <
    S extends keyof DataServiceMap & string,
    M extends keyof DataServiceMap[S] & string,
>(
    handler: IServiceHandler<DataServiceMap>,
    serviceName: S,
    methodName: M,
): DataServiceMethod<S, M> => {
    const callHandler = handler.sendRequest as (
        serviceName: S,
        methodName: M,
        data?: Parameters<DataServiceMethod<S, M>>[0],
    ) => ReturnType<DataServiceMethod<S, M>>;

    return ((...args: Parameters<DataServiceMethod<S, M>>) => (
        callHandler(serviceName, methodName, args[0])
    )) as DataServiceMethod<S, M>;
};

const createDataServiceProxy = <S extends keyof DataServiceMap & string>(
    handler: IServiceHandler<DataServiceMap>,
    serviceName: S,
): DataServices[S] => new Proxy({} as DataServices[S], {
    get: (_target, methodName: string) => (
        createDataServiceMethod(handler, serviceName, methodName as keyof DataServiceMap[S] & string)
    ),
});

export const createDataServices = (
    handler: IServiceHandler<DataServiceMap>,
): DataServices => new Proxy({} as DataServices, {
    get: (_target, serviceName: string) => (
        createDataServiceProxy(handler, serviceName as keyof DataServiceMap & string)
    ),
});
