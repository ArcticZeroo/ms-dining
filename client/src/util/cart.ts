export const getPriceDisplay = (price: number) => {
    if (price === 0) {
        return '';
    }

    return `$${price.toFixed(2)}`;
}

export const getMinMaxDisplay = (min: number, max: number) => {
    if (min === 0 && max === 0) {
        return '';
    }

    if (min === max) {
        return `Choose ${min}`;
    }

    if (min === 0) {
        return `Choose up to ${max}`;
    }

    return `Choose between ${min} and ${max}`;
}