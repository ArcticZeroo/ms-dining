export const setDifference = <T>(source: Set<T>, remove: Set<T>): Set<T> => new Set([...source].filter(item => !remove.has(item)));
export const setUnion = <T>(a: Set<T>, b: Set<T>): Set<T> => new Set([...a, ...b]);
export const setIntersection = <T>(a: Set<T>, b: Set<T>): Set<T> => new Set([...a].filter(item => b.has(item)));