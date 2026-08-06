import type { AuthenticatedUser } from '$lib/types/session';

declare global {
	namespace App {
		interface Locals {
			/** Resolved from the session cookie in hooks.server.ts. Never from a request body. */
			user: AuthenticatedUser | null;
			sessionId: string | null;
		}

		interface Error {
			message: string;
			/** Correlates a user-facing error page with the server log line. */
			code?: string;
		}

		interface PageData {
			user?: AuthenticatedUser | null;
		}

		interface Platform {
			env?: {
				DATABASE_URL?: string;
				BETTER_AUTH_SECRET?: string;
				BETTER_AUTH_URL?: string;
			};
			context?: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches?: CacheStorage;
		}
	}
}

export {};
