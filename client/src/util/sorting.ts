import { CafeView } from '../models/cafe.ts';

export const normalizeCafeId = (id: string) => {
    return id
        .toLowerCase()
        .replace(/^cafe/, '');
};

const CAFE_NUMBER_REGEX = /(?:caf[eé]|food hall|building) (\d+)/i;

export const getCafeNumber = (name: string) => {
    const match = name.match(CAFE_NUMBER_REGEX);

    if (match) {
        return Number(match[1]);
    }

    return NaN;
}

export const compareNormalizedCafeIds = (normalizedA: string, normalizedB: string) => {
    // Normally I don't like parseInt, but for once
    // I am going to intentionally rely on the weird
    // parsing behavior.
    // Cafe 40-41 will be normalized to "40-41", which
    // fails to parse under Number but will parse into
    // 40 under parseInt.
    const numberA = parseInt(normalizedA);
    const numberB = parseInt(normalizedB);

    const isNumberA = !Number.isNaN(numberA);
    const isNumberB = !Number.isNaN(numberB);

    if (isNumberA && isNumberB) {
        return numberA - numberB;
    }

    // Put numeric cafes at the bottom of the list
    if (isNumberA) {
        return 1;
    }

    if (isNumberB) {
        return -1;
    }

    return normalizedA.localeCompare(normalizedB);
};

const compareViewNames = (a: string, b: string) => {
    const numberA = getCafeNumber(a);
    const numberB = getCafeNumber(b);

    if (!Number.isNaN(numberA) && !Number.isNaN(numberB)) {
        return numberA - numberB;
    }

    return a.localeCompare(b);
}

export const sortViews = (views: Iterable<CafeView>) => {
    return Array
        .from(views)
        .sort((a, b) => compareViewNames(a.value.name, b.value.name));
}