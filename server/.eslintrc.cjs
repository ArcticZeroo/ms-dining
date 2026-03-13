module.exports = {
    root: true,
    env: { node: true, es2020: true },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module',
    },
    rules: {
        'indent': ['error', 4],
        'curly': ['error', 'all'],
        'brace-style': ['error', '1tbs', { allowSingleLine: false }],
        'prefer-const': 'error',
        'id-length': ['error', { min: 3, exceptions: ['i', 'j', 'k', 'x', 'y', 'id'], properties: 'never' }],
    },
};
