import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const API = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';

export const POST: RequestHandler = async ({ cookies, locals, url }) => {
	const token = locals.portalToken;

	if (token) {
		// Revoca token-ul pe Laravel (best-effort — nu blocam logout-ul local)
		await fetch(`${API}/api/portal/auth/logout`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
		}).catch(() => {});
	}

	// Sterge cookie cu ACELASI domain pe care a fost setat (aceeasi deriva ca la
	// login: domain partajat doar pe nextlevelgarage.com; pe pages.dev/.test e
	// host-only). Vechiul `IS_PROD → .nextlevelgarage.com` nu stergea nimic pe
	// pages.dev — domain gresit = cookie ramas in browser.
	const onNlgDomain = url.hostname.endsWith('nextlevelgarage.com');
	cookies.delete('portal_token', {
		path: '/',
		...(onNlgDomain ? { domain: '.nextlevelgarage.com' } : {})
	});

	return json({ message: 'Deconectat.' });
};
