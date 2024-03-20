export const queryForScrollAnchor = (id: string) => document.querySelector(`[href="#${id}"]`);

export const scrollIntoViewIfNeeded = (element?: Element | null) => {
    if (!element) {
        return;
    }

    if (element.getBoundingClientRect().top < 0) {
        element.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
}