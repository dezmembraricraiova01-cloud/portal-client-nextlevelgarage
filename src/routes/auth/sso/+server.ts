import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { COOKIE_MAX_AGE } from '$lib/sso';

const API = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';

/**
 * GET /auth/sso?code=…&to=/dashboard&din=piesa365
 *
 * Receptorul handoff-ului INVERS: clientul e logat în magazin și apasă „Portal
 * client". Magazinul nu ne poate da cookie-ul lui (domenii înregistrabile
 * diferite), așa că ne predă un cod one-time, valabil 60 de secunde și
 * consumabil o singură dată. Îl schimbăm server-to-server pe o sesiune de portal
 * și o punem în cookie-ul nostru first-party.
 *
 * Oglinda lui `/api/auth/sso-redirect`, care face exact drumul invers.
 *
 * Secretul vine din env-ul PRIVAT, nu dintr-o variabilă `VITE_`: alea sunt
 * inlinuite în bundle-ul trimis browserului, adică ar fi publice.
 */
export const GET: RequestHandler = async ({ url, cookies, fetch }) => {
	const to     = destinatie(url.searchParams.get('to'), url.searchParams.get('din'));
	const code   = (url.searchParams.get('code') ?? '').trim();
	const secret = env.PORTAL_API_SECRET ?? '';

	// Orice eșec duce omul TOT unde a cerut, doar nelogat — paznicul îl va trimite
	// la login. Mai bine decât o pagină de eroare pentru ceva ce el n-a greșit.
	// Secret nesetat = handoff inactiv, nu deschis.
	if (!code || code.length > 128 || !secret) redirect(302, to);

	let token = '';
	try {
		const res = await fetch(`${API}/api/portal/sso/exchange`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'X-Portal-Secret': secret
			},
			body: JSON.stringify({ code })
		});

		if (res.ok) token = (await res.json()).token ?? '';
	} catch {
		/* WMS indisponibil — cădem pe redirectul nelogat de mai jos */
	}

	// `redirect` aruncă, deci NU are voie să stea în try: ar fi prins de catch.
	if (!token) redirect(302, to);

	// Aceleași reguli ca la login-ul cu OTP (vezi /api/auth/verify): domeniul se
	// derivă din host-ul REAL, altfel pe *.pages.dev cookie-ul e respins.
	const peDomeniulNlg = url.hostname.endsWith('nextlevelgarage.com');

	cookies.set('portal_token', token, {
		httpOnly: true,
		secure: url.protocol === 'https:',
		sameSite: 'lax',
		path: '/',
		...(peDomeniulNlg ? { domain: '.nextlevelgarage.com' } : {}),
		maxAge: COOKIE_MAX_AGE
	});

	redirect(302, to);
};

/**
 * Doar cale relativă în portal — fără host străin, deci fără redirect deschis.
 * Marca (`din`) se duce mai departe, altfel omul ajunge logat dar pe NLG.
 */
function destinatie(rawTo: string | null, din: string | null): string {
	let cale = rawTo ?? '';

	if (cale === '' || cale[0] !== '/' || cale.startsWith('//') || cale.includes('\\')) {
		cale = '/dashboard';
	}

	if (din !== 'piesa365' && din !== 'nlg') return cale;

	return cale + (cale.includes('?') ? '&' : '?') + 'din=' + din;
}
