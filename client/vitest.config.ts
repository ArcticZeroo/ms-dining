import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Ensure JSX in .tsx tests uses React's automatic runtime under esbuild.
    esbuild: {
        jsx:             'automatic',
        jsxImportSource: 'react',
    },
    test: {
        include:    ['test/**/*.test.ts', 'test/**/*.test.tsx'],
        setupFiles: ['test/setup.ts'],
        // Node by default (fast); component/hook tests opt into jsdom by naming
        // themselves *.dom.test.tsx. RTL setup lives in test/react/render.tsx,
        // imported by those tests, so it never loads in the node environment.
        environment:          'node',
        environmentMatchGlobs: [
            ['test/**/*.dom.test.{ts,tsx}', 'jsdom'],
        ],
        globals: false,
    },
});
