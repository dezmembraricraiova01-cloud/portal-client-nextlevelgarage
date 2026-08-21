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
	// Craiova, nu Cluj-Napoca: atelierul e pe Str. Râului nr. 391 (Setări → Date
	// firmă, firma NLG). Subsolul ăsta e pe ecranul de login, deci orașul greșit
	// era primul lucru pe care-l citea un client nou.
	subsol: 'Next Level Garage · Servicii auto Craiova'
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
 * Se cheama o data, din layoutul radacina, cu URL-ul paginii curente.
 *
 * Trei semnale, in ordinea increderii:
 *  1. `?return=` catre magazin — omul a venit sa se logheze si se intoarce acolo;
 *  2. `?din=piesa365` — marcaj explicit pus de linkurile din meniul magazinului,
 *     care NU duc inapoi (Portal client, Profilul meu), deci n-au ce cauta un
 *     `return`;
 *  3. `document.referrer` — plasa de siguranta pentru orice alt link din magazin
 *     pe care l-am uitat. Poate lipsi, daca politica de referrer il taie.
 * Daca niciunul nu spune nimic, ramane ce s-a memorat la vizita dinainte.
 */
export function initMarca(url: URL): void {
	const safe = safeReturnUrl(url.searchParams.get('return'));
	if (safe) {
		try {
			// `return` e semnal complet: spune si cand NU e magazin (ex. wms.test).
			seteaza(SSO_HANDOFF_ORIGINS.includes(new URL(safe).origin) ? 'piesa365' : 'nlg');

			return;
		} catch {
			/* URL stricat — cadem pe semnalele de mai jos */
		}
	}

	const din = url.searchParams.get('din');
	if (din === 'piesa365' || din === 'nlg') {
		seteaza(din);

		return;
	}

	if (typeof document !== 'undefined' && document.referrer && aplicaOrigine(document.referrer)) {
		return;
	}

	try {
		const salvat = localStorage.getItem(CHEIE_STORAGE);
		if (salvat === 'piesa365' || salvat === 'nlg') curenta = salvat === 'piesa365' ? PIESA365 : NLG;
	} catch {
		/* localStorage indisponibil — ramane implicitul */
	}
}

/**
 * Doar pentru referrer: poate DOAR sa aprinda Piesa365, niciodata sa o stinga.
 * Un referrer strain (motor de cautare, link din mail) nu spune nimic despre
 * marca, deci nu trebuie sa reseteze ce stim deja.
 */
function aplicaOrigine(url: string): boolean {
	try {
		const origine = new URL(url).origin;
		if (!SSO_HANDOFF_ORIGINS.includes(origine)) return false;

		seteaza('piesa365');

		return true;
	} catch {
		return false;
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
