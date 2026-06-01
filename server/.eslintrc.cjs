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
        '@typescript-eslint/no-unused-vars': ['error', {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
        }],
        'id-length': ['error', { min: 3, exceptions: ['_', 'i', 'j', 'k', 'x', 'y', 'z', 'id', 'db', 'fs', 'os'], properties: 'never' }],
    },
    overrides: [
        {
            // Main thread code should not import from worker data layer.
            // Phase 2 will fix remaining violations.
            files: ['src/main/**/*.ts'],
            rules: {
                'no-restricted-imports': ['warn', {
                    patterns: [{
                        group: ['**/worker/data/**'],
                        message: 'Main thread code should not import from worker data layer. Use getServices().data.* instead.',
                    }],
                }],
            },
        },
        {
            // Worker data layer should not import from main thread code.
            files: ['src/worker/data/**/*.ts'],
            excludedFiles: ['src/worker/data/**/*.test.ts'],
            rules: {
                'no-restricted-imports': ['warn', {
                    patterns: [{
                        group: ['**/main/**'],
                        message: 'Worker data layer should not import from main thread code. Use shared/ for shared types.',
                    }],
                }],
            },
        },
    ],
};
