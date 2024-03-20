// Basic fuzzy search via https://stackoverflow.com/a/15252131
export const fuzzySearch = (source: string, search: string) => {
    const hay = source.toLowerCase();
    let i = 0;
    let n = -1;
    let l;
    search = search.toLowerCase();
    for (; l = search[i++];) {
        if (!~(n = hay.indexOf(l, n + 1))) {
            return false;
        }
    }
    return true;
};

// Normalization is intended to match two items which are the same to each other.
// e.g. Chipotle Chicken + Bacon Sub should also match "Chipotle Chicken Bacon Sub" or "Chipotle Chicken and Bacon Sub"
// We don't want to normalize numbers out of names because those indicate different items
export const normalizeNameForSearch = (name: string) => name
    .toLowerCase()
    .trim()
    .replace(/^the /i, '')
    .replaceAll(/(\W|\s|\s+\s|\sand\s)/ig, '');
