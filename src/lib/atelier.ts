import { writable } from 'svelte/store';
import { api, type Atelier } from './api';

/**
 * Atelierul (nume + adresă + telefon) de pe cardul „Programează-te la service".
 *
 * Cardul apare în două locuri — Acasă și Reparații — iar datele vin din Setări →
 * Date firmă (WMS), nu din cod: dacă atelierul se mută, se schimbă acolo, nu
 * printr-un PR de portal. Se cere o singură dată pe sesiune, ca a doua pagină să
 * nu mai aștepte nimic.
 *
 * `null` = încă n-a venit sau a picat apelul. Rândul cu adresa se ascunde, restul
 * cardului rămâne în picioare — nicio pagină nu depinde de el ca să funcționeze.
 */
export const atelier = writable<Atelier | null>(null);

let cerut = false;

export function incarcaAtelier(): void {
	if (cerut) return;
	cerut = true;

	api.serviceAtelier()
		.then((r) => atelier.set(r.atelier))
		// Eșecul se uită, ca următoarea pagină să mai încerce o dată — offline la
		// prima deschidere nu trebuie să lase cardul fără adresă tot restul sesiunii.
		.catch(() => { cerut = false; });
}

/** Textul de pe card: „Next Level Garage · Str. Râului nr. 391". */
export function atelierLinie(a: Atelier | null): string {
	if (!a) return '';
	return a.adresa ? `${a.denumire} · ${a.adresa}` : a.denumire;
}
