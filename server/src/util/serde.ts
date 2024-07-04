export const jsonStringifyWithoutNull = (value: any) => JSON.stringify(value, (_, value) => {
	if (value == null) {
		return undefined;
	}

	if (value instanceof Set) {
		return Array.from(value);
	}

	return value;
});