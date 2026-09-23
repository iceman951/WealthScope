import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: process.env.CI ? 'github' : 'list',
	timeout: 30_000,
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } }
	],
	webServer: {
		// bun:sqlite needs the Bun server; `vite preview` would run on Node.
		command:
			'pnpm build && PORT=4173 ORIGIN=http://localhost:4173 BETTER_AUTH_URL=http://localhost:4173 pnpm start',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
