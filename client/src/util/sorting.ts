const normalizeId = (id: string) => {
    id = id.toLowerCase();

    if (id.startsWith('cafe')) {
        id = id.substring('cafe'.length);
    }

    return id;
}

export const sortIds = (ids: string[]) => {
    const normalizedIdsByOriginalId = new Map<string, string>();

    const getNormalizedId = (id: string) => {
        if (!normalizedIdsByOriginalId.has(id)) {
            normalizedIdsByOriginalId.set(id, normalizeId(id));
        }
        return normalizedIdsByOriginalId.get(id)!;
    }

    return ids.sort((a, b) => {
        const normalizedA = getNormalizedId(a);
        const normalizedB = getNormalizedId(b);

        const numberA = Number(normalizedA);
        const numberB = Number(normalizedB);

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
    });
}