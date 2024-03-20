export const queryForScrollAnchor = (id: string) => document.querySelector(`[href="#${id}"]`);

export const scrollHeaderIntoView = (element?: Element | null) => {
    if (!element) {
        return;
    }

    if (element.getBoundingClientRect().top < 0) {
        element.scrollIntoView({ behavior: 'instant' });
    }
}