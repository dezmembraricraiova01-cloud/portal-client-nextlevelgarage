import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const API = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';
const IS_PROD = import.meta.env.PROD;

export const POST: RequestHandler = async ({ cookies, locals }) => {
	const token = locals.portalToken;

	if (token) {
		// Revoca token-ul pe Laravel (best-effort — nu blocam logout-ul local)
		await fetch(`${API}/api/portal/auth/logout`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
		}).catch(() => {});
	}

	// Sterge cookie cu acelasi domain pe care a fost setat.
	// In dev nu folosim domain (Chrome respinge '.test' ca public suffix).
	cookies.delete('portal_token', {
		path: '/',
		...(IS_PROD ? { domain: '.nextlevelgarage.com' } : {})
	});

	return json({ message: 'Deconectat.' });
};
