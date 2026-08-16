#!/usr/bin/env node
/**
 * Verifică diacriticele în textul citit de om.
 *
 * De ce nu un grep: un `grep -E "\b(masina|pret|fara)\b"` peste `src` scoate ~342
 * de rezultate în portal, din care aproape toate sunt COD — rute
 * (`/dashboard/masini`), câmpuri (`masina.marca`), funcții (`sterge()`), chei de
 * obiect. Semnalul se îneacă în zgomot, iar o convenție pe care n-o poți verifica
 * nu se aplică. Scriptul ăsta separă textul de cod înainte să caute.
 *
 * Ce se verifică:
 *   - nodurile de text din marcaj (ce e între tag-uri);
 *   - atributele citite de om: placeholder, title, aria-label, alt;
 *   - literalii de șir din script, mai puțin cei care arată a cod (căi, URL-uri,
 *     identificatori snake_case).
 *
 * Ce NU se verifică, deliberat: rute, clase CSS, chei, `data-*`, id-uri.
 * Regula, pe scurt: dacă îl citește un om, are diacritice. Dacă îl citește
 * mașina, nu.
 *
 *   node scripts/diacritice.mjs           # raport; exit 1 dacă găsește ceva
 *   node scripts/diacritice.mjs --toate   # arată și fișierele curate
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RADACINA = 'src';

/**
 * Cuvinte care NU au formă corectă fără diacritice — dacă apar așa în text
 * vizibil, e greșeală indiferent de context.
 *
 * Perechile ambigue (`piesa`/`piesă`, `comanda`/`comandă`, `sa`/`să`, `ca`/`că`)
 * sunt LĂSATE AFARĂ intenționat: acolo ambele forme sunt corecte, iar alegerea
 * cere citit contextul. Un verificator care le-ar semnala ar produce zgomot, și
 * atunci nimeni nu l-ar mai rula.
 */
const GRESELI = [
	'si',
	'masina', 'masini', 'masinii', 'masinile',
	'reparatie', 'reparatii', 'reparatia', 'reparatiile',
	'garantie', 'garantii', 'garantia',
	'pret', 'preturi', 'pretul', 'preturile',
	'fara', 'doua',
	'inlocuire', 'inlocuirea', 'inlocuit',
	'adauga', 'sterge', 'sters', 'stearsa',
	'inchiriere', 'inchirieri', 'inchirierea', 'inchiriat',
	'urmatoarea', 'urmatorul', 'urmatoare',
	'astazi', 'maine', 'iti',
	'inainte', 'inapoi', 'inca',
	'incarca', 'incarcare', 'incearca',
	'anuleaza', 'salveaza',
	'disponibila', 'indisponibila',
	'saptamana', 'inregistrare', 'inregistrat',
	'inchide', 'inchis', 'sofer', 'soferi',
	'numar', 'raspuns', 'raspunde', 'gaseste',
	'vanzare', 'cumparare',
];

// NU intră aici cuvinte corecte fără diacritice — `zile`, `luni`, `tine`,
// `trimite`, `alege`, `programare`, `disponibile`. Prima versiune le avea și
// scotea 244 de „greșeli" din care niciuna nu era greșeală: un verificator care
// urlă degeaba nu mai e rulat de nimeni.
//
// Nu intră nici perechile unde AMBELE forme sunt corecte și alegerea ține de
// gramatică, nu de ortografie: `piesa`/`piesă`, `comanda`/`comandă`,
// `factura`/`factură`, `data`/`dată`, `adresa`/`adresă`, `sa`/`să`, `ca`/`că`.
// Alea cer citit contextul; niciun script nu le poate decide.
const TIPAR = new RegExp(`\\b(${GRESELI.join('|')})\\b`, 'gi');

/** Șir care arată a cod, nu a text pentru om. */
function pareCod(s) {
	if (s.includes('/') || s.includes('://')) return true;       // rute, URL-uri
	if (/^[a-z0-9_.]+$/.test(s)) return true;                     // chei, identificatori
	if (/^[a-z0-9-]+$/.test(s) && !s.includes(' ')) return true;  // clase, slug-uri
	if (/^[A-Z_]+$/.test(s)) return true;                         // constante
	// Cioburi de expresie rămase dintr-un șablon rupt pe mai multe linii
	// (`} · ${wo.masina?.marca ??`). Parantezele simple NU se resping: apar în
	// text adevărat — „(opțional)", „(UE) 2016/679".
	if (/\$\{|\?\.|=>|\?\?|[{}]|\.\w+\(/.test(s)) return true;
	return false;
}

/** Curăță expresiile dintr-un șir, ca să rămână doar textul. */
function faraExpresii(s) {
	return s.replace(/\$\{[^}]*\}/g, ' ').replace(/\{[^}]*\}/g, ' ').trim();
}

/** Bucățile de text citit de om dintr-un fișier .svelte / .ts. */
function bucatiDeText(sursaBruta, areMarcaj) {
	const bucati = [];

	// Comentariile ies din verificare: convenția e despre ce vede CLIENTUL, iar
	// un comentariu îl citește doar cine umblă prin cod. Dacă n-ar ieși, raportul
	// s-ar umple cu note tehnice și adevăratele scăpări din interfață s-ar pierde.
	const sursa = sursaBruta
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/^[ \t]*\/\/.*$/gm, ' ')
		.replace(/([^:'"`])\/\/.*$/gm, '$1');

	// 1. Atributele citite de om — se extrag ÎNAINTE de a arunca tag-urile.
	for (const m of sursa.matchAll(/\b(placeholder|title|aria-label|alt)\s*=\s*["']([^"']+)["']/g)) {
		const t = faraExpresii(m[2]);
		if (t) bucati.push(t);
	}

	// 2. Literalii de șir din script (etichete de meniu, mesaje de eroare).
	//    `${...}` e cod, nu text: fără scoaterea lui, un `${masina.marca}` s-ar
	//    raporta ca „masina fără diacritice", iar raportul ar fi doar zgomot.
	for (const m of sursa.matchAll(/(['"`])((?:[^'"`\\\n]|\\.){2,})\1/g)) {
		const doarText = faraExpresii(m[2]);
		if (doarText && /\p{L}/u.test(doarText) && !pareCod(doarText)) bucati.push(doarText);
	}

	// Un `.ts` n-are marcaj: pasul 3 i-ar trata fiecare linie de cod ca text
	// (`export interface Masina` raportat ca greșeală). Se oprește aici.
	if (!areMarcaj) return bucati;

	// 3. Nodurile de text din marcaj. Scoatem întâi tot ce e cod.
	let marcaj = sursa
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ');

	// Expresiile Svelte pot fi imbricate (`{a ? `${b}` : 'c'}`), iar un singur
	// pas ar lăsa cioburi de cod în text. Repetăm până nu mai scade nimic.
	for (let inainte = ''; inainte !== marcaj; ) {
		inainte = marcaj;
		marcaj = marcaj.replace(/\{[^{}]*\}/g, ' ');
	}

	marcaj = marcaj.replace(/<[^>]+>/g, '\n'); // tag-urile pleacă, textul rămâne

	for (const linie of marcaj.split('\n')) {
		const t = linie.trim();
		if (t) bucati.push(t);
	}

	return bucati;
}

function fisiere(dir) {
	const gasite = [];
	for (const nume of readdirSync(dir)) {
		const cale = join(dir, nume);
		if (statSync(cale).isDirectory()) gasite.push(...fisiere(cale));
		else if (/\.(svelte|ts)$/.test(nume)) gasite.push(cale);
	}
	return gasite;
}

/**
 * Două stricăciuni mecanice, fără ambiguitate — se caută în TOT fișierul, nu
 * doar în textul vizibil, fiindcă niciuna n-are ce căuta nici în cod:
 *
 *  - mojibake: UTF-8 citit ca CP1252 (`È™` în loc de `ș`). A fost găsit exact
 *    așa în formularul GDPR, 127 de apariții, pe o pagină arătată clientului.
 *  - sedilă: `ş`/`ţ` (U+015F, U+0163) sunt turcești. Arată aproape ca `ș`/`ț`
 *    (U+0219, U+021B), dar rup căutarea în pagină.
 */
const MOJIBAKE = /Ã.|Ä.|È.|â€/g;
const SEDILA = /[şţŞŢ]/g;

const toate = process.argv.includes('--toate');
let gasiri = 0;
let cuProbleme = 0;
const listaFisiere = fisiere(RADACINA);

for (const cale of listaFisiere) {
	const sursa = readFileSync(cale, 'utf8');
	const alFisierului = [];

	const moji = [...sursa.matchAll(MOJIBAKE)];
	if (moji.length) alFisierului.push({ bucata: `MOJIBAKE — UTF-8 citit ca CP1252`, hituri: moji.map((m) => m[0]).slice(0, 6) });

	const sed = [...sursa.matchAll(SEDILA)];
	if (sed.length) alFisierului.push({ bucata: `SEDILĂ turcească în loc de virgulă`, hituri: sed.map((m) => m[0]).slice(0, 6) });

	// Aceeași bucată poate fi prinsă de două ori (un `alt="…"` e și atribut, și
	// literal de șir). Raportăm o singură dată.
	for (const bucata of new Set(bucatiDeText(sursa, cale.endsWith('.svelte')))) {
		const hituri = [...bucata.matchAll(TIPAR)].map((m) => m[0]);
		if (hituri.length) alFisierului.push({ bucata, hituri });
	}

	if (alFisierului.length) {
		cuProbleme++;
		console.log(`\n${relative('.', cale)}`);
		for (const { bucata, hituri } of alFisierului) {
			gasiri += hituri.length;
			const scurt = bucata.length > 90 ? bucata.slice(0, 90) + '…' : bucata;
			console.log(`  ${[...new Set(hituri)].join(', ').padEnd(22)} ${scurt}`);
		}
	} else if (toate) {
		console.log(`ok  ${relative('.', cale)}`);
	}
}

console.log(
	gasiri === 0
		? `\nDiacritice OK — ${listaFisiere.length} fișiere, niciun cuvânt fără diacritice în text vizibil.`
		: `\n${gasiri} apariții în ${cuProbleme} din ${listaFisiere.length} fișiere.`
);

process.exit(gasiri === 0 ? 0 : 1);
