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
  // (DataRouterStateContext, DataRouterContext, RouteContext) aren't
  // duplicated between the test's direct `import 'react-router'` and
  // @rvf/react-router's internal `import {useActionData} from "react-router"`.
  // Without this, the context seen by rvf's hooks is a *different* instance
  // than the one populated by RouterProvider from createRoutesStub, so every
  // useForm call throws "useActionData must be used within a data router".
  resolve: {
    conditions: ['module', 'browser', 'development', 'default'],
    dedupe: ['react', 'react-dom', 'react-router', '@rvf/react', '@rvf/react-router', '@rvf/core'],
    alias: {
      // Absolute alias forces every `react-router` import — including the one
      // inside @rvf/react-router's bundled dist — through a single resolver
      // path, so DataRouterStateContext has exactly one instance.
      'react-router/dom': new URL(
        './node_modules/react-router/dist/development/dom-export.mjs',
        import.meta.url,
      ).pathname,
      'react-router': new URL(
        './node_modules/react-router/dist/development/index.mjs',
        import.meta.url,
      ).pathname,
    },
  },
  // Disable Vite's dep pre-bundling for react-router so it's loaded through
  // the normal resolver (which respects dedupe). Pre-bundled deps become
  // their own module copies, which is exactly what caused the duplication.
  optimizeDeps: {
    exclude: ['react-router', '@rvf/react', '@rvf/react-router', '@rvf/core'],
  },
  server: {
    watch: {
      ignored: ['.*\\/node_modules\\/.*', '.*\\/build\\/.*'],
    },
  },
  test: {
    // Do NOT inline react-router — inlining transforms it through vite and
    // breaks the alias we use to force a single resolution. Keeping it
    // external lets node resolve it once through the standard pnpm
    // symlink to a single module instance.
    server: {
      deps: {
        inline: ['@rvf/react', '@rvf/react-router', '@rvf/core'],
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
