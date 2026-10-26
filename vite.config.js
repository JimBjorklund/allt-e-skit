import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  base: '/allt-e-skit/',
  test: {
    include: ['tests/unit/**/*.test.js'],
    exclude: [...configDefaults.exclude],
  },
});
