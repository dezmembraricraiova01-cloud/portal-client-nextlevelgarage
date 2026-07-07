import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const API = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';

// Gating-ul real e in WMS: dev-login raspunde 404 fara cheia secreta corecta (X-Dev-Key).
// Cheia vine de la browser (Ctrl+Shift+X) si e forwardata catre WMS — nu e stocata in bundle.
export const GET: RequestHandler = async ({ cookies, url, request }) => {
	const devKey = request.headers.get('x-dev-key') ?? '';

	const upstream = await fetch(`${API}/api/portal/auth/dev-login`, {
		headers: { Accept: 'application/json', 'X-Dev-Key': devKey }
	});

	if (!upstream.ok) {
		const err = await upstream.json().catch(() => ({ message: 'Dev login eșuat.' }));
		return json(err, { status: upstream.status });
	}

	const data = await upstream.json();

	// NB: nu setam domain='.test' — Chrome respinge cookie-uri pe TLD rezervat (public suffix).
	// Cookie ramane host-only; SSO catre piesata.test se face altfel (vezi InjectPortalUser).
	// secure derivat din protocol: pe https (pages.dev) un cookie non-secure poate fi ignorat.
	cookies.set('portal_token', data.token, {
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 7
	});

	const meRes = await fetch(`${API}/api/portal/auth/me`, {
		headers: { Authorization: `Bearer ${data.token}`, Accept: 'application/json' }
	});
	const fullClient = meRes.ok ? await meRes.json() : data.client;

	return json({ client: fullClient });
};
