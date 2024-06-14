export const getPercentileIndex = (values: number[], percentile: number): number => {
    const index = Math.floor(values.length * percentile);
    return Math.min(values.length - 1, index);
}