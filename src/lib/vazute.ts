/**
 * Mașinile de închiriat deja deschise de om, în sesiunea asta — cele mai
 * recente primele. Servesc la un singur lucru: când se uită la a doua, a
 * treia mașină, ULTIMA văzută stă prima în bandă și în listă, cu pastila
 * „Ultima văzută", ca să n-o caute iar („aia albă de mai devreme era…?").
 * Doar una: mai multe pastile „Văzută" se citeau ca o listă de bifat, nu ca
 * un semn de întoarcere.
 *
 * sessionStorage, nu localStorage: e memoria unei căutări, nu un istoric —
 * la o vizită nouă omul pornește curat. Fără server: nu e nimic de sincronizat.
 */
const CHEIE = 'inchirieri.vazute';
const MAX = 12;

export function citesteVazute(): number[] {
	if (typeof sessionStorage === 'undefined') return [];
	try {
		const v = JSON.parse(sessionStorage.getItem(CHEIE) ?? '[]');
		return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)) : [];
	} catch {
		return [];
	}
}

/** Pune mașina în fruntea listei (o singură dată) și întoarce lista nouă. */
export function noteazaVazuta(id: number): number[] {
	const v = [id, ...citesteVazute().filter((x) => x !== id)].slice(0, MAX);
	try {
		sessionStorage.setItem(CHEIE, JSON.stringify(v));
	} catch {
		// spațiu plin sau stocare blocată — rămâne doar în memorie, fișa merge la fel
	}
	return v;
}

/**
 * Ultima mașină văzută, alta decât `curenta` (în fișă, [0] e chiar mașina de pe
 * ecran — n-are sens s-o arătăm ca „ultima văzută" în propria ei bandă). null
 * când n-a fost deschisă încă nicio altă mașină.
 */
export function ultimaVazuta(vazute: number[], curenta: number | null = null): number | null {
	return vazute.find((id) => id !== curenta) ?? null;
}
