/**
 * Remove diacritics from Czech characters
 */
export function removeDiacritics(str: string): string {
    const diacriticMap: { [key: string]: string } = {
        'á': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'ě': 'e',
        'í': 'i', 'ň': 'n', 'ó': 'o', 'ř': 'r', 'š': 's',
        'ť': 't', 'ú': 'u', 'ů': 'u', 'ý': 'y', 'ž': 'z',
        'Á': 'A', 'Č': 'C', 'Ď': 'D', 'É': 'E', 'Ě': 'E',
        'Í': 'I', 'Ň': 'N', 'Ó': 'O', 'Ř': 'R', 'Š': 'S',
        'Ť': 'T', 'Ú': 'U', 'Ů': 'U', 'Ý': 'Y', 'Ž': 'Z'
    };

    return str.split('').map(char => diacriticMap[char] || char).join('');
}

/**
 * Check if query characters appear in target string in order (subsequence match)
 * Example: "zousk" matches "zkoušky" because z-o-u-s-k appear in that order
 */
export function isSubsequence(query: string, target: string): boolean {
    let queryIndex = 0;
    let targetIndex = 0;

    while (queryIndex < query.length && targetIndex < target.length) {
        if (query[queryIndex] === target[targetIndex]) {
            queryIndex++;
        }
        targetIndex++;
    }

    return queryIndex === query.length;
}

/**
 * Fuzzy string matching that handles:
 * 1. Diacritic normalization (zkousky -> zkoušky)
 * 2. Subsequence matching (zousk -> zkoušky)
 */
export function fuzzyMatch(query: string, target: string): boolean {
    const normalizedQuery = removeDiacritics(query.toLowerCase());
    const normalizedTarget = removeDiacritics(target.toLowerCase());

    // First try simple includes (fastest)
    if (normalizedTarget.includes(normalizedQuery)) {
        return true;
    }

    // Then try subsequence match
    return isSubsequence(normalizedQuery, normalizedTarget);
}

/**
 * Helper function that works like includes() but with fuzzy matching
 */
export function fuzzyIncludes(text: string, query: string): boolean {
    return fuzzyMatch(query, text);
}
