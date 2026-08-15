/**
 * Development seed (CLI).
 *
 * The data itself lives in src/lib/server/db/seed-demo.ts so that the dev server
 * can seed a fresh PGlite database on boot without shelling out. This file is
 * only the connection and the guard rails.
 *
 *   pnpm db:seed
 *   pnpm db:seed -- --reset     (wipes the demo user's records first)
 *
 * On PGlite, stop the dev server first: PGlite is a single process holding an
 * exclusive lock on the data directory.
 */

import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../src/lib/server/db/schema/index';
import { createPgliteDb, isPgliteUrl, migratePglite } from '../src/lib/server/db/pglite';
import { seedDemoData } from '../src/lib/server/db/seed-demo';

function assertNotProduction(url: string) {
	if (process.env.NODE_ENV === 'production' || process.env.WEALTHSCOPE_ENV === 'production') {
		throw new Error('Refusing to seed: NODE_ENV is production.');
	}
	if (/prod|production/i.test(url)) {
		throw new Error('Refusing to seed: DATABASE_URL looks like a production database.');
	}
}

async function main() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL is not set.');
	assertNotProduction(url);

	const reset = process.argv.includes('--reset');

	if (isPgliteUrl(url)) {
		console.log('Seeding PGlite. Stop `pnpm dev` first — it holds the data directory open.');
		const { client, db } = await createPgliteDb(url);
		try {
			await migratePglite(db);
			await seedDemoData(db, { reset });
		} finally {
			await client.close();
		}
		return;
	}

	const pool = new Pool({ connectionString: url });
	try {
		await seedDemoData(drizzle(pool, { schema, casing: 'snake_case' }), { reset });
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
