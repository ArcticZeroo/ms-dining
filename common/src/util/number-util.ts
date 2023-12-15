export const parseNumber = (value: string | null | undefined, defaultValue: number) => {
    if (!value) {
        return defaultValue;
    }

    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
        return defaultValue;
    }

    return parsed;
}