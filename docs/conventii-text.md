# Convenție de scriere — text vizibil

Aceeași convenție ca pe site-ul public ([`nlg/docs/conventii-text.md`](https://github.com/dezmembraricraiova01-cloud/nlg)), adaptată la portal. Diferența e că portalul **era deja aproape conform** — 6.918 caractere cu diacritice față de o coadă de scăpări — deci aici documentul nu descrie o conversie, ci apără ce există.

## Regula

**Tot textul românesc pe care îl vede clientul se scrie cu diacritice**, complet și corect: `ă â î ș ț`.

Se folosesc `ș` și `ț` cu **virgulă dedesubt** (U+0219, U+021B), nu cu sedilă (`ş`, `ţ` — U+015F, U+0163). Arată aproape la fel, dar sunt caractere diferite: cele cu sedilă sunt turcești și rup căutarea în pagină.

## Ce NU se atinge

Diacriticele intră doar în **text citit de om**. Rămân neatinse:

- rutele: `/dashboard/masini`, `/dashboard/reparatii` — o rută cu diacritice se codifică urât și strică linkurile existente
- cheile din API și din obiecte: `masina_activa`, `tarif_de_la`, `numar_inmatriculare`
- numele de clase CSS, `data-*`, id-uri, ancore
- numele de variabile, funcții și tipuri: `sterge()`, `interface Masina`
- **comentariile din cod** — le citește cine umblă prin cod, nu clientul

Pe scurt: dacă îl citește un om în interfață, are diacritice. Dacă îl citește mașina, nu.

## Capcana: perechi unde ambele forme sunt corecte

Nu orice cuvânt fără diacritice e greșeală. Astea sunt **decizii gramaticale**, nu de ortografie, și nu se pot verifica automat:

| formă | când e corectă |
|---|---|
| `piesă` / `piesa` | „o **piesă** nouă" (nearticulat) / „**piesa** de schimb" (articulat) |
| `comandă` / `comanda` | „plasezi o **comandă**" / „**comanda** ta" |
| `factură` / `factura` | la fel |
| `dată` / `data` | „o **dată**" / „**data** programării" |
| `adresă` / `adresa` | la fel |
| `să` / `sa` | „vrem **să** ajutăm" / „mașina **sa**" |
| `că` / `ca` | „știm **că** te grăbești" / „rapid **ca** un service bun" |

Verificatorul le lasă în pace deliberat.

Atenție și la capcana inversă: `zile`, `luni`, `tine`, `trimite`, `alege`, `programare`, `disponibile` **sunt corecte fără diacritice**. Prima versiune a verificatorului le avea în listă și scotea 244 de „greșeli" din care niciuna nu era greșeală.

## Verificare

```bash
node scripts/diacritice.mjs           # exit 1 dacă găsește ceva
node scripts/diacritice.mjs --toate   # arată și fișierele curate
```

Scriptul **separă textul de cod înainte să caute** — asta e tot rostul lui. Un `grep -E "\b(masina|pret|fara)\b" src` scoate ~342 de rezultate, din care aproape toate sunt rute, câmpuri și chei. Semnalul se îneacă în zgomot, iar o convenție pe care n-o poți verifica nu se aplică.

Se uită la patru locuri:

1. nodurile de text din marcaj (ce e între tag-uri);
2. atributele citite de om: `placeholder`, `title`, `aria-label`, `alt`;
3. literalii de șir din script — etichete de meniu, mesaje de eroare — mai puțin cei care arată a cod;
4. partea de text a șabloanelor, după ce scoate `${…}`.

Plus două stricăciuni mecanice, căutate în tot fișierul:

- **mojibake** — UTF-8 citit ca CP1252 (`È™` în loc de `ș`);
- **sedilă** turcească.

**Nu folosi înlocuire globală.** `si` → `și` lovește în interiorul cuvintelor (`asigurare`, `sistem`, `servicii`), iar `masina` apare în chei și rute. Se merge pe șiruri de text, nu pe caractere.

## Incidentul care a motivat verificarea de mojibake

`src/routes/legal/service-consimtamant/+page.svelte` — formularul de consimțământ GDPR — avea **127 de secvențe stricate**: `FORMULAR DE INFORMARE È˜I CONSIMÈšÄ‚MÃ‚NT`. O pagină legală, arătată clientului, ilizibilă.

Reparația n-a fost o conversie globală: fișierul era **amestecat** (15 diacritice deja corecte), iar `Buffer.from(s,'latin1').toString('utf8')` peste tot producea 63 de caractere de înlociure. A trebuit convertită doar fiecare secvență stricată, acceptând rezultatul numai când decodarea ieșea curată. Rezultat: 127 → 0 mojibake, 15 → 113 diacritice.

Un caracter n-a putut fi recuperat automat: selectorul de variație al emoji-ului de imprimantă. Octetul `0x8F` nu are corespondent în CP1252, deci se pierduse la stricarea inițială.

## Stare

Portal: conform la 16.08.2026, verificat cu `scripts/diacritice.mjs` — 76 de fișiere, zero apariții.
