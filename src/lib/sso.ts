// SSO în ecosistem — configurația centrală.
//
// Domeniile înregistrabile diferă (portal pe pages.dev / nextlevelgarage.com,
// shop pe piesa365.ro), deci cookie-ul `portal_token` NU poate traversa între
// ele. Pentru domeniile din SSO_HANDOFF_ORIGINS folosim handoff cu cod
// one-time: /api/auth/sso-redirect cere codul de la WMS și îl predă
// receptorului `/auth/sso` de pe domeniul țintă, care își setează propriul
// cookie first-party.

// Originile acceptate pentru ?return= — potrivire EXACTĂ pe origin
// (startsWith pe prefix permitea `https://piesa365.ro.evil.com`).
export const TRUSTED_ORIGINS = [
	// Local dev (Laragon vhosts)
	'http://piesata.test',
	'http://piesa365.test',
	'http://nlg-portal.test',
	'http://web_nextlevelgarage.test',
	'http://web.nextlevelgarage.test',
	'http://wms.test',
	// Producție
	'https://www.piesa365.ro',
	'https://piesa365.ro',
	'https://piesata.nextlevelgarage.com',
	'https://nlg-portal.nextlevelgarage.com',
	'https://client.nextlevelgarage.com',
	'https://nextlevelgarage.com',
	'https://www.nextlevelgarage.com',
	'https://web.nextlevelgarage.ro',
	'https://www.nextlevelgarage.ro',
	'https://nextlevelgarage.ro'
];

// Domeniile care nu pot citi cookie-ul portalului → primesc handoff.
export const SSO_HANDOFF_ORIGINS = [
	'http://piesata.test',
	'http://piesa365.test',
	'https://www.piesa365.ro',
	'https://piesa365.ro'
];

// Site-ul implicit pentru butonul „Înapoi în site".
export const DEFAULT_SITE_ORIGIN = 'https://www.piesa365.ro';

// Durata sesiunii — ținută în sincron cu TOKEN_EXPIRY_DAYS din WMS
// (AuthController portal). Cookie-ul alunecă la fiecare vizită; tokenul
// WMS expiră fix la 30 de zile de la emitere.
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function safeReturnUrl(raw: string | null | undefined): string | null {
	if (!raw) return null;
	try {
		const url = new URL(decodeURIComponent(raw));
		return TRUSTED_ORIGINS.includes(url.origin) ? url.href : null;
	} catch {
		return null;
	}
}

export function needsHandoff(url: string): boolean {
	try {
		return SSO_HANDOFF_ORIGINS.includes(new URL(url).origin);
	} catch {
		return false;
	}
}

// ── Memoria site-ului de origine (localStorage, doar client) ────────────────

const ORIGIN_KEY = 'portal_site_origin';

export function rememberSiteOrigin(url: string): void {
	try {
		const origin = new URL(url).origin;
		if (TRUSTED_ORIGINS.includes(origin)) localStorage.setItem(ORIGIN_KEY, origin);
	} catch { /* localStorage indisponibil — ignorăm */ }
}

export function siteOrigin(): string {
	try {
		const saved = localStorage.getItem(ORIGIN_KEY);
		if (saved && TRUSTED_ORIGINS.includes(saved)) return saved;
	} catch { /* ignorăm */ }
	return DEFAULT_SITE_ORIGIN;
}

// Href-ul butonului „Înapoi în site" — trece prin sso-redirect ca să ducă
// și sesiunea cu el (domeniile handoff primesc cod one-time pe drum).
export function siteExitHref(target?: string): string {
	return '/api/auth/sso-redirect?to=' + encodeURIComponent(target ?? siteOrigin() + '/');
}
