const availableCharacters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';

export function randomString(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += availableCharacters.charAt(Math.floor(Math.random() * availableCharacters.length));
    }
    return result;
}

export const randomUserId = () => randomString(24);

export const randomChoice = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const randomSortInPlace = <T>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i--) {
        const pivot = Math.floor(Math.random() * (i + 1));
        [items[pivot], items[i]] = [items[i], items[pivot]];
    }
    return items;
}