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

export const truncateFloat = (value: number, decimalPlaces: number) => {
	const factor = Math.pow(10, decimalPlaces);
	return Math.trunc(value * factor) / factor;
}