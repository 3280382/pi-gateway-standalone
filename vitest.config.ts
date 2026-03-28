import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src/client'),
      '@shared': resolve(__dirname, './src/shared'),
      '@server': resolve(__dirname, './src/server'),
    },
  },
});
