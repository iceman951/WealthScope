import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamp } from './columns';

/**
 * Better Auth's required tables. Column names and types follow Better Auth's
 * SQLite/Drizzle contract exactly — the adapter reads and writes them
 * directly, so renaming anything here breaks sign-in.
 *
 * Every financial table joins back to `user.id`.
 */

export const user = sqliteTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: integer('email_verified', { mode: 'boolean' })
			.$defaultFn(() => false)
			.notNull(),
		image: text('image'),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('user_email_idx').on(table.email)]
);

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		// Deleting an account must not leave orphaned sessions behind.
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [
		index('session_user_id_idx').on(table.userId),
		index('session_token_idx').on(table.token)
	]
);

export const account = sqliteTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		/** Argon2/scrypt hash for the email+password provider. Never a plaintext secret. */
		password: text('password'),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull()
	},
	(table) => [index('account_user_id_idx').on(table.userId)]
);

export const verification = sqliteTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at')
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: timestamp('updated_at')
			.$defaultFn(() => new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);
