export type Nullable<T> = T | null | undefined;
export type EmptyObject = Record<string, never>;
export type NonEmptyArray<T> = [T, ...T[]];