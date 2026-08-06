import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			routes: {
				include: ['/*'],
				// Static assets are served straight from the CDN edge and never
				// touch the Worker, so the Worker only runs for real requests.
				exclude: ['<all>']
			}
		}),
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
