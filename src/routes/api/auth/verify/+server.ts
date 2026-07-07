import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const API = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const body = await request.json();

	// Domeniul cookie-ului se derivă din host-ul REAL, nu dintr-un flag de build.
	// Pe *.pages.dev (ex. portal-client-nextlevelgarage.pages.dev) un cookie cu
	// domain='.nextlevelgarage.com' e respins de browser → token pierdut → bounce la login.
	// Setăm domain='.nextlevelgarage.com' (pentru SSO cross-subdomain) DOAR când
	// chiar servim de pe acel domeniu; altfel cookie host-only (pages.dev / .test).
	const onNlgDomain = url.hostname.endsWith('nextlevelgarage.com');
	const isHttps = url.protocol === 'https:';

	const upstream = await fetch(`${API}/api/portal/auth/verify-otp`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body)
	});

	if (!upstream.ok) {
		const err = await upstream.json().catch(() => ({ message: 'Eroare necunoscută.' }));
		return json(err, { status: upstream.status });
	}

	const data = await upstream.json();

	// Token stocat in httpOnly cookie — JS din browser nu are acces.
	// Domain `.test` (dev) / `.nextlevelgarage.com` (prod) permite SSO cross-subdomain
	// catre piesata.test / piesata.nextlevelgarage.com.
	// In dev, NU setam domain='.test' — Chrome il respinge (TLD rezervat = public suffix).
	// In prod ramane '.nextlevelgarage.com' pentru SSO cross-subdomain.
	cookies.set('portal_token', data.token, {
		httpOnly: true,
		secure: isHttps,
		sameSite: 'lax',
		path: '/',
		...(onNlgDomain ? { domain: '.nextlevelgarage.com' } : {}),
		maxAge: 60 * 60 * 24 * 7
	});

	// Extragem datele complete ale clientului — verifyOtp returnează doar {id, nume, telefon, email}
	// dar UI-ul are nevoie de vip, ci_lipsa, consilier etc. din prima clipă
	const meRes = await fetch(`${API}/api/portal/auth/me`, {
		headers: { Authorization: `Bearer ${data.token}`, Accept: 'application/json' }
	});
	const fullClient = meRes.ok ? await meRes.json() : data.client;

	return json({ client: fullClient });
};
