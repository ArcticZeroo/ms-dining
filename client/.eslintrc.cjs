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
    plugins: ['react-refresh', 'react', 'msdining'],
    settings: {
        react: { version: 'detect' },
    },
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
        'id-length': ['error', { min: 3, exceptions: ['i', 'j', 'k', 'x', 'y', 'id', 'z', 'a', 'b', '_', 'ms', 'dx', 'dy', 'dt', 'px', 'L', 'on'], properties: 'never' }],
        // Ban immediately-invoked function expressions (IIFEs). Prefer a named helper
        // function or a module-scope constant over inline self-invoking functions.
        'no-restricted-syntax': [
            'error',
            {
                selector: 'CallExpression[callee.type=\'FunctionExpression\']',
                message:  'Do not use IIFEs; extract a named helper function or compute the value at module scope instead.',
            },
            {
                selector: 'CallExpression[callee.type=\'ArrowFunctionExpression\']',
                message:  'Do not use IIFEs; extract a named helper function or compute the value at module scope instead.',
            },
        ],
    },
    overrides: [
        {
            // Component-structure conventions (JSX only). Intentional exceptions
            // (e.g. a tightly-coupled private helper, or a trivial one-element map)
            // opt out with an inline eslint-disable and a short justification.
            files: ['*.tsx'],
            rules: {
                // One component per file, including stateless function components.
                'react/no-multi-comp': ['error', { ignoreStateless: false }],
                // Components must be `const X: React.FC<IXProps>` arrows with a named
                // props interface when they accept props (no `function`, no inline prop types).
                'msdining/functional-component-style': 'error',
                // Complex JSX in an array .map() should be its own component,
                // not nested rendering logic inline in the parent.
                'msdining/no-complex-inline-map': 'error',
                // A single component that renders too much (raw host markup + conditional branches)
                // is a signal it is doing too many things; extract cohesive sections into sub-components.
                'msdining/no-overloaded-component': ['error', { maxJsxElements: 12 }],
            },
        },
    ],
}
