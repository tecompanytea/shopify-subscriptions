import graphql from '@rollup/plugin-graphql';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths({
      projects: [
        './tsconfig.json',
        './extensions/buyer-subscriptions/tsconfig.json',
        './extensions/admin-subs-action/tsconfig.json',
        './extensions/thank-you-page/tsconfig.json',
      ],
    }),
    graphql(),
  ],
  // Force a single module identity for react-router so its internal contexts
  // (DataRouterStateContext, DataRouterContext, etc.) aren't duplicated
  // across ESM and CJS chunks — duplication breaks hooks like useActionData
  // when a consumer (e.g. @rvf/react-router) and the RouterProvider resolve
  // to different chunks. Pin the resolve condition to `module` so every
  // import lands on index.mjs rather than flip-flopping between .mjs/.js.
  resolve: {
    conditions: ['module', 'browser', 'development', 'default'],
    dedupe: ['react', 'react-dom', 'react-router', '@rvf/react', '@rvf/react-router'],
  },
  server: {
    watch: {
      ignored: ['.*\\/node_modules\\/.*', '.*\\/build\\/.*'],
    },
  },
  test: {
    server: {
      deps: {
        inline: ['react-router', '@rvf/react', '@rvf/react-router'],
      },
    },
    globals: true,
    environment: 'happy-dom',
    // By default vitest v2 uses 'forks' but that fails in CI, possibly because of how our VMs are set up
    pool: 'threads',
    setupFiles: [
      './test/setup-test-env.ts',
      './test/setup-i18n.ts',
      './test/setup-graphql-matchers.ts',
      './test/setup-app-bridge.tsx',
      './test/setup-address-mocks.tsx',
    ],
    include: [
      './app/**/*.test.[jt]s?(x)',
      './extensions/admin-subs-action/**/*.test.[jt]s?(x)',
      './config/**/*.test.[jt]s?(x)',
      './extensions/buyer-subscriptions/**/*.test.[jt]s?(x)',
      './extensions/thank-you-page/**/*.test.[jt]s?(x)',
    ],
    exclude: ['./extensions/**/node_modules/**'],
  },
});
