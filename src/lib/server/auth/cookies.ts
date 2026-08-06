import type { Cookies } from '@sveltejs/kit';

/**
 * Better Auth issues its session cookie on its own `Headers`. A SvelteKit form
 * action cannot forward a raw `Set-Cookie`, so each one is parsed and re-issued
 * through `cookies.set` with the same attributes.
 */

export function applyAuthCookies(cookies: Cookies, headers: Headers): number {
	const values = headers.getSetCookie();
	for (const header of values) {
		const parsed = parseSetCookie(header);
		if (parsed) cookies.set(parsed.name, parsed.value, parsed.options);
	}
	return values.length;
}

interface ParsedCookie {
	name: string;
	value: string;
	options: {
		path: string;
		httpOnly: boolean;
		secure: boolean;
		sameSite: 'lax' | 'strict' | 'none';
		maxAge?: number;
		expires?: Date;
		domain?: string;
	};
}

export function parseSetCookie(header: string): ParsedCookie | null {
	const [pair, ...rest] = header.split(';');
	const separator = pair.indexOf('=');
	if (separator === -1) return null;

	const name = pair.slice(0, separator).trim();
	// SvelteKit re-encodes on the way out, so decode what Better Auth encoded.
	const value = decodeURIComponent(pair.slice(separator + 1).trim());

	const attributes = new Map<string, string>();
	for (const attribute of rest) {
		const [key, ...valueParts] = attribute.split('=');
		attributes.set(key.trim().toLowerCase(), valueParts.join('=').trim());
	}

	const sameSiteRaw = attributes.get('samesite')?.toLowerCase();
	const sameSite: 'lax' | 'strict' | 'none' =
		sameSiteRaw === 'strict' || sameSiteRaw === 'none' ? sameSiteRaw : 'lax';

	const maxAgeRaw = attributes.get('max-age');
	const maxAge = maxAgeRaw !== undefined ? Number(maxAgeRaw) : undefined;
	const expiresRaw = attributes.get('expires');
	const expires = expiresRaw ? new Date(expiresRaw) : undefined;

	return {
		name,
		value,
		options: {
			path: attributes.get('path') || '/',
			httpOnly: attributes.has('httponly'),
			secure: attributes.has('secure'),
			sameSite,
			...(maxAge !== undefined && Number.isFinite(maxAge) ? { maxAge } : {}),
			...(expires && !Number.isNaN(expires.getTime()) ? { expires } : {}),
			...(attributes.get('domain') ? { domain: attributes.get('domain') } : {})
		}
	};
}
