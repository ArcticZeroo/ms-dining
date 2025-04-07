export const removeSourceQueryParamIfNeeded = () => {
    const searchParams = new URLSearchParams(location.search);
    if (!searchParams.has('source')) {
        return;
    }

    searchParams.delete('source');

    const newSearch = searchParams.toString();

    window.history.replaceState(
        {},
        '',
        `${location.pathname}${newSearch ? `?${newSearch}` : ''}`
    );
}