import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Pune token-ul din httpOnly cookie in locals — accesibil in server routes
	event.locals.portalToken = event.cookies.get('portal_token') ?? null;

	const response = await resolve(event);

	// Security headers pe toate response-urile (SSR + edge functions).
	response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	return response;
};
