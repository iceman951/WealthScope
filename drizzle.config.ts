import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit is used for one thing here: `generate`, which diffs the schema
 * against drizzle/meta and writes the next `drizzle/NNNN_name.sql`. It reads
 * only the schema, so it needs no database and no credentials.
 *
 * Applying migrations is wrangler's job — `pnpm db:migrate` for the local
 * database, `pnpm db:migrate:remote` for the deployed one — because D1 is a
 * binding, not a connection string, and wrangler tracks what has been applied
 * in the database's `d1_migrations` table. wrangler.jsonc points
 * `migrations_dir` at the same `drizzle/` folder, so there is one set of SQL.
 */
export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './drizzle',
	dialect: 'sqlite',
	strict: true,
	verbose: true
});
