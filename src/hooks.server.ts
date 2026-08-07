import type { Handle } from '@sveltejs/kit';
import { COOKIE_MAX_AGE } from '$lib/sso';

export const handle: Handle = async ({ event, resolve }) => {
	// Pune token-ul din httpOnly cookie in locals — accesibil in server routes
	const token = event.cookies.get('portal_token') ?? null;
	event.locals.portalToken = token;

	// Reînnoire glisantă: orice apel API împinge expirarea cookie-ului la 30 de
	// zile de acum. Tokenul WMS are propriul expires_at — cookie-ul doar nu
	// moare înaintea lui. Scoped pe /api/ ca să nu punem Set-Cookie pe assets.
	if (token && event.url.pathname.startsWith('/api/')) {
		const onNlgDomain = event.url.hostname.endsWith('nextlevelgarage.com');
		event.cookies.set('portal_token', token, {
			httpOnly: true,
			secure: event.url.protocol === 'https:',
			sameSite: 'lax',
			path: '/',
			...(onNlgDomain ? { domain: '.nextlevelgarage.com' } : {}),
			maxAge: COOKIE_MAX_AGE
		});
	}

	const response = await resolve(event);

	// Security headers pe toate response-urile (SSR + edge functions).
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};
