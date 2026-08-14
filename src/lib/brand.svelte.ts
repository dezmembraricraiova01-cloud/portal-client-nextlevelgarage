// Marca portalului urmează site-ul din care a venit clientul.
//
// Cine intră din magazin vede Piesa365 peste tot si pe toata sesiunea, nu doar
// pe primul ecran — de aceea alegerea se tine minte in localStorage, la fel ca
// originea folosita de butonul „Înapoi în site" (vezi sso.ts).
//
// Implicit ramane NLG: portalul e al service-ului, iar Piesa365 se aprinde doar
// cand clientul chiar vine de acolo.
//
// ATENTIE: astea sunt doar numele afisate. Paginile legale (confidentialitate,
// termeni, cookies, drepturi) NU se rebranduiesc — acolo „Next Level Garage" e
// operatorul de date, adica firma care raspunde legal, nu o sigla.

import { SSO_HANDOFF_ORIGINS, safeReturnUrl } from './sso';

const CHEIE_STORAGE = 'portal_marca';

export type Marca = {
	cheie: 'piesa365' | 'nlg';
	nume: string;
	/** De la ce indice din `nume` se coloreaza cu accentul — ca in shop: Piesa365. */
	accentDeLa: number | null;
	subtitlu: string;
	subsol: string;
};

const NLG: Marca = {
	cheie: 'nlg',
	nume: 'NLG Portal',
	accentDeLa: null,
	subtitlu: 'Servicii auto premium — la un SMS distanță',
	subsol: 'Next Level Garage · Servicii auto Cluj-Napoca'
};

// Scrisa exact ca in magazin: „Piesa" + „365" pe culoarea de accent. Subsolul e
// formula lor din footer, care tine firma la vedere fara sa ascunda cine e.
const PIESA365: Marca = {
	cheie: 'piesa365',
	nume: 'Piesa365',
	accentDeLa: 5,
	subtitlu: 'Contul tău — mașini, comenzi și documente',
	subsol: 'Piesa365 — by Next Level Garage'
};

let curenta = $state<Marca>(NLG);

export const marca = {
	get val(): Marca {
		return curenta;
	}
};

/**
 * Se cheama o data, din layoutul radacina. `returnRaw` e parametrul ?return=
 * al paginii curente: cand exista si duce spre magazin, marca devine Piesa365
 * si ramane asa; cand lipseste, se foloseste ce s-a memorat inainte.
 */
export function initMarca(returnRaw: string | null | undefined): void {
	const safe = safeReturnUrl(returnRaw);

	if (safe) {
		try {
			seteaza(SSO_HANDOFF_ORIGINS.includes(new URL(safe).origin) ? 'piesa365' : 'nlg');

			return;
		} catch {
			/* URL stricat — cadem pe ce e memorat */
		}
	}

	try {
		const salvat = localStorage.getItem(CHEIE_STORAGE);
		if (salvat === 'piesa365' || salvat === 'nlg') curenta = salvat === 'piesa365' ? PIESA365 : NLG;
	} catch {
		/* localStorage indisponibil — ramane implicitul */
	}
}

function seteaza(cheie: Marca['cheie']): void {
	curenta = cheie === 'piesa365' ? PIESA365 : NLG;

	try {
		localStorage.setItem(CHEIE_STORAGE, cheie);
	} catch {
		/* ignoram */
	}
}
