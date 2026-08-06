import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: [
			'src/**/*.{test,spec}.{js,ts}',
			'tests/unit/**/*.{test,spec}.{js,ts}',
			// Integration specs skip themselves unless TEST_DATABASE_URL is set.
			'tests/integration/**/*.{test,spec}.{js,ts}'
		],
		exclude: ['tests/e2e/**'],
		environment: 'node',
		globals: false
	},
	build: {
		// Cloudflare Workers ship a single bundle; keep chunks small enough that a
		// dashboard visit never pulls in ECharts or pdf-lib.
		chunkSizeWarningLimit: 700
	}
});
