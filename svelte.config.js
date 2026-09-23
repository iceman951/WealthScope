import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Run the built server with `bun build/index.js` — bun:sqlite needs Bun.
		adapter: adapter(),
		alias: {
			$components: 'src/lib/components',
			$engine: 'src/lib/engine',
			$schemas: 'src/lib/schemas'
		},
		// SvelteKit's cross-origin form check is on by default and is left on: no
		// third-party origin may post to an action here.
		serviceWorker: {
			register: false
		}
	}
};

export default config;
