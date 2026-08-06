/**
 * Only same-origin relative paths are honoured as a post-sign-in destination.
 * An absolute URL, a protocol-relative `//evil.example` or anything that is not
 * a path falls back to the dashboard, so the parameter cannot be used to bounce
 * a freshly authenticated visitor off-site.
 */
export function safeRedirect(value: string | null | undefined, fallback = '/dashboard'): string {
	if (!value) return fallback;
	if (!value.startsWith('/')) return fallback;
	if (value.startsWith('//')) return fallback;
	if (value.includes('\\')) return fallback;
	return value;
}
