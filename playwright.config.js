import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 300_000,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
