export const queryForScrollAnchor = (id: string) => document.querySelector(`[href="#${id}"]`);

export const scrollHeaderIntoView = (element?: Element | null) => {
    if (!element) {
        return;
    }

    if (element.getBoundingClientRect().top < 0) {
        element.scrollIntoView({ behavior: 'instant' });
    }
}

export const getAncestorWithClassName = (element: HTMLElement | null, targetClassName: string): HTMLElement | null => {
    while (element != null) {
        if (element.classList.contains(targetClassName)) {
            return element;
        }

        element = element.parentElement;
    }

    return null;
}