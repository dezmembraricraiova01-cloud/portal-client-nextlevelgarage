import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { safeReturnUrl, needsHandoff } from '$lib/sso';

const API = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';

// GET /api/auth/sso-redirect?to=<url>
// Poarta de ieșire din portal către site-urile ecosistemului. Pentru domeniile
// care nu pot citi cookie-ul portalului (piesa365.ro), cere un cod one-time de
// la WMS și îl predă receptorului /auth/sso de pe domeniul țintă — acesta își
// setează propriul cookie și te lasă logat și acolo.
export const GET: RequestHandler = async ({ url, locals, fetch }) => {
	const target = safeReturnUrl(url.searchParams.get('to'));
	if (!target) redirect(302, '/dashboard');

	const token = locals.portalToken;
	if (!token || !needsHandoff(target)) redirect(302, target);

	let code: string | null = null;
	try {
		const res = await fetch(`${API}/api/portal/auth/sso-code`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
		});
		if (res.ok) code = (await res.json()).code ?? null;
	} catch {
		// WMS indisponibil — mergem pe site fără SSO, mai bine decât să blocăm ieșirea.
	}

	if (!code) redirect(302, target);

	const t = new URL(target);
	const receiver = new URL('/auth/sso', t.origin);
	receiver.searchParams.set('code', code);
	receiver.searchParams.set('return', t.pathname + t.search);
	redirect(302, receiver.toString());
};
