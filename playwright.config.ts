import { defineConfig, devices } from "@playwright/test";

const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${String(port)}`;

export default defineConfig({
  testDir: "./src/test/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: "test-results/playwright",
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --hostname ${host} --port ${String(port)} --turbopack`,
    env: {
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
      NEXT_PUBLIC_POSTHOG_KEY: "test-posthog-key",
      NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
      NEXT_PUBLIC_SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
