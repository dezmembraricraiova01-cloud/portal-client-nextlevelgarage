<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { api, type MasinaInchiriereDetaliu, type MasinaInchiriereCard, type IntervalBlocat, type InchiriereForm, type ExtraOferit, type LocInchiriere, type InchiriereCerere } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';
	import CalendarInterval from '$lib/components/CalendarInterval.svelte';

	let masina    = $state<MasinaInchiriereDetaliu | null>(null);
	let blocate   = $state<IntervalBlocat[]>([]);
	let extras    = $state<ExtraOferit[]>([]);
	let locuri    = $state<LocInchiriere[]>([]);
	let loading   = $state(true);
	let loadError = $state('');
	let pozaIdx   = $state(0);

	// Wizard în 3 pași: 1. Date  2. Extras  3. Confirmă
	let step = $state<1 | 2 | 3>(1);

	let dataStart      = $state('');
	let dataEnd        = $state('');
	let telefon        = $state('');
	let observatii     = $state('');
	let selectedExtras = $state<Record<string, boolean>>({});

	// Locurile alese la pasul anterior, purtate în URL. Nu se pot schimba aici:
	// se schimbă acolo unde au fost alese, ca omul să nu aibă două locuri de
	// unde se răzgândește și niciunul care câștigă.
	let locDeTip      = $state('sediu');
	let locDeAdresa   = $state('');
	let locDeUat      = $state(0);
	let locPanaTip    = $state('sediu');
	let locPanaAdresa = $state('');
	let locPanaUat    = $state(0);

	let saving      = $state(false);
	let formError   = $state('');
	let formSuccess = $state(false);

	let calendarDeschis = $state(false);
	/** Calendarul s-a deschis din butonul de rezervare, deci drumul continuă spre sumar. */
	let intervalCerutDinCta = $state(false);

	// Cererea așa cum a înregistrat-o serverul. Recapitularea de la final se face
	// din ea, nu din calculele de aici: omul trebuie să vadă ce s-a scris în
	// registru, nu ce socotise ecranul cu o secundă înainte.
	let cerereTrimisa = $state<InchiriereCerere | null>(null);

	// Restul flotei, pentru banda „Alte mașini": răspunsul la „e ceva mai ieftin /
	// mai mare?" vine în fișă, nu după o întoarcere la listă care pierdea perioada.
	let alteMasiniBrute    = $state<MasinaInchiriereCard[]>([]);
	let alteMasiniPerioada = $state(false); // prețurile din bandă sunt pe perioada aleasă, nu „de la"

	let masinaId = $derived(Number(page.params.id));

	let nrZile = $derived.by(() => {
		if (!dataStart || !dataEnd) return 0;
		const s = new Date(dataStart).getTime();
		const e = new Date(dataEnd).getTime();
		const z = Math.round((e - s) / 86_400_000);
		return z > 0 ? z : 0;
	});

	/** Treapta în care cade durata aleasă — sursa prețului afișat și a totalului. */
	let treaptaCurenta = $derived.by(() => {
		if (!masina || nrZile < 1) return null;
		return masina.tarife_trepte?.find(
			t => nrZile >= t.zile_min && (t.zile_max === null || nrZile <= t.zile_max)
		) ?? null;
	});

	/** Prețul exact pentru durata aleasă; `null` cât timp nu s-au ales datele. */
	let tarifCurent = $derived(treaptaCurenta?.tarif ?? null);

	/** Ce se afișează mare: prețul exact dacă există, altfel „de la". */
	let tarifAfisat = $derived(tarifCurent ?? masina?.tarif_de_la ?? null);

	let costMasina = $derived(tarifCurent ? Math.round(nrZile * tarifCurent * 100) / 100 : 0);

	let extraseAlese = $derived(extras.filter(e => selectedExtras[e.cod]));

	let costExtras = $derived(
		extraseAlese.reduce((sum, e) =>
			sum + (e.tip === 'per_zi' ? e.pret * nrZile : e.pret), 0)
	);

	function locDupaCod(cod: string): LocInchiriere | null {
		return locuri.find((l) => l.cod === cod) ?? null;
	}

	function etichetaLoc(cod: string, adresa: string, uat = 0): string {
		const loc = locDupaCod(cod);
		const localitate = loc?.localitati.find((l) => l.id === uat);

		if (adresa.trim()) return localitate ? `${adresa.trim()}, ${localitate.nume}` : adresa.trim();

		return localitate ? `${loc?.label} · ${localitate.nume}` : (loc?.label ?? 'Sediu');
	}

	/** Cât costă un capăt: prețul localității când se plătește pe km, altfel taxa fixă. */
	function taxaCapat(cod: string, uat: number): number {
		const loc = locDupaCod(cod);
		if (!loc) return 0;
		if (!loc.cere_localitate) return loc.taxa;

		return loc.localitati.find((l) => l.id === uat)?.pret ?? 0;
	}

	// Taxa se ia o dată per capăt, nu pe zi: drumul la aeroport costă la fel
	// indiferent câte zile stă mașina la client.
	let costLocuri = $derived(taxaCapat(locDeTip, locDeUat) + taxaCapat(locPanaTip, locPanaUat));

	let costEstimat = $derived(Math.round((costMasina + costExtras + costLocuri) * 100) / 100);

	let intervalConflict = $derived.by(() => {
		if (!dataStart || !dataEnd) return false;
		const s = new Date(dataStart).getTime();
		const e = new Date(dataEnd).getTime();
		return blocate.some(b => {
			const bs = new Date(b.from).getTime();
			const be = new Date(b.to).getTime();
			return s < be && e > bs;
		});
	});

	let canGoStep2 = $derived(!!dataStart && !!dataEnd && nrZile > 0 && !intervalConflict);
	let canGoStep3 = $derived(canGoStep2);
	let canSubmit  = $derived(canGoStep2 && !saving);

	/**
	 * Bara fixă de jos apare abia când există o perioadă: până atunci repeta al
	 * treilea „Alege perioada" de pe același ecran (hero, grila de trepte, footer). La Extras
	 * și Confirmă rămâne mereu — duce totalul estimat și săgețile între pași.
	 */
	let baraJosVizibila = $derived(!formSuccess && (step > 1 || canGoStep2));

	async function load() {
		loading = true;
		loadError = '';
		try {
			const res = await api.inchiriereMasina(masinaId);
			masina  = res.masina;
			blocate = res.intervale_blocate;
			extras  = res.extras;
			locuri  = res.locuri ?? [];

			// Pre-fill date din URL params (din listing) — sare la pasul Extras
			const params = new URLSearchParams(window.location.search);

			// Locurile alese la pasul anterior. Un cod care nu mai e în catalog
			// cade pe sediu, nu pe eroare: catalogul se poate schimba între timp.
			const coduri = new Set(locuri.map((l) => l.cod));
			const citesteLoc = (cheie: string) => {
				const v = params.get(cheie);

				return v && coduri.has(v) ? v : 'sediu';
			};
			// Un loc care cere adresă, dar vine fără ea, cade pe sediu. Altfel
			// omul ajunge la ultimul pas cu o eroare pe un câmp care nu există
			// pe ecranul ăsta — fundătură din care nu iese decât înapoi.
			const asezaLoc = (
				cheieLoc: string, cheieAdr: string, cheieUat: string, implicit: string, implicitUat = 0
			): [string, string, number] => {
				const cod = params.has(cheieLoc) ? citesteLoc(cheieLoc) : implicit;
				const l = locDupaCod(cod);
				if (!l?.cere_adresa) return [cod, '', 0];

				const adr = (params.get(cheieAdr) ?? '').trim();
				if (!adr) return ['sediu', '', 0];

				if (!l.cere_localitate) return [cod, adr, 0];

				// Localitatea trebuie să fie una pe care chiar o servim; altfel
				// prețul n-ar exista, iar serverul ar refuza cererea la final.
				const uat = params.has(cheieUat) ? Number(params.get(cheieUat)) : implicitUat;

				return l.localitati.some((x) => x.id === uat) ? [cod, adr, uat] : ['sediu', '', 0];
			};

			const de = asezaLoc('loc_de', 'adr_de', 'uat_de', 'sediu');
			locDeTip    = de[0];
			locDeAdresa = de[1];
			locDeUat    = de[2];

			// Fără capăt separat în URL, returnarea urmează preluarea.
			const pana = asezaLoc('loc_pana', 'adr_pana', 'uat_pana', locDeTip, locDeUat);
			locPanaTip    = pana[0];
			locPanaAdresa = pana[1];
			locPanaUat    = pana[2];

			const fromParam = params.get('from');
			const toParam   = params.get('to');
			if (fromParam && toParam) {
				dataStart = fromParam;
				dataEnd   = toParam;
				// validăm rapid: trebuie ca interval să fie > 0
				const s = new Date(dataStart).getTime();
				const e = new Date(dataEnd).getTime();
				if (e > s && !intervalConflict) step = 2; // sare direct la Extras
			}
		} catch (e: any) {
			loadError = e.status === 404
				? 'Mașina nu există sau nu este disponibilă.'
				: (e.message ?? 'Eroare la încărcare.');
		} finally {
			loading = false;
		}
	}

	/**
	 * Duce la un pas și îl aduce în dreptul ochilor — altfel pare că nu s-a întâmplat nimic.
	 * Pasul cu datele n-are panou: ochii se duc pe cardul de tarif, de unde se deschide calendarul.
	 */
	async function mergiLaPas(nou: 1 | 2 | 3) {
		step = nou;
		await tick();
		document.getElementById(nou === 1 ? 'tarif' : 'pas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	/**
	 * Deschide DIRECT calendarul, de oriunde s-ar cere schimbarea perioadei.
	 *
	 * Înainte doar aducea pasul cu datele în dreptul ochilor și punea cursorul pe
	 * câmp — omul apăsa „alege perioada" și primea un formular, nu un calendar.
	 */
	function deschideCalendarul() {
		calendarDeschis = true;
	}

	async function schimbaDatele() {
		if (step !== 1) await mergiLaPas(1);
		deschideCalendarul();
	}

	/**
	 * După ce s-a ales perioada, drumul continuă singur spre sumar — dar numai
	 * dacă omul era la pasul cu datele. Cine deschide calendarul de la „Schimbă"
	 * stând pe Extras sau pe Confirmă rămâne unde era; nu-l mutăm de sub mână.
	 */
	$effect(() => {
		if (calendarDeschis || step !== 1 || !canGoStep3) return;
		if (!intervalCerutDinCta) return;

		intervalCerutDinCta = false;
		mergiLaPas(3);
	});

	/**
	 * „Rezervă acum" duce la ultimul pas, unde omul vede cifra înainte s-o ceară.
	 * Doar când n-avem interval întreabă de date — înainte trimitea înapoi la
	 * calendar chiar și pe cineva care venise din listă cu datele alese.
	 */
	async function rezervaAcum() {
		if (!canGoStep3) {
			intervalCerutDinCta = true;
			await schimbaDatele();

			return;
		}

		await mergiLaPas(3);
	}

	async function rezerva() {
		formError = '';
		saving = true;
		try {
			const data: InchiriereForm = {
				data_start: dataStart,
				data_end:   dataEnd,
				telefon:    telefon || undefined,
				observatii: observatii || undefined,
				extras:     extraseAlese.map(e => e.cod),
				loc_preluare_tip:     locDeTip,
				loc_preluare_adresa:  locDeAdresa || undefined,
				loc_preluare_localitate_id:  locDeUat || undefined,
				loc_returnare_tip:    locPanaTip,
				loc_returnare_adresa: locPanaAdresa || undefined,
				loc_returnare_localitate_id: locPanaUat || undefined,
			};
			const res = await api.rezervaInchiriere(masinaId, data);
			cerereTrimisa = res.cerere;
			formSuccess = true;
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (e: any) {
			formError = e.message ?? 'Cererea nu a putut fi trimisă.';
			if (e.status === 409) load();
		} finally {
			saving = false;
		}
	}

	const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });

	/**
	 * Perioada, scurt, pentru eticheta prețului: „20–23 aug" în aceeași lună,
	 * „28 aug – 2 sep" peste două. Bara perioadei a plecat, deci aici e singurul
	 * loc din card unde omul își vede datele înainte de pasul Confirmă.
	 */
	let perioadaScurta = $derived.by(() => {
		if (nrZile < 1) return '';
		const s = new Date(dataStart);
		const e = new Date(dataEnd);
		const luna = (d: Date) => d.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '');
		if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
			return `${s.getDate()}–${e.getDate()} ${luna(e)}`;
		}
		return `${s.getDate()} ${luna(s)} – ${e.getDate()} ${luna(e)}`;
	});

	// Theming inteligent pe categorie — același cu listing-ul
	function tier(categoria: string) {
		const c = (categoria ?? '').toUpperCase();
		if (c.includes('PREMIUM') || c.includes('LUX'))    return { accent: '#eab308', bg1: '#3b2f0a', bg2: '#1a1505', chip: '#fde68a', chipBg: '#eab30822', chipBorder: '#eab30855', name: 'Premium' };
		if (c.includes('UTILITAR') || c.includes('VAN'))   return { accent: '#f97316', bg1: '#3a1d08', bg2: '#1a0e04', chip: '#fed7aa', chipBg: '#f9731622', chipBorder: '#f9731655', name: 'Utilitar' };
		if (c.includes('SUV') || c.includes('CROSSOVER')) return { accent: '#10b981', bg1: '#072e23', bg2: '#04150f', chip: '#a7f3d0', chipBg: '#10b98122', chipBorder: '#10b98155', name: 'SUV' };
		if (c.includes('COMPACT'))                         return { accent: '#06b6d4', bg1: '#062e36', bg2: '#03161a', chip: '#a5f3fc', chipBg: '#06b6d422', chipBorder: '#06b6d455', name: 'Compact' };
		if (c.includes('ECONOMIC'))                        return { accent: '#3b82f6', bg1: '#0a2240', bg2: '#04101e', chip: '#bfdbfe', chipBg: '#3b82f622', chipBorder: '#3b82f655', name: 'Economic' };
		return                                                   { accent: '#8b5cf6', bg1: '#1f1142', bg2: '#0d0721', chip: '#ddd6fe', chipBg: '#8b5cf622', chipBorder: '#8b5cf655', name: 'Standard' };
	}

	let theme = $derived(masina ? tier(masina.categoria) : tier(''));

	/**
	 * Încărcarea urmează id-ul, nu montarea. Din banda „Alte mașini" se trece la
	 * altă fișă pe ACEEAȘI rută, deci componenta nu se remontează: cu onMount,
	 * ecranul ar fi rămas pe mașina veche sub id-ul nou. Starea legată de mașina
	 * veche se aduce la zero; datele și locurile le recitește load() din URL.
	 * Telefonul, observațiile și extrasele bifate rămân — sunt ale omului, nu ale mașinii.
	 */
	$effect(() => {
		masinaId; // dependența: alt id, altă încărcare
		untrack(() => {
			pozaIdx = 0;
			step = 1;
			formSuccess = false;
			formError = '';
			cerereTrimisa = null;
			calendarDeschis = false;
			intervalCerutDinCta = false;
			dataStart = '';
			dataEnd = '';
			load();
		});
	});

	/**
	 * Banda „Alte mașini" se încarcă o dată per mașină și ori de câte ori se
	 * schimbă perioada: prețul pe zi din bandă e cel al perioadei alese, ca să se
	 * compare cu cel din card, nu un „de la" care ar minți la 3 zile.
	 */
	let alteMasiniCerere = 0;
	$effect(() => {
		const id = masinaId;
		const from = nrZile > 0 ? dataStart : '';
		const to   = nrZile > 0 ? dataEnd : '';
		untrack(() => incarcaAlteMasini(id, from, to));
	});

	async function incarcaAlteMasini(id: number, from: string, to: string) {
		const cerere = ++alteMasiniCerere;
		try {
			const res = await api.inchirieriFlota(from && to ? { from, to } : undefined);
			if (cerere !== alteMasiniCerere) return; // a venit una mai nouă între timp

			alteMasiniBrute    = res.masini.filter((m) => m.id !== id);
			alteMasiniPerioada = !!(from && to);
		} catch {
			// Banda e un ajutor, nu o condiție: fără ea fișa merge la fel.
			if (cerere === alteMasiniCerere) alteMasiniBrute = [];
		}
	}

	/**
	 * Ordinea benzii: aceeași clasă prima (alternativa directă), apoi cele libere
	 * în perioadă, apoi cele ieftine. Derivat, nu calculat la răspuns: fișa și
	 * flota se încarcă în paralel, iar clasa mașinii curente poate sosi a doua.
	 */
	let alteMasini = $derived.by(() => {
		const clasaMea = masina?.clasa ?? null;
		return [...alteMasiniBrute].sort((a, b) => {
			const ca = a.clasa === clasaMea ? 0 : 1;
			const cb = b.clasa === clasaMea ? 0 : 1;
			if (ca !== cb) return ca - cb;
			const da = a.disponibila_interval === false ? 1 : 0;
			const db = b.disponibila_interval === false ? 1 : 0;
			if (da !== db) return da - db;
			return (a.tarif_zi ?? a.tarif_de_la ?? 1e9) - (b.tarif_zi ?? b.tarif_de_la ?? 1e9);
		});
	});

	/**
	 * Parametrii care poartă contextul mai departe — perioada și locurile — ca
	 * fișa următoare (sau lista) să nu întrebe din nou ce s-a răspuns deja.
	 * Aceeași convenție ca în listă (carUrl): capătul de returnare se scrie
	 * doar când diferă de preluare.
	 */
	function paramsContext(): URLSearchParams {
		const p = new URLSearchParams();
		if (nrZile > 0) {
			p.set('from', dataStart);
			p.set('to', dataEnd);
		}
		if (locDeTip !== 'sediu' || locDeAdresa) {
			p.set('loc_de', locDeTip);
			if (locDeAdresa) p.set('adr_de', locDeAdresa);
			if (locDeUat) p.set('uat_de', String(locDeUat));
		}
		const panaDiferit = locPanaTip !== locDeTip || locPanaAdresa !== locDeAdresa || locPanaUat !== locDeUat;
		if (panaDiferit) {
			p.set('loc_pana', locPanaTip);
			if (locPanaAdresa) p.set('adr_pana', locPanaAdresa);
			if (locPanaUat) p.set('uat_pana', String(locPanaUat));
		}
		return p;
	}

	function urlAltaMasina(id: number): string {
		const q = paramsContext().toString();
		return `/dashboard/inchirieri/${id}${q ? `?${q}` : ''}`;
	}

	/** Înapoi la listă CU perioada: până acum întoarcerea o pierdea și omul alegea datele iar. */
	let urlFlota = $derived.by(() => {
		const p = new URLSearchParams();
		if (nrZile > 0) {
			p.set('from', dataStart);
			p.set('to', dataEnd);
		}
		const q = p.toString();
		return `/dashboard/inchirieri${q ? `?${q}` : ''}`;
	});
</script>

<!-- Spatiu cat navigatia PLUS bara de actiune (cand e afisata), ca ultimul rand sa nu ramana dedesubt. -->
<div class="space-y-4" style="padding-bottom: calc(var(--nav-h, 64px) + {baraJosVizibila ? '96px' : '16px'});">
	<!-- Întoarcerea poartă perioada: lista o citește din URL și n-o mai cere o dată. -->
	<a href={urlFlota} class="inline-flex items-center gap-1.5 text-xs font-semibold"
		style="color: var(--muted); text-decoration: none;">← Înapoi la flotă</a>

	{#if loading}
		<Skeleton height="h-56" class="w-full" rounded="rounded-2xl" />
		<div class="space-y-2"><Skeleton height="h-6" class="w-48" /><Skeleton height="h-4" class="w-32" /></div>
	{:else if loadError}
		<div class="p-4 rounded-2xl text-sm" style="background: #ef444418; color: #ef4444; border: 1px solid #ef444440;">
			{loadError}
		</div>
	{:else if masina}
		<!--
			Banda „Alte mașini" — același markup randat în două locuri (sub poză pe
			desktop, sub caracteristici pe mobil); CSS-ul alege care se vede.
			Prețul din bandă e pe perioada aleasă, ca să se compare cu cel din card.
			Cardurile poartă perioada și locurile mai departe (urlAltaMasina).
		-->
		{#snippet bandaAlteMasini()}
			<div class="alte-masini">
				<div class="flex items-center justify-between gap-2 mb-2">
					<p class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--muted)">
						Alte mașini {alteMasiniPerioada ? 'pentru perioada ta' : 'din flotă'}
						<span class="font-semibold" style="opacity: 0.7;">· {alteMasini.length}</span>
					</p>
					<a href={urlFlota} class="text-[10px] font-bold uppercase tracking-wider shrink-0"
						style="color: var(--muted); text-decoration: none;">Toată flota →</a>
				</div>
				<div class="alte-scroll">
					{#each alteMasini as m (m.id)}
						{@const t = tier(m.categoria)}
						{@const ocupata = alteMasiniPerioada && m.disponibila_interval === false}
						{@const pret = alteMasiniPerioada ? m.tarif_zi : m.tarif_de_la}
						<a href={urlAltaMasina(m.id)} class="alta-card" class:alta-ocupata={ocupata} style="--ac: {t.accent};">
							<div class="alta-foto" style="background: linear-gradient(135deg, {t.bg1} 0%, {t.bg2} 100%);">
								{#if m.foto_url}
									<img src={m.foto_url} alt="{m.marca} {m.model}" loading="lazy" />
								{:else}
									<svg class="alta-fara-poza" viewBox="0 0 24 24" fill="none" stroke={t.accent} stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
										<path d="M5 17h14M3 17l1.4-7.5a2 2 0 0 1 2-1.5h11.2a2 2 0 0 1 2 1.5L21 17"/>
										<circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
									</svg>
								{/if}
								{#if m.clasa_eticheta}
									<span class="alta-chip" style="color: {t.chip}; border-color: {t.chipBorder}; background: color-mix(in srgb, {t.accent} 18%, rgba(13,13,34,0.85));">
										{m.clasa_eticheta}
									</span>
								{/if}
							</div>
							<div class="alta-text">
								<p class="alta-nume">{m.marca} {m.model}</p>
								<p class="alta-pret">
									{#if ocupata}
										ocupată în perioadă
									{:else if pret}
										{#if !alteMasiniPerioada}de la {/if}<b>{pret.toFixed(0)}</b> lei/zi
									{:else}
										la cerere
									{/if}
								</p>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/snippet}

		<!-- Step indicator (4 pași: Vehicul ✓ · Date · Extras · Confirmă)
		     Pașii sunt APĂSABILI: bifa ✓ promite că te poți întoarce, iar înainte
		     se putea doar din săgeată, câte un pas. Datele rămân completate. -->
		<div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider overflow-x-auto">
			<a href={urlFlota} class="step-dot step-done" style="text-decoration: none;" aria-label="Înapoi la flotă">✓</a>
			<a href={urlFlota} style="color: var(--muted); text-decoration: none;" class="hidden sm:inline uppercase tracking-wider">Vehicul</a>
			<span class="flex-1 h-px min-w-[12px]" style="background: var(--border)"></span>

			<!-- „Date" deschide calendarul: pasul n-are panou propriu, perioada se alege din cardul de tarif. -->
			<button type="button" onclick={schimbaDatele} aria-current={step === 1 ? 'step' : undefined}
				class="step-dot {step === 1 ? 'step-active' : 'step-done'}" aria-label="Schimbă datele">{step > 1 ? '✓' : '2'}</button>
			<button type="button" onclick={schimbaDatele} style="color: {step === 1 ? 'var(--text)' : 'var(--muted)'}"
				class="uppercase tracking-wider">Date</button>
			<span class="flex-1 h-px min-w-[12px]" style="background: var(--border)"></span>

			<button type="button" onclick={() => canGoStep2 && (step = 2)} disabled={!canGoStep2} aria-current={step === 2 ? 'step' : undefined}
				class="step-dot {step === 2 ? 'step-active' : (step > 2 ? 'step-done' : 'step-pending')}" aria-label="Servicii suplimentare">{step > 2 ? '✓' : '3'}</button>
			<button type="button" onclick={() => canGoStep2 && (step = 2)} disabled={!canGoStep2}
				style="color: {step === 2 ? 'var(--text)' : 'var(--muted)'}" class="uppercase tracking-wider disabled:opacity-60">Extras</button>
			<span class="flex-1 h-px min-w-[12px]" style="background: var(--border)"></span>

			<button type="button" onclick={() => canGoStep3 && (step = 3)} disabled={!canGoStep3} aria-current={step === 3 ? 'step' : undefined}
				class="step-dot {step === 3 ? 'step-active' : 'step-pending'}" aria-label="Confirmă rezervarea">4</button>
			<button type="button" onclick={() => canGoStep3 && (step = 3)} disabled={!canGoStep3}
				style="color: {step === 3 ? 'var(--text)' : 'var(--muted)'}" class="uppercase tracking-wider disabled:opacity-60">Confirmă</button>
		</div>

		{#if formSuccess}
			<!--
				Confirmarea arată REZERVAREA, nu doar o bifă: de când până când, cât
				costă, unde se ia și unde se aduce mașina. Cifrele vin din răspunsul
				serverului (`cerereTrimisa`), deci e exact ce s-a înregistrat.
			-->
			<div class="rounded-2xl border overflow-hidden"
				style="background: var(--surface); border-color: #22c55e55;">
				<div class="px-4 py-4 text-center"
					style="background: linear-gradient(180deg, #22c55e22, transparent);">
					<div class="text-4xl mb-1.5">✅</div>
					<p class="font-bold text-lg" style="color: var(--text)">Cererea ta a fost preluată</p>
					<p class="text-sm mt-1" style="color: var(--muted)">
						Te sunăm pentru confirmare, de regulă în 30 de minute.
					</p>
					{#if cerereTrimisa}
						<p class="text-[11px] mt-2 font-semibold uppercase tracking-wider" style="color: var(--muted)">
							Cererea #{cerereTrimisa.id} · {cerereTrimisa.status_label}
						</p>
					{/if}
				</div>

				{#if cerereTrimisa}
					{@const c = cerereTrimisa}
					<div class="px-4 pb-4 space-y-1.5 text-sm">
						<div class="flex justify-between gap-3">
							<span style="color: var(--muted)">Mașină</span>
							<span class="font-semibold text-right" style="color: var(--text)">
								{c.masina ? `${c.masina.marca} ${c.masina.model}` : '—'}
								{#if c.masina?.numar_inmatriculare}
									<span class="font-mono text-xs" style="color: var(--muted)"> · {c.masina.numar_inmatriculare}</span>
								{/if}
							</span>
						</div>
						<div class="flex justify-between gap-3">
							<span style="color: var(--muted)">Perioadă</span>
							<span class="font-semibold text-right" style="color: var(--text)">
								{fmtDate(c.data_start)} → {fmtDate(c.data_end)}
							</span>
						</div>
						<div class="flex justify-between gap-3">
							<span style="color: var(--muted)">Preluare</span>
							<span class="text-right" style="color: var(--text)">{c.loc_preluare.text}</span>
						</div>
						<div class="flex justify-between gap-3">
							<span style="color: var(--muted)">Returnare</span>
							<span class="text-right" style="color: var(--text)">{c.loc_returnare.text}</span>
						</div>
						<div class="flex justify-between gap-3">
							<span style="color: var(--muted)">Închiriere</span>
							<span class="text-right" style="color: var(--text)">
								{c.nr_zile} {c.nr_zile === 1 ? 'zi' : 'zile'} × {c.tarif_zi.toFixed(2)} lei
							</span>
						</div>
						{#if c.taxa_loc > 0}
							<div class="flex justify-between gap-3">
								<span style="color: var(--muted)">Taxă preluare / returnare</span>
								<span class="text-right" style="color: var(--text)">{c.taxa_loc.toFixed(2)} lei</span>
							</div>
						{/if}
						{#if c.extras.length > 0}
							<div class="pt-1.5 mt-1.5 border-t" style="border-color: var(--border);">
								<p class="text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">Extras</p>
								{#each c.extras as e (e.cod)}
									<div class="flex justify-between text-xs">
										<span style="color: var(--text)">· {e.label}</span>
										<span style="color: var(--text)">{e.valoare.toFixed(2)} lei</span>
									</div>
								{/each}
							</div>
						{/if}
						<div class="flex justify-between pt-2 mt-1 border-t" style="border-color: var(--border);">
							<span class="font-bold" style="color: var(--text)">Total estimat</span>
							<span class="font-bold text-base" style="color: var(--accent)">{c.cost_estimat.toFixed(2)} lei</span>
						</div>
						<p class="text-[11px] pt-1" style="color: var(--muted)">
							Plata la ridicare. Te sunăm la {c.telefon || 'numărul din cont'} și confirmăm totul înainte.
						</p>
					</div>
				{/if}

				<div class="flex gap-2 px-4 pb-4 justify-center">
					<a href="/dashboard/inchirieri/cererile-mele"
						class="text-xs font-semibold px-4 py-2.5 rounded-xl"
						style="background: var(--accent); color: white; text-decoration: none;">
						Vezi cererile mele
					</a>
					<a href="/dashboard"
						class="text-xs font-semibold px-4 py-2.5 rounded-xl"
						style="background: var(--surface2); color: var(--text); border: 1px solid var(--border); text-decoration: none;">
						Acasă
					</a>
				</div>
			</div>
		{:else}
			<!-- HERO grid: poză + tarif card alături pe wide screens -->
			<div class="hero-grid">
			<div class="hero-stage rounded-2xl overflow-hidden border relative flex flex-col"
				style="--ac: {theme.accent}; border-color: color-mix(in srgb, {theme.accent} 35%, var(--border)); background: linear-gradient(135deg, {theme.bg1} 0%, {theme.bg2} 100%);">
				<!-- Aurora glow în spate -->
				<div class="hero-aurora absolute inset-0 pointer-events-none"
					style="background: radial-gradient(70% 60% at 30% 30%, color-mix(in srgb, {theme.accent} 25%, transparent) 0%, transparent 60%), radial-gradient(50% 50% at 80% 100%, color-mix(in srgb, {theme.accent} 18%, transparent) 0%, transparent 70%);"></div>

				<div class="relative" style="aspect-ratio: 16/10; max-height: 50vh;">
					{#if masina.poze.length > 0}
						<img src={masina.poze[pozaIdx]} alt="{masina.marca} {masina.model}"
							class="hero-img w-full h-full object-cover relative z-10" />
						<!-- Vignette + bottom fade -->
						<div class="absolute inset-0 z-20 pointer-events-none"
							style="background: radial-gradient(120% 80% at 50% 30%, transparent 50%, rgba(0,0,0,0.35) 100%), linear-gradient(180deg, rgba(13,13,34,0.05) 0%, rgba(13,13,34,0.0) 40%, rgba(13,13,34,0.92) 100%);"></div>
					{:else}
						<div class="absolute inset-0 flex items-center justify-center z-10">
							<svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke={theme.accent} stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;">
								<path d="M5 17h14M3 17l1.4-7.5a2 2 0 0 1 2-1.5h11.2a2 2 0 0 1 2 1.5L21 17"/>
								<circle cx="7" cy="17" r="2"/>
								<circle cx="17" cy="17" r="2"/>
							</svg>
						</div>
					{/if}

					<!-- Categoria badge — color-coded -->
					<div class="absolute top-3 left-3 z-30">
						<span class="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2.5 py-1.5 rounded-md uppercase"
							style="background: color-mix(in srgb, {theme.accent} 18%, rgba(13,13,34,0.85)); color: {theme.chip}; border: 1px solid {theme.chipBorder}; backdrop-filter: blur(8px); letter-spacing: 0.08em;">
							<span class="cat-dot" style="background: {theme.accent};"></span>
							{masina.categoria}
						</span>
					</div>

					{#if masina.poze.length > 1}
						<button onclick={() => pozaIdx = (pozaIdx - 1 + masina!.poze.length) % masina!.poze.length}
							class="nav-btn absolute left-2 top-1/2 -translate-y-1/2 z-30" aria-label="Anterior">‹</button>
						<button onclick={() => pozaIdx = (pozaIdx + 1) % masina!.poze.length}
							class="nav-btn absolute right-2 top-1/2 -translate-y-1/2 z-30" aria-label="Următoare">›</button>
						<div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
							{#each masina.poze as _, i}
								<button onclick={() => pozaIdx = i}
									class="w-2 h-2 rounded-full transition-all"
									style="background: {i === pozaIdx ? theme.accent : 'rgba(255,255,255,0.4)'}; transform: scale({i === pozaIdx ? 1.3 : 1});"
									aria-label="Poza {i + 1}"></button>
							{/each}
						</div>
					{/if}

					<!-- Identitate peste imagine -->
					<div class="absolute left-4 right-4 bottom-3 z-30">
						<p class="text-[11px] font-semibold uppercase tracking-wider" style="color: {theme.chip}; opacity: 0.85;">
							{masina.an ?? 'recent'} · sau similar
						</p>
						<p class="text-2xl sm:text-3xl font-bold leading-tight" style="color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.6);">
							{masina.marca} {masina.model}
						</p>
					</div>
				</div>

				<!-- Pe ecrane late hero-ul se întinde la înălțimea cardului de tarif și
				     sub poză rămânea un sfert de ecran gol. Acolo stă banda cu restul
				     flotei: „vehiculul" e primul pas, iar alternativele lui sunt tot
				     aici, nu după o întoarcere la listă. Pe mobil banda e sub caracteristici. -->
				{#if alteMasini.length > 0}
					<div class="hidden lg:block relative z-10 mt-auto px-4 pb-4 pt-3">
						{@render bandaAlteMasini()}
					</div>
				{/if}
			</div>

			<!-- TARIF CARD — business-driven, lângă poză pe wide screens. `id` = ținta
			     de scroll a pasului „Date": perioada se vede și se schimbă de aici. -->
			<div id="tarif" class="tarif-card relative overflow-hidden p-4 rounded-2xl flex flex-col"
				style="--ac: {theme.accent}; scroll-margin-top: 12px; background: linear-gradient(135deg, color-mix(in srgb, {theme.accent} 22%, transparent) 0%, color-mix(in srgb, {theme.accent} 6%, transparent) 60%, transparent 100%), var(--surface); border: 1px solid color-mix(in srgb, {theme.accent} 38%, transparent);">
				<div class="tarif-shimmer absolute inset-0 pointer-events-none"></div>

				<!-- Banner top: social proof / scarcity -->
				{#if masina.rezervari_azi > 0}
					<div class="relative -mx-4 -mt-4 mb-3 px-4 py-2 flex items-center gap-2"
						style="background: linear-gradient(90deg, #ef444440, #ef444418); border-bottom: 1px solid #ef444433;">
						<span class="dot-pulse-red"></span>
						<p class="text-[11px] font-bold" style="color: #fca5a5">
							🔥 Rezervată de {masina.rezervari_azi}× azi · cere telefonic acum
						</p>
					</div>
				{:else}
					<div class="relative -mx-4 -mt-4 mb-3 px-4 py-2 flex items-center gap-2"
						style="background: linear-gradient(90deg, #10b98133, #10b98112); border-bottom: 1px solid #10b98133;">
						<span class="dot-pulse-green"></span>
						<p class="text-[11px] font-bold" style="color: #6ee7b7">
							● Disponibilă acum pentru rezervare
						</p>
					</div>
				{/if}

				<!-- Hero price + categorie chip -->
				<div class="relative flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--muted)">
							{#if tarifCurent}{perioadaScurta} · {nrZile} {nrZile === 1 ? 'zi' : 'zile'} · TVA inclus{:else if tarifAfisat}De la · TVA inclus{:else}Tarif{/if}
						</p>
						{#if tarifAfisat}
							<p class="font-bold leading-none mt-1" style="color: #34d399; text-shadow: 0 0 24px color-mix(in srgb, #10b981 40%, transparent);">
								<span class="text-4xl sm:text-5xl">{tarifAfisat.toFixed(0)}</span><span class="text-base font-normal ml-0.5" style="color: var(--muted)"> lei</span>
							</p>
						{:else}
							<p class="font-bold leading-none mt-1 text-2xl" style="color: var(--text)">la cerere</p>
							<p class="text-[11px] mt-1.5" style="color: var(--muted)">te sunăm cu oferta</p>
						{/if}
						<p class="text-[11px] mt-1.5" style="color: var(--muted)">
							{#if masina.km_nelimitati}
								<span class="font-bold" style="color: {theme.accent};">Km nelimitați</span> · RCA · rovinietă · fără depozit
							{:else if masina.km_inclusi_zi}
								<span class="font-bold" style="color: {theme.accent};">{masina.km_inclusi_zi} km/zi</span> incluși{masina.tarif_km_extra > 0 ? ` · extra ${masina.tarif_km_extra.toFixed(2)} lei/km` : ''}
							{/if}
						</p>
					</div>
					<span class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-md inline-flex items-center gap-1"
						style="background: {theme.chipBg}; color: {theme.chip}; border: 1px solid {theme.chipBorder};">
						<span class="cat-dot" style="background: {theme.accent};"></span>
						{theme.name}
					</span>
				</div>

				<!-- Grila de trepte: argumentul „stai mai mult, plătești mai puțin", vizibil.
				     Rândul duratei alese e evidențiat; treptele fără preț rămân la vedere.
				     În colțul din dreapta al antetului stă butonul de schimbat perioada:
				     omul citește treptele, vede că la 4–7 zile e mai ieftin și vrea să-și
				     mute datele chiar de aici, lângă preț, nu să caute în altă parte. -->
				{#if masina.tarife_trepte?.some(t => t.tarif)}
					<div class="relative mt-4 rounded-xl overflow-hidden" style="border: 1px solid var(--border); background: var(--surface);">
						<div class="flex items-center justify-between gap-2 px-3 pt-2 pb-1.5">
							<p class="min-w-0 text-[10px] font-bold uppercase tracking-wider" style="color: var(--muted)">
								Cu cât stai mai mult, cu atât e mai ieftin
							</p>
							<button type="button" onclick={schimbaDatele} class="trepte-btn">
								{nrZile > 0 ? 'Schimbă perioada' : 'Alege perioada'}
							</button>
						</div>
						{#each masina.tarife_trepte as t (t.treapta)}
							{@const activ = treaptaCurenta?.treapta === t.treapta}
							<div class="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
								style="border-top: 1px solid var(--border); {activ ? `background: color-mix(in srgb, ${theme.accent} 12%, transparent);` : ''}">
								<span style="color: {activ ? 'var(--text)' : 'var(--muted)'}; font-weight: {activ ? 700 : 500};">
									{t.eticheta}{#if activ}<span class="ml-1.5 text-[9px] font-bold uppercase tracking-wider" style="color: {theme.accent};">alegerea ta</span>{/if}
								</span>
								<span class="font-bold tabular-nums" style="color: {t.tarif ? (activ ? theme.accent : 'var(--text)') : 'var(--muted)'};">
									{#if t.tarif}{t.tarif.toFixed(0)} lei/zi{:else}la cerere{/if}
								</span>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Conflictul și zilele ocupate stau lângă preț și lângă butonul de
				     schimbat perioada — bara de sub mașină, care le purta, a plecat. -->
				{#if intervalConflict}
					<p class="relative text-xs mt-2 px-1" style="color: #ef4444">
						Mașina e deja rezervată în perioada asta — schimbă datele.
					</p>
				{/if}
				{#if blocate.length > 0}
					<details class="relative text-xs mt-2 px-1" style="color: var(--muted)">
						<summary class="cursor-pointer font-medium">Vezi intervale ocupate ({blocate.length})</summary>
						<ul class="mt-1.5 space-y-1 pl-3">
							{#each blocate as b}
								<li>· {fmtDate(b.from)} → {fmtDate(b.to)}</li>
							{/each}
						</ul>
					</details>
				{/if}

				<!-- Trust badges grid — color-coded pentru încredere -->
				<div class="relative grid grid-cols-2 gap-2 mt-4">
					<div class="trust-badge" style="--c: #10b981; --cbg: #10b98115; --cbr: #10b98138;">
						<span class="trust-icon">✓</span>
						<div class="min-w-0">
							<p class="trust-title">Plata la ridicare</p>
							<p class="trust-sub">fără card acum</p>
						</div>
					</div>
					<div class="trust-badge" style="--c: #3b82f6; --cbg: #3b82f615; --cbr: #3b82f638;">
						<span class="trust-icon">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
						</span>
						<div class="min-w-0">
							<p class="trust-title">CASCO inclusă</p>
							<p class="trust-sub">fără depozit</p>
						</div>
					</div>
					<div class="trust-badge" style="--c: #f97316; --cbg: #f9731615; --cbr: #f9731638;">
						<span class="trust-icon">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
						</span>
						<div class="min-w-0">
							<p class="trust-title">Asistență 24/7</p>
							<p class="trust-sub">tractare gratuit</p>
						</div>
					</div>
					<div class="trust-badge" style="--c: #8b5cf6; --cbg: #8b5cf615; --cbr: #8b5cf638;">
						<span class="trust-icon">↩</span>
						<div class="min-w-0">
							<p class="trust-title">Anulare gratuită</p>
							<p class="trust-sub">până la ridicare</p>
						</div>
					</div>
				</div>

				<!-- Caracteristicile — chip-uri mici între garanții și butonul mare, în golul
				     care stătea liber pe ecrane late. Erau o grilă de carduri sub poză, la
				     fel de mari ca grila de prețuri, pentru informație de un rând. -->
				<div class="spec-chips relative">
					{#if masina.nr_locuri}
						<span class="spec-chip">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
							{masina.nr_locuri} <em>locuri</em>
						</span>
					{/if}
					{#if masina.nr_usi}
						<span class="spec-chip">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16"/><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><circle cx="14" cy="13" r="1"/></svg>
							{masina.nr_usi} <em>uși</em>
						</span>
					{/if}
					{#if masina.transmisie}
						<span class="spec-chip">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
							{masina.transmisie.toLowerCase().startsWith('aut') ? 'A' : (masina.transmisie.toLowerCase().startsWith('man') ? 'M' : masina.transmisie.charAt(0).toUpperCase())} <em>{masina.transmisie}</em>
						</span>
					{/if}
					{#if masina.combustibil}
						<span class="spec-chip">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2v0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>
							{masina.combustibil}
						</span>
					{/if}
					{#if masina.putere_cp}
						<span class="spec-chip">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
							{masina.putere_cp} <em>CP</em>
						</span>
					{/if}
					{#if masina.km_nelimitati || masina.km_inclusi_zi}
						<span class="spec-chip">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
							{masina.km_nelimitati ? '∞' : masina.km_inclusi_zi} <em>{masina.km_nelimitati ? 'km' : 'km/zi'}</em>
						</span>
					{/if}
					{#if masina.are_ac}
						<span class="spec-chip">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>
							AC
						</span>
					{/if}
					{#if masina.is_4wd}
						<span class="spec-chip">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
							4×4
						</span>
					{/if}
				</div>

				<!-- Spacer pentru wide screens -->
				<div class="hidden lg:block flex-1"></div>

				<!-- CTA primary — apare doar pe wide screens (mobil are sticky footer) -->
				<button onclick={rezervaAcum}
					class="cta-btn cta-btn-hero hidden lg:inline-flex relative w-full justify-center mt-4">
					<span>{canGoStep3 ? 'Rezervă acum' : 'Alege perioada'}</span>
					<span class="cta-arrow">→</span>
				</button>
				<p class="hidden lg:block relative text-[10px] text-center mt-2" style="color: var(--muted)">
					⏱ Răspuns telefonic în 30 minute · 0 angajament
				</p>
			</div>
			</div><!-- /hero-grid -->

			<!-- Calendarul cunoaște zilele deja rezervate pe mașina asta, deci le stinge
			     în loc să lase omul să le aleagă și să afle abia la trimitere. -->
			<CalendarInterval bind:deschis={calendarDeschis} bind:de={dataStart} bind:pana={dataEnd} {blocate} />

			{#if masina.dotari.length > 0}
				<div>
					<p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--muted)">Dotări</p>
					<div class="flex flex-wrap gap-1.5">
						{#each masina.dotari as d}
							<span class="text-xs px-2.5 py-1 rounded-full"
								style="background: var(--surface); color: var(--text); border: 1px solid var(--border);">{d}</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if alteMasini.length > 0}
				<div class="lg:hidden">
					{@render bandaAlteMasini()}
				</div>
			{/if}

			<!-- Step content — `id` ca butoanele de sus să poată aduce pasul în dreptul ochilor.
			     Pasul cu datele NU are card: perioada se alege din cardul de tarif
			     („Alege/Schimbă perioada"), din „Date" în stepper sau din CTA-uri — toate
			     deschid direct calendarul, iar datele alese se citesc în eticheta prețului. -->
			{#if step > 1}
			<div id="pas" class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border); scroll-margin-top: 12px;">
				{#if step === 2}
					<div>
						<h2 class="font-bold text-base" style="color: var(--text)">Adaugă servicii suplimentare</h2>
						<p class="text-xs mt-0.5" style="color: var(--muted)">
							Opțional · costul se adaugă la totalul rezervării
						</p>
					</div>

					<div class="space-y-2">
						{#each extras as e (e.cod)}
							{@const isOn = !!selectedExtras[e.cod]}
							{@const valoare = e.tip === 'per_zi' ? e.pret * nrZile : e.pret}
							<button type="button"
								onclick={() => selectedExtras = { ...selectedExtras, [e.cod]: !isOn }}
								class="extra-card w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all"
								class:extra-on={isOn}>
								<span class="extra-icon shrink-0 text-2xl">{e.icon}</span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center justify-between gap-2">
										<p class="font-bold text-sm leading-tight" style="color: var(--text)">{e.label}</p>
										<p class="text-xs font-bold shrink-0" style="color: var(--accent)">
											{e.pret.toFixed(0)} lei{e.tip === 'per_zi' ? '/zi' : ''}
										</p>
									</div>
									<p class="text-[11px] mt-0.5 leading-snug" style="color: var(--muted)">{e.descriere}</p>
									{#if isOn && nrZile > 0}
										<p class="text-[11px] mt-1 font-semibold" style="color: var(--accent)">
											+ {valoare.toFixed(2)} lei la total
										</p>
									{/if}
								</div>
								<span class="extra-check shrink-0">
									{#if isOn}
										<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
									{/if}
								</span>
							</button>
						{/each}
					</div>

					{#if extraseAlese.length > 0 && nrZile > 0}
						<div class="p-2.5 rounded-lg text-xs flex justify-between items-center"
							style="background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);">
							<span style="color: var(--text)">{extraseAlese.length} {extraseAlese.length === 1 ? 'extra ales' : 'extrase alese'}</span>
							<span class="font-bold" style="color: var(--accent)">+{costExtras.toFixed(2)} lei</span>
						</div>
					{/if}
				{:else}
					<h2 class="font-bold text-base" style="color: var(--text)">Confirmă rezervarea</h2>

					<!-- Summary -->
					<div class="p-3 rounded-xl space-y-1.5 text-sm"
						style="background: var(--surface2); border: 1px solid var(--border);">
						<div class="flex justify-between">
							<span style="color: var(--muted)">Mașină</span>
							<span class="font-semibold" style="color: var(--text)">{masina.marca} {masina.model}</span>
						</div>
						<div class="flex justify-between items-center gap-2">
							<span style="color: var(--muted)">Perioadă</span>
							<span class="flex items-center gap-2">
								<span class="font-semibold" style="color: var(--text)">{fmtDate(dataStart)} → {fmtDate(dataEnd)}</span>
								<!-- Răzgândirea trebuie să fie la îndemână chiar aici, nu doar
								     prin doi pași înapoi din săgeată. -->
								<button type="button" onclick={() => (step = 1)}
									class="shrink-0 text-[11px] font-semibold underline"
									style="color: var(--accent);">schimbă</button>
							</span>
						</div>
						<div class="flex justify-between gap-3">
							<span style="color: var(--muted)">Preluare</span>
							<span class="text-right" style="color: var(--text)">{etichetaLoc(locDeTip, locDeAdresa, locDeUat)}</span>
						</div>
						<div class="flex justify-between gap-3">
							<span style="color: var(--muted)">Returnare</span>
							<span class="text-right" style="color: var(--text)">{etichetaLoc(locPanaTip, locPanaAdresa, locPanaUat)}</span>
						</div>
						<div class="flex justify-between">
							<span style="color: var(--muted)">Închiriere</span>
							<span style="color: var(--text)">{nrZile} {nrZile === 1 ? 'zi' : 'zile'} × {(tarifCurent ?? 0).toFixed(2)} = <strong>{costMasina.toFixed(2)} lei</strong></span>
						</div>
						{#if costLocuri > 0}
							<div class="flex justify-between">
								<span style="color: var(--muted)">Taxă preluare / returnare</span>
								<span style="color: var(--text)">{costLocuri.toFixed(2)} lei</span>
							</div>
						{/if}
						{#if extraseAlese.length > 0}
							<div class="pt-1.5 mt-1.5 border-t" style="border-color: var(--border);">
								<p class="text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">Extras</p>
								{#each extraseAlese as e}
									{@const v = e.tip === 'per_zi' ? e.pret * nrZile : e.pret}
									<div class="flex justify-between text-xs">
										<span style="color: var(--text)">· {e.label}{e.tip === 'per_zi' ? ` (${nrZile} × ${e.pret.toFixed(0)})` : ''}</span>
										<span style="color: var(--text)">{v.toFixed(2)} lei</span>
									</div>
								{/each}
							</div>
						{/if}
						<div class="flex justify-between pt-2 mt-1 border-t" style="border-color: var(--border);">
							<span class="font-bold" style="color: var(--text)">Total estimat</span>
							<span class="font-bold text-base" style="color: var(--accent)">{costEstimat.toFixed(2)} lei</span>
						</div>
					</div>

					<div>
						<label for="tel" class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--muted)">Telefon contact (opțional)</label>
						<input id="tel" type="tel" bind:value={telefon}
							placeholder="Lasă gol ca să folosim numărul din cont"
							class="w-full mt-1 text-sm px-3 py-2.5 rounded-xl"
							style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
					</div>

					<div>
						<label for="obs" class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--muted)">Observații (opțional)</label>
						<textarea id="obs" bind:value={observatii}
							rows="3" maxlength="500"
							placeholder="Ex: am nevoie de ea de vineri seara, plec într-o deplasare..."
							class="w-full mt-1 text-sm px-3 py-2.5 rounded-xl resize-none"
							style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);"></textarea>
					</div>

					{#if formError}
						<div class="p-2.5 rounded-lg text-xs"
							style="background: #ef444418; color: #ef4444; border: 1px solid #ef444440;">
							{formError}
						</div>
					{/if}
				{/if}
			</div>
			{/if}
		{/if}

		<!-- Sticky bottom action bar — doar cu perioada aleasă (vezi baraJosVizibila) -->
		{#if baraJosVizibila}
			<div class="sticky-action" style="--ac: {theme.accent};">
				<div class="sticky-inner">
					<div class="min-w-0">
						{#if nrZile > 0}
							<p class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--muted)">
								{nrZile} {nrZile === 1 ? 'zi' : 'zile'} estimate
							</p>
							<p class="text-lg font-bold leading-tight" style="color: var(--text)">
								{costEstimat.toFixed(2)} <span class="text-xs font-normal" style="color: var(--muted)">lei</span>
							</p>
						{:else}
							<p class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--muted)">
								{tarifAfisat ? `de la ${tarifAfisat.toFixed(0)} lei/zi` : 'tarif la cerere'}
							</p>
							<p class="text-sm font-medium" style="color: var(--text)">Alege intervalul</p>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						{#if step === 1}
							<!-- Bara există la pasul 1 doar cu perioada aleasă, deci aici
							     butonul duce mereu mai departe. -->
							<button onclick={() => step = 2} class="cta-btn">
								Continuă <span class="cta-arrow">→</span>
							</button>
						{:else if step === 2}
							<button onclick={() => step = 1}
								class="text-xs font-semibold px-3 py-2.5 rounded-xl"
								style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);">←</button>
							<button onclick={() => step = 3} disabled={!canGoStep3} class="cta-btn">
								{extraseAlese.length === 0 ? 'Sari peste' : 'Continuă'} <span class="cta-arrow">→</span>
							</button>
						{:else}
							<button onclick={() => step = 2}
								class="text-xs font-semibold px-3 py-2.5 rounded-xl"
								style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);">←</button>
							<button onclick={rezerva} disabled={!canSubmit}
								class="cta-btn"
								class:cta-disabled={!canSubmit}>
								{saving ? 'Se trimite...' : 'Trimite cererea'} <span class="cta-arrow">→</span>
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.step-dot {
		width: 22px; height: 22px;
		display: inline-flex; align-items: center; justify-content: center;
		border-radius: 50%;
		font-size: 11px;
		font-weight: 700;
		flex-shrink: 0;
		/* Sunt butoane acum, nu span-uri: le ținem înfățișarea, dar arătăm că se apasă. */
		border: none;
		cursor: pointer;
		transition: transform 0.15s ease, opacity 0.15s ease;
	}
	.step-dot:disabled { cursor: default; }
	.step-dot:not(:disabled):hover { transform: scale(1.08); }
	.step-dot:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
	.step-active {
		background: var(--accent);
		color: white;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
	}
	.step-done {
		background: #22c55e;
		color: #0b0b1a;
	}
	.step-pending {
		background: var(--surface2);
		color: var(--muted);
		border: 1px solid var(--border);
	}

	/* Butonul din antetul grilei de trepte — mic, ca să stea pe aceeași linie cu
	   eticheta de 10px fără s-o împingă pe două rânduri. Deschis la culoare (text
	   aproape alb pe alb translucid): în accentul mov al cardului se pierdea în fundal. */
	.trepte-btn {
		flex-shrink: 0;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1;
		padding: 5px 8px;
		border-radius: 8px;
		color: var(--text);
		background: color-mix(in srgb, #fff 14%, transparent);
		border: 1px solid color-mix(in srgb, #fff 26%, transparent);
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
	}
	.trepte-btn:hover {
		background: color-mix(in srgb, #fff 22%, transparent);
		border-color: color-mix(in srgb, var(--ac) 70%, #fff);
		transform: translateY(-1px);
	}
	.trepte-btn:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }

	/* Caracteristicile — chip-uri mici, translucide, pe un rând care se rupe;
	   iconița în accentul categoriei (--ac vine de pe card). */
	.spec-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 14px;
		font-size: 11px;
	}
	.spec-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 8px;
		border-radius: 8px;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.01em;
		color: var(--text);
		background: color-mix(in srgb, #fff 7%, transparent);
		border: 1px solid color-mix(in srgb, #fff 14%, transparent);
	}
	.spec-chip svg { width: 12px; height: 12px; color: var(--ac); flex-shrink: 0; }
	.spec-chip em {
		font-style: normal;
		font-weight: 600;
		font-size: 9px;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--muted);
	}

	/* Banda „Alte mașini" — carduri mici, derulare orizontală cu snap; fiecare
	   card în accentul categoriei lui (același tier() ca în listă). */
	.alte-scroll {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		padding-bottom: 4px;
		scroll-snap-type: x mandatory;
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}
	.alta-card {
		flex: 0 0 150px;
		scroll-snap-align: start;
		border-radius: 12px;
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--border);
		text-decoration: none;
		color: var(--text);
		transition: border-color 0.2s ease, transform 0.15s ease;
	}
	.alta-card:hover {
		border-color: color-mix(in srgb, var(--ac) 60%, var(--border));
		transform: translateY(-2px);
	}
	.alta-card:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
	.alta-foto {
		position: relative;
		aspect-ratio: 16 / 10;
	}
	.alta-foto img {
		display: block;
		width: 100%; height: 100%;
		object-fit: cover;
	}
	.alta-fara-poza {
		position: absolute; inset: 0;
		width: 48px; height: 48px;
		margin: auto;
		opacity: 0.5;
	}
	.alta-chip {
		position: absolute; top: 6px; left: 6px;
		font-size: 9px; font-weight: 700;
		text-transform: uppercase; letter-spacing: 0.06em;
		padding: 2px 6px;
		border-radius: 5px;
		border: 1px solid;
		backdrop-filter: blur(6px);
	}
	.alta-text { padding: 8px 10px 9px; }
	.alta-nume {
		font-size: 12px; font-weight: 700; line-height: 1.2;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}
	.alta-pret { font-size: 11px; margin-top: 3px; color: var(--muted); }
	.alta-pret b { color: var(--ac); font-size: 13px; }
	/* Ocupată în perioadă: rămâne la vedere (omul își poate muta datele), dar stinsă. */
	.alta-ocupata { opacity: 0.6; }
	.alta-ocupata .alta-foto img { filter: grayscale(0.6); }

	.sticky-action {
		position: fixed;
		left: 0; right: 0;
		/* Înălțimea reală a navigației, măsurată în layout — nu o valoare ghicită.
		   Cu 64px fix, butonul intra sub meniu pe ecranele unde nav-ul e mai înalt. */
		bottom: var(--nav-h, 64px);
		z-index: 40;
		padding: 8px 16px 12px;
		background: linear-gradient(180deg, transparent 0%, rgba(13,13,34,0.85) 30%, rgba(13,13,34,0.98) 100%);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}
	.sticky-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 16px;
		background: var(--surface);
		border: 1px solid var(--border);
		box-shadow: 0 -4px 24px -8px rgba(0,0,0,0.5);
	}

	/* Pe lat NU coborâm bara la 0: navigația de jos rămâne vizibilă și acolo,
	   iar regula asta o băga fix sub meniu — de-acolo veneau butoanele tăiate. */

	/* HERO grid: pe wide screens, foto + tarif card alături */
	.hero-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
	}
	@media (min-width: 1024px) {
		.hero-grid {
			grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
			gap: 16px;
			align-items: stretch;
		}
		.hero-grid .hero-stage,
		.hero-grid .tarif-card {
			height: 100%;
		}
	}

	.check-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px; height: 18px;
		border-radius: 50%;
		font-size: 11px;
		font-weight: 800;
		background: color-mix(in srgb, var(--ac) 22%, transparent);
		flex-shrink: 0;
	}

	/* Trust badge — colored mini-cards pentru încredere */
	.trust-badge {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 10px;
		background: var(--cbg);
		border: 1px solid var(--cbr);
		min-width: 0;
		transition: transform 0.2s ease, background 0.2s ease;
	}
	.trust-badge:hover {
		transform: translateY(-1px);
		background: color-mix(in srgb, var(--c) 22%, transparent);
	}
	.trust-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px; height: 22px;
		border-radius: 7px;
		font-size: 12px;
		font-weight: 800;
		background: color-mix(in srgb, var(--c) 25%, transparent);
		color: var(--c);
		flex-shrink: 0;
	}
	.trust-title {
		font-size: 11px;
		font-weight: 700;
		line-height: 1.15;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.trust-sub {
		font-size: 9px;
		font-weight: 500;
		line-height: 1.1;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-top: 1px;
	}

	/* Pulsing dots pentru status banner */
	.dot-pulse-red, .dot-pulse-green {
		width: 8px; height: 8px;
		border-radius: 50%;
		display: inline-block;
		flex-shrink: 0;
	}
	.dot-pulse-red {
		background: #ef4444;
		box-shadow: 0 0 0 0 #ef4444;
		animation: pulseRed 1.6s ease-out infinite;
	}
	.dot-pulse-green {
		background: #10b981;
		box-shadow: 0 0 0 0 #10b981;
		animation: pulseGreen 2s ease-out infinite;
	}
	@keyframes pulseRed {
		0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
		70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
		100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
	}
	@keyframes pulseGreen {
		0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
		70%  { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
		100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
	}

	/* CTA mare în tarif card (desktop) */
	.cta-btn-hero {
		font-size: 14px;
		padding: 12px 22px;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	@media (prefers-reduced-motion: reduce) {
		.dot-pulse-red, .dot-pulse-green { animation: none; }
	}

	/* HERO */
	.hero-stage {
		isolation: isolate;
		box-shadow:
			0 1px 0 rgba(255,255,255,0.05) inset,
			0 16px 40px -16px color-mix(in srgb, var(--ac) 50%, transparent);
		animation: heroIn 0.5s ease both;
	}
	@keyframes heroIn {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.hero-aurora {
		animation: aurora 7s ease-in-out infinite alternate;
	}
	@keyframes aurora {
		0%   { transform: translate3d(0,0,0)    scale(1); }
		100% { transform: translate3d(4%,-3%,0) scale(1.08); }
	}
	.hero-img {
		animation: kenBurns 24s ease-in-out infinite alternate;
		transform-origin: center center;
	}
	@keyframes kenBurns {
		0%   { transform: scale(1)    translateX(0); }
		100% { transform: scale(1.06) translateX(-1.2%); }
	}

	.cat-dot {
		width: 6px; height: 6px;
		border-radius: 50%;
		display: inline-block;
		box-shadow: 0 0 0 2px rgba(255,255,255,0.15);
	}

	.nav-btn {
		width: 36px; height: 36px;
		display: inline-flex; align-items: center; justify-content: center;
		border-radius: 50%;
		font-size: 22px;
		font-weight: 700;
		color: #fff;
		background: rgba(13,13,34,0.55);
		border: 1px solid rgba(255,255,255,0.18);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		transition: background 0.2s ease, transform 0.2s ease;
	}
	.nav-btn:hover {
		background: rgba(13,13,34,0.85);
		transform: scale(1.05);
	}

	/* Tarif card cu shimmer */
	.tarif-card {
		isolation: isolate;
		animation: heroIn 0.5s 0.05s ease both;
	}
	.tarif-shimmer {
		background: linear-gradient(110deg, transparent 35%, color-mix(in srgb, var(--ac) 22%, #fff 5%) 50%, transparent 65%);
		transform: translateX(-100%);
		mix-blend-mode: overlay;
		animation: shimmer 4s ease-in-out infinite;
	}
	@keyframes shimmer {
		0%, 30%   { transform: translateX(-100%); }
		70%, 100% { transform: translateX(100%); }
	}

	/* CTA tematizat — folosit pe sticky bar */
	.cta-btn {
		font-size: 13px;
		font-weight: 700;
		padding: 10px 18px;
		border-radius: 12px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: linear-gradient(135deg, var(--ac, var(--accent)), color-mix(in srgb, var(--ac, var(--accent)) 75%, #000));
		color: #0b0b1a;
		border: 1px solid color-mix(in srgb, var(--ac, var(--accent)) 70%, #fff 8%);
		box-shadow:
			0 1px 0 rgba(255,255,255,0.22) inset,
			0 6px 18px -6px color-mix(in srgb, var(--ac, var(--accent)) 70%, transparent);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		cursor: pointer;
	}
	.cta-btn:hover:not(.cta-disabled) {
		transform: translateY(-1px);
		box-shadow:
			0 1px 0 rgba(255,255,255,0.26) inset,
			0 10px 22px -6px color-mix(in srgb, var(--ac, var(--accent)) 80%, transparent);
	}
	.cta-btn:active:not(.cta-disabled) { transform: translateY(0); }
	.cta-btn.cta-disabled,
	.cta-btn:disabled {
		background: var(--surface2);
		color: var(--muted);
		border-color: var(--border);
		box-shadow: none;
		cursor: not-allowed;
	}
	.cta-arrow { transition: transform 0.2s ease; }
	.cta-btn:hover:not(.cta-disabled) .cta-arrow { transform: translateX(2px); }

	@media (prefers-reduced-motion: reduce) {
		.hero-stage, .tarif-card { animation: none; }
		.hero-aurora, .hero-img, .tarif-shimmer { animation: none; }
	}

	/* Extras card */
	.extra-card {
		background: var(--surface2);
		border: 1px solid var(--border);
		cursor: pointer;
	}
	.extra-card:hover {
		border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
	}
	.extra-card.extra-on {
		background: color-mix(in srgb, var(--accent) 10%, var(--surface2));
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent) inset;
	}
	.extra-icon {
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.extra-card.extra-on .extra-icon {
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.extra-check {
		width: 20px;
		height: 20px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		color: var(--accent);
		margin-top: 2px;
	}
	.extra-card.extra-on .extra-check {
		background: var(--accent);
		color: white;
	}
</style>
