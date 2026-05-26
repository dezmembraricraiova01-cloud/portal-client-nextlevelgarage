import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Pune token-ul din httpOnly cookie in locals — accesibil in server routes
	event.locals.portalToken = event.cookies.get('portal_token') ?? null;
	return resolve(event);
};
