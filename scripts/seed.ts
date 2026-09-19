/**
 * Development seed (CLI).
 *
 * The data itself lives in src/lib/server/db/seed-demo.ts so that the dev server
 * can seed an empty local database on boot without shelling out. This file is
 * only the binding and the guard rails.
 *
 *   pnpm db:seed
 *   pnpm db:seed -- --reset     (wipes the demo user's records first)
 *
 * It seeds the LOCAL D1 database — the one `vite dev` and `wrangler dev` read
 * from under .wrangler/state — through wrangler's platform proxy. Apply the
 * schema first with `pnpm db:migrate`. There is deliberately no remote mode:
 * fictional data has no business in the deployed database.
 */

import { getPlatformProxy } from 'wrangler';
import { createDb } from '../src/lib/server/db/index';
import { seedDemoData } from '../src/lib/server/db/seed-demo';

function assertNotProduction() {
	if (process.env.NODE_ENV === 'production' || process.env.WEALTHSCOPE_ENV === 'production') {
		throw new Error('Refusing to seed: NODE_ENV is production.');
	}
}

async function main() {
	assertNotProduction();
	const reset = process.argv.includes('--reset');

	const proxy = await getPlatformProxy<{ DB: D1Database }>();
	try {
		await seedDemoData(createDb(proxy.env.DB), { reset });
	} finally {
		await proxy.dispose();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
