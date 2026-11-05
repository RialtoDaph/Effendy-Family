import { defineConfig } from "@playwright/test";

// QA run: a production build against the stub in tests/e2e/stub.cjs, so no real
// data is touched. The two-person privacy rules run in the database itself: see
// supabase/tests/rls_leaks.sql. Build first: npm run test:e2e:build.
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/e2e",
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  use: { baseURL: "http://localhost:3100", channel: "chrome", serviceWorkers: "block", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  webServer: [
    { command: "node tests/e2e/stub.cjs", port: 54399, reuseExistingServer: true },
    { command: "npx next start -p 3100", port: 3100, reuseExistingServer: true },
  ],
});
