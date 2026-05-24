import { Nullable } from '@msdining/common/models/util';

export const pluralize = (value: string, count: number): string => {
    return count === 1 ? value : `${value}s`;
};

export const pluralizeWithCount = (value: string, count: number): string => {
    return count === 1 ? value : `${count} ${value}s`;
}

export const normalizeName = (name: string) => name.toLowerCase().trim();

export const stringWithSpaceIfExists = (value: unknown): string => (typeof value === 'string' && value)
    ? ` ${value}`
    : '';

export const maybeString = (value: unknown): string | undefined => (typeof value === 'string' && value) ? value : undefined;

export const isNullOrEmpty = (value: Nullable<string>) => value == null || value.trim().length === 0;

export const repeat = (value: string, count: number) => {
    const pieces: string[] = [];
    for (let i = 0; i < count; i++) {
        pieces.push(value);
    }
    return pieces.join('');
}

export const emptyIfFalsy = (value: unknown): string => !value ? '' : String(value);