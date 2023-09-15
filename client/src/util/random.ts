const availableCharacters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';

export function randomString(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += availableCharacters.charAt(Math.floor(Math.random() * availableCharacters.length));
    }
    return result;
}

export const randomUserId = () => randomString(24);