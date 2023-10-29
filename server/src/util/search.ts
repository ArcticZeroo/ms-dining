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

export const normalizeNameForSearch = (name: string) => name.toLowerCase().trim().replaceAll(/\s+/g, '');