export const getPriceDisplay = (price: number) => {
    if (price === 0) {
        return '';
    }

    return `$${price.toFixed(2)}`;
}
