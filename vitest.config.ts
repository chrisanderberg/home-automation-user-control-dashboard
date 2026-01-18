import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'packages/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, './packages/core/src'),
    },
  },
});
