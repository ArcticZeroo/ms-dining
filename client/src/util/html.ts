import { Nullable } from "@msdining/common/dist/models/util";

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

export const hasAncestor = (element: Nullable<Element>, targetElement: Nullable<Element>): boolean => {
    if (element == null || targetElement == null) {
        return false;
    }

    while (element != null) {
        if (element === targetElement) {
            return true;
        }

        element = element.parentElement;
    }

    return false;
}