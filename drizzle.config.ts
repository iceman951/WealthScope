import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * `drizzle-kit generate` only reads the schema, so it works without a connection.
 * `migrate`, `push` and `studio` need DATABASE_URL and fail loudly without it.
 */
export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL ?? '' },
	strict: true,
	verbose: true
});
