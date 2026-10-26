import { defineConfig } from '@playwright/test';

// Set BASE_URL (ending in /) to run the tests against a deployed copy instead of the local dev server.
const live = process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: live || 'http://localhost:5199/allt-e-skit/',
    headless: true,
    viewport: { width: 1100, height: 650 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: live ? undefined : {
    command: 'npx vite --mode test --port 5199 --strictPort',
    url: 'http://localhost:5199/allt-e-skit/',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
