export const normalizeCafeId = (id: string) => {
    return id
        .toLowerCase()
        .replace(/^cafe/, '');
};

const CAFE_NUMBER_REGEX = /(?:caf[eé]|food\s*hall|building)\s*(\d+)/i;

export const getCafeNumber = (name: string) => {
    const match = name.match(CAFE_NUMBER_REGEX);

    if (match) {
        return Number(match[1]);
    }

    return NaN;
};
