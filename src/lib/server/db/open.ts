import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';

/**
 * Opens a SQLite file and applies pending migrations from ./drizzle. Free of
 * SvelteKit imports so the seed script and integration tests can share it.
 */

export type DbClient = BunSQLiteDatabase<typeof schema> & { $client: Database };

export function openDb(path: string): DbClient {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const sqlite = new Database(path, { create: true });
	sqlite.run('PRAGMA journal_mode = WAL');
	// SQLite ignores every ON DELETE rule in the schema unless this is on.
	sqlite.run('PRAGMA foreign_keys = ON');
	const db = drizzle(sqlite, { schema, casing: 'snake_case' });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}
