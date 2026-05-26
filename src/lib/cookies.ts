// Helper pentru gestionarea preferințelor de cookies (conform GDPR + ePrivacy).
// Salvează decizia în localStorage cu versiune — la schimbarea politicii, banner-ul reapare.

import { writable, get } from 'svelte/store';

export const COOKIE_VERSION = '1.0';
const STORAGE_KEY = 'gdpr_consent_v';

export type CookieCategory = 'necesare' | 'functionale' | 'analytics' | 'marketing';

export interface CookiePrefs {
	versiune:    string;
	necesare:    true;          // mereu true — strict necesare
	functionale: boolean;
	analytics:   boolean;
	marketing:   boolean;
	salvat_la:   string;        // ISO timestamp
}

function defaultPrefs(): CookiePrefs {
	return {
		versiune:    COOKIE_VERSION,
		necesare:    true,
		functionale: false,
		analytics:   false,
		marketing:   false,
		salvat_la:   new Date().toISOString(),
	};
}

function load(): CookiePrefs | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CookiePrefs;
		// Forțează re-acceptare la schimbarea versiunii
		if (parsed.versiune !== COOKIE_VERSION) return null;
		return parsed;
	} catch { return null; }
}

function save(prefs: CookiePrefs) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export const cookiePrefs = writable<CookiePrefs | null>(load());

export const cookies = {
	get():        CookiePrefs | null { return get(cookiePrefs); },
	hasDecided(): boolean             { return load() !== null; },

	acceptAll() {
		const p: CookiePrefs = { ...defaultPrefs(), functionale: true, analytics: true, marketing: true };
		save(p); cookiePrefs.set(p);
	},
	rejectAll() {
		const p = defaultPrefs();
		save(p); cookiePrefs.set(p);
	},
	saveCustom(prefs: { functionale: boolean; analytics: boolean; marketing: boolean }) {
		const p: CookiePrefs = { ...defaultPrefs(), ...prefs };
		save(p); cookiePrefs.set(p);
	},
	reset() {
		if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
		cookiePrefs.set(null);
	},

	// Helper pentru a verifica o categorie înainte de a încărca un script (GA, Meta etc.)
	allowed(category: CookieCategory): boolean {
		const p = load();
		if (!p) return category === 'necesare';
		return p[category] === true;
	},
};
