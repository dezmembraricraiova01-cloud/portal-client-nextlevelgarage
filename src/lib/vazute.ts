/**
 * Mașinile de închiriat deja deschise de om, în sesiunea asta — cele mai
 * recente primele. Servesc la un singur lucru: când se uită la a doua, a
 * treia mașină, cele văzute stau primele în bandă și în listă, cu o pastilă
 * „Văzută", ca să nu le caute iar („aia albă de mai devreme era…?").
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

/** Poziția în istoric, pentru sortare: 0 = cea mai recentă; Infinity = nevăzută. */
export function rangVazuta(vazute: number[], id: number): number {
	const i = vazute.indexOf(id);
	return i < 0 ? Infinity : i;
}
