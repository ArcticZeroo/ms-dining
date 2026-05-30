export const setDifference = <T>(source: Set<T>, remove: Set<T>): Set<T> => new Set([...source].filter(item => !remove.has(item)));
export const setUnion = <T>(firstSet: Set<T>, secondSet: Set<T>): Set<T> => new Set([...firstSet, ...secondSet]);
export const setIntersection = <T>(firstSet: Set<T>, secondSet: Set<T>): Set<T> => new Set([...firstSet].filter(item => secondSet.has(item)));