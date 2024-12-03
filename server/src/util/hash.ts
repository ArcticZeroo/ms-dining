import * as crypto from 'node:crypto';

export const md5 = (content: string) => {
    const hash = crypto.createHash('md5');
    return hash.update(content).digest('hex');
}

export const getSortedStringsHash = (values: string[]): string => {
    const sortedValues = [...values].sort((a, b) => a.localeCompare(b));
    return md5(sortedValues.join(';'));
}