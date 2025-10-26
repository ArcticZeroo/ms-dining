import { Nullable } from '@msdining/common/models/util';

export const pluralize = (value: string, count: number): string => {
    return count === 1 ? value : `${value}s`;
};

export const pluralizeWithCount = (value: string, count: number): string => {
    return count === 1 ? value : `${count} ${value}s`;
}

export const findLongestNonSequentialSubstringLength = (parent: string, child: string): number => {
    let score = 0;
    let parentIndex = 0;
    let childIndex = 0;

    while (parentIndex < parent.length && childIndex < child.length) {
        if (parent[parentIndex] === child[childIndex]) {
            score++;
            childIndex++;
        }
        parentIndex++;
    }

    return score;
};

export const findLongestSequentialSubstringLength = (parent: string, child: string): number => {
    let longestLength = 0;

    for (let i = 0; i < parent.length; i++) {
        for (let j = 0; j < child.length; j++) {
            let substringLength = 0;

            while ((i + substringLength) < parent.length
                   && (j + substringLength) < child.length
                   && parent[i + substringLength] === child[j + substringLength]) {
                substringLength++;
            }

            longestLength = Math.max(longestLength, substringLength);
            if (longestLength === child.length) {
                return longestLength;
            }
        }
    }

    return longestLength;
};

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