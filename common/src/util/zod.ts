import { z, ZodTypeAny } from 'zod';

/**
 * Helper for any type that comes in from wire (DTO) as an object record, but ultimately becomes a Map.
 * @param key - Zod type for the key
 * @param value - Zod type for the value
 */
export const zodMapFromWire = <TKey extends ZodTypeAny, TValue extends ZodTypeAny>(key: TKey, value: TValue)/*: ZodMap<TKey, TValue>*/ => {
    return z.record(key, value)
        .transform((record) => new Map<z.infer<TKey>, z.infer<TValue>>(Object.entries(record)));
}

/**
 * Any type that comes in from wire (DTO) as an array, but ultimately becomes a Set.
 * @param value - Zod type for the value
 */
export const zodSetFromWire = <TValue extends ZodTypeAny>(value: TValue) => z.array(value).transform(items => new Set<z.infer<TValue>>(items));