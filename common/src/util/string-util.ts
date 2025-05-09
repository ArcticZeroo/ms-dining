export const findLongestNonSequentialSubstringLength = (parent: string, child: string): number => {
    let score = 0;
    let parentIndex = 0;
    let childIndex = 0;

    while (parentIndex < parent.length && childIndex < child.length) {
        if (parent[parentIndex] === child[childIndex]) {
            score++;
            childIndex++;
        }
        parentIndex++;
    }

    return score;
}

export const findLongestSequentialSubstringLength = (parent: string, child: string): number => {
    let longestLength = 0

    for (let i = 0; i < parent.length; i++) {
        for (let j = 0; j < child.length; j++) {
            let substringLength = 0;

            while ((i + substringLength) < parent.length
            && (j + substringLength) < child.length
            && parent[i + substringLength] === child[j + substringLength]) {
                substringLength++;
            }

            longestLength = Math.max(longestLength, substringLength);
            if (longestLength === child.length) {
                return longestLength;
            }
        }
    }

    return longestLength;
}

export const normalizeDisplayName = (value: string) => {
    return value.trim().replaceAll(/\s+/g, ' ');
}