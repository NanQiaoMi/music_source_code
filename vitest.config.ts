import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/audio/**', 'src/utils/**'],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
