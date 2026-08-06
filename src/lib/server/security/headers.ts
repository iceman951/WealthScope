/**
 * Security headers.
 *
 * The CSP allows exactly what the app uses: its own scripts and styles (SvelteKit
 * emits inline hydration data and the design system uses inline style attributes),
 * Google Fonts for Archivo, and nothing else. No external script host, no frame
 * ancestors, no plugin content.
 */

export function securityHeaders(isDev: boolean): Record<string, string> {
	const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";

	const csp = [
		"default-src 'self'",
		`script-src ${scriptSrc}`,
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		'font-src https://fonts.gstatic.com',
		"img-src 'self' data: blob:",
		"connect-src 'self'",
		"worker-src 'self' blob:",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		'upgrade-insecure-requests'
	].join('; ');

	const headers: Record<string, string> = {
		'Content-Security-Policy': csp,
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'X-Frame-Options': 'DENY',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
		'Cross-Origin-Opener-Policy': 'same-origin'
	};

	if (!isDev) {
		headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
	}

	return headers;
}

/**
 * Personalised HTML must never sit in a shared cache. Applied to every response
 * from a protected route.
 */
export const PRIVATE_CACHE_CONTROL = 'private, no-store, max-age=0';
