export const normalizeCafeId = (id: string) => {
    return id
        .toLowerCase()
        .replace(/^cafe/, '');
};

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

export const sortCafeIds = (cafeIds: Iterable<string>) => {
    const normalizedIdsByOriginalId = new Map<string, string>();

    const getNormalizedId = (id: string) => {
        if (!normalizedIdsByOriginalId.has(id)) {
            normalizedIdsByOriginalId.set(id, normalizeCafeId(id));
        }
        return normalizedIdsByOriginalId.get(id)!;
    };

    return Array.from(cafeIds).sort((a, b) => {
        const normalizedA = getNormalizedId(a);
        const normalizedB = getNormalizedId(b);

        return compareNormalizedCafeIds(normalizedA, normalizedB);
    });
};