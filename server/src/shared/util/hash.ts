import * as crypto from 'node:crypto';

export const md5 = (content: string) => {
    const hash = crypto.createHash('md5');
    return hash.update(content).digest('hex');
}

export const sha256 = (content: string) => {
    const hash = crypto.createHash('sha256');
    return hash.update(content).digest('hex');
}

export const getSortedStringsHash = (values: string[]): string => {
    const sortedValues = [...values].sort((firstString, secondString) => firstString.localeCompare(secondString));
    return md5(sortedValues.join(';'));
}