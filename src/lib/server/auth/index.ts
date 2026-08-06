import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import {
	DEFAULT_BASE_CURRENCY,
	DEFAULT_INFLATION_ASSUMPTION,
	DEFAULT_LOCALE,
	DEFAULT_RETURN_ASSUMPTION,
	DEFAULT_TIMEZONE
} from '$lib/types/domain';
import { getDb } from '../db';
import { account, session, user, userFinancialSettings, verification } from '../db/schema';

/**
 * Better Auth configuration.
 *
 * Sessions are database-backed and carried in an HTTP-only, SameSite=Lax cookie
 * that is Secure in production. The browser never receives anything it could use
 * to impersonate another user, and no user id is ever trusted from a request body.
 */

export type Auth = ReturnType<typeof buildAuth>;

let cached: Auth | null = null;
let cachedSecret: string | null = null;

function buildAuth(secret: string, baseURL: string) {
	const db = getDb();

	return betterAuth({
		secret,
		baseURL,
		basePath: '/api/auth',
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema: { user, session, account, verification }
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 12,
			maxPasswordLength: 200,
			// No mail transport is configured yet, so self-service reset is scaffolded
			// rather than advertised. See docs/security.md for the wiring checklist.
			requireEmailVerification: false,
			autoSignIn: true
		},
		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24,
			cookieCache: { enabled: true, maxAge: 60 * 5 }
		},
		advanced: {
			cookiePrefix: 'wealthscope',
			useSecureCookies: !dev,
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				path: '/'
			}
		},
		trustedOrigins: [baseURL],
		databaseHooks: {
			user: {
				create: {
					// Every user gets a settings row at creation, so no later query has to
					// cope with a missing base currency.
					after: async (created) => {
						await db
							.insert(userFinancialSettings)
							.values({
								userId: created.id,
								baseCurrency: DEFAULT_BASE_CURRENCY,
								locale: DEFAULT_LOCALE,
								timezone: DEFAULT_TIMEZONE,
								fiscalYearStartMonth: 1,
								defaultReturnAssumption: DEFAULT_RETURN_ASSUMPTION,
								defaultInflationAssumption: DEFAULT_INFLATION_ASSUMPTION
							})
							.onConflictDoNothing();
					}
				}
			}
		}
	});
}

export function getAuth(): Auth {
	const secret = env.BETTER_AUTH_SECRET;
	if (!secret) {
		throw new Error(
			'BETTER_AUTH_SECRET is not configured. Set it in .env locally, or as a Worker secret in production.'
		);
	}
	const baseURL = env.BETTER_AUTH_URL ?? 'http://localhost:5173';

	if (!cached || cachedSecret !== secret) {
		cached = buildAuth(secret, baseURL);
		cachedSecret = secret;
	}
	return cached;
}
