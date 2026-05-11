import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Electron apps share the OS audio/display; run serially.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  // 60s was tight on resource-constrained machines: tests that switch
  // user sessions (logout admin → login cashier) after dozens of prior
  // launches occasionally hit the deadline even though the action itself
  // takes ~2 s in isolation. 90 s is a comfortable ceiling without
  // hiding real slowdowns.
  timeout: 90_000,
  expect: {
    timeout: 10_000
  }
})
