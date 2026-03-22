import seedrandom from 'seedrandom';

export const createSeededRandom = (seed: string): (() => number) => seedrandom(seed);

export const seededShuffle = <T>(items: readonly T[], random: () => number): T[] => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const swapIndex = Math.floor(random() * (i + 1));
        [result[i], result[swapIndex]] = [result[swapIndex]!, result[i]!];
    }
    return result;
};

const VARIETY_POOL_MULTIPLIER = 3;

// Takes a pre-sorted array, expands to a larger pool, shuffles, and returns the first `count` items.
// Ensures variety among top-quality candidates.
export const selectWithVariety = <T>(sortedItems: readonly T[], count: number, random: () => number): T[] => {
    if (sortedItems.length <= count) {
        return seededShuffle(sortedItems, random);
    }

    const poolSize = Math.min(sortedItems.length, count * VARIETY_POOL_MULTIPLIER);
    const pool = sortedItems.slice(0, poolSize);
    return seededShuffle(pool, random).slice(0, count);
};

// Like selectWithVariety, but skips items that don't pass the filter.
// Randomly samples from the top of the sorted pool without shuffling the entire array.
// Stops when it has `count` passing items or has exhausted the variety pool.
export const selectWithFilter = <T>(
	sortedItems: readonly T[],
	count: number,
	random: () => number,
	filter: (item: T) => boolean,
): T[] => {
    const poolSize = Math.min(sortedItems.length, count * VARIETY_POOL_MULTIPLIER);

    // Build an array of pool indices and Fisher-Yates shuffle through them lazily,
    // picking items that pass the filter until we have enough or run out.
    const indices = Array.from({ length: poolSize }, (_, i) => i);
    const selected: T[] = [];

    for (let i = indices.length - 1; i >= 0 && selected.length < count; i--) {
        const swapIndex = Math.floor(random() * (i + 1));
        [indices[i], indices[swapIndex]] = [indices[swapIndex]!, indices[i]!];

        const item = sortedItems[indices[i]!]!;
        if (filter(item)) {
            selected.push(item);
        }
    }

    return selected;
};

interface IWeightedItem<T> {
	value: T;
	weight: number;
}

// Weighted random sampling without replacement.
// Higher weight = higher probability of selection.
export const weightedRandomSample = <T>(items: readonly IWeightedItem<T>[], count: number, random: () => number): T[] => {
    if (items.length <= count) {
        return items.map(item => item.value);
    }

    // Efraimidis-Spirakis algorithm: assign key = random^(1/weight), take top-k by key
    const keyed = items.map(item => ({
        value: item.value,
        key:   Math.pow(random(), 1 / Math.max(item.weight, 0.001)),
    }));

    keyed.sort((a, b) => b.key - a.key);
    return keyed.slice(0, count).map(item => item.value);
};
