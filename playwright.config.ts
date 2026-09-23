import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const localChromium = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4179",
    launchOptions: existsSync(localChromium) ? { executablePath: localChromium } : {}
  },
  webServer: {
    command: "npx vite --port 4179 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: true
  }
});
