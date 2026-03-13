module.exports = {
    root: true,
    env: {browser: true, es2020: true},
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
        //'@arcticzeroo/eslint-config',
    ],
    ignorePatterns: ['dist', '.eslintrc.cjs'],
    parser: '@typescript-eslint/parser',
    plugins: ['react-refresh', 'msdining'],
    rules: {
        'react-refresh/only-export-components': [
            'warn',
            {allowConstantExport: true},
        ],
        'no-mixed-spaces-and-tabs': 'off',
        'indent': ['error', 4],
        'curly': ['error', 'all'],
        'brace-style': ['error', '1tbs', { allowSingleLine: false }],
        'msdining/require-promise-state-stage': 'error',
        'id-length': ['error', { min: 3, exceptions: ['i', 'j', 'k', 'x', 'y', 'id'], properties: 'never' }],
    },
}
