<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gsap } from 'gsap';
	import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
	import { SplitText } from 'gsap/SplitText';
	import { api, type MasiniMini, type TipServiciu, type ZiBlocata } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';
	import { sortable } from '$lib/sortable';
	import { atelier, incarcaAtelier } from '$lib/atelier';
	import { marca } from '$lib/brand.svelte';

	// Reprogramare: vine din /programari prin query ?reprogramare={id}&nr={plate}&tip={cod}
	const reprogramareId = $derived(Number(page.url.searchParams.get('reprogramare')) || null);
	const reprogramareNr  = $derived(page.url.searchParams.get('nr') ?? '');
	const reprogramareTip = $derived(page.url.searchParams.get('tip') ?? '');

	// Config
	let ore             = $state<string[]>([]);
	let oreOcupate      = $state<string[]>([]);
	let masini          = $state<MasiniMini[]>([]);
	let tipuriServiciu  = $state<TipServiciu[]>([]);
	let maxFutureDays   = $state(90);
	let loading         = $state(true);
	let loadingSloturi  = $state(false);
	let saving          = $state(false);
	let error           = $state('');

	gsap.registerPlugin(DrawSVGPlugin, SplitText);

	// Form state
	let pas              = $state<1 | 2 | 3>(1);
	/** Etapa 4: cererea a plecat. Nu mai plecăm din pagină — răspunsul se dă aici. */
	let trimis           = $state(false);
	let tipSelectat      = $state('');
	let masinaSelectata  = $state('');
	let dataSelectata    = $state('');
	let oraSelectata     = $state('');
	let notita           = $state('');

	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	const minDate = tomorrow.toISOString().split('T')[0];

	const maxDate = $derived.by(() => {
		const d = new Date();
		d.setDate(d.getDate() + maxFutureDays);
		return d.toISOString().split('T')[0];
	});

	// ── Calendar carduri-zi ──────────────────────────────────────────────
	const today0 = new Date(); today0.setHours(0, 0, 0, 0);
	let lunaCursor = $state(new Date(today0.getFullYear(), today0.getMonth(), 1));
	let zileBlocate = $state<Map<string, ZiBlocata>>(new Map());
	let ocupare = $state<Record<string, number>>({});
	let totalSloturi = $state(19);
	let modalOreOpen = $state(false);

	const lunaLabel = $derived(
		lunaCursor.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })
	);

	function isoDate(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// Grid de zile pentru luna curentă, aliniat la luni
	const zileLuna = $derived.by(() => {
		const y = lunaCursor.getFullYear();
		const m = lunaCursor.getMonth();
		const prima = new Date(y, m, 1);
		const ultima = new Date(y, m + 1, 0);
		// JS: Sun=0..Sat=6 → vrem Lun=0..Dum=6
		const offsetLuni = (prima.getDay() + 6) % 7;
		const total = offsetLuni + ultima.getDate();
		const sloturi: Array<{ data: string; zi: number; inLuna: boolean; date: Date } | null> = [];
		for (let i = 0; i < offsetLuni; i++) sloturi.push(null);
		for (let zi = 1; zi <= ultima.getDate(); zi++) {
			const d = new Date(y, m, zi);
			sloturi.push({ data: isoDate(d), zi, inLuna: true, date: d });
		}
		while (sloturi.length % 7 !== 0) sloturi.push(null);
		return sloturi;
	});

	const lunaMin = $derived(new Date(today0.getFullYear(), today0.getMonth(), 1));
	const lunaMax = $derived.by(() => {
		const d = new Date(today0); d.setDate(d.getDate() + maxFutureDays);
		return new Date(d.getFullYear(), d.getMonth(), 1);
	});

	const potRetro = $derived(lunaCursor.getTime() > lunaMin.getTime());
	const potInainte = $derived(lunaCursor.getTime() < lunaMax.getTime());

	async function incarcaZileBlocate() {
		const y = lunaCursor.getFullYear();
		const m = lunaCursor.getMonth();
		const from = isoDate(new Date(y, m, 1));
		const to   = isoDate(new Date(y, m + 1, 0));
		try {
			const res = await api.programariZileBlocate(from, to);
			const map = new Map<string, ZiBlocata>();
			for (const z of res.zile) map.set(z.data, z);
			zileBlocate = map;
			ocupare = res.ocupare ?? {};
			totalSloturi = res.total_sloturi || 19;
		} catch { /* nefatal */ }
	}

	function schimbaLuna(delta: number) {
		const d = new Date(lunaCursor.getFullYear(), lunaCursor.getMonth() + delta, 1);
		if (d.getTime() < lunaMin.getTime() || d.getTime() > lunaMax.getTime()) return;
		lunaCursor = d;
		incarcaZileBlocate();
	}

	function selecteazaZi(iso: string) {
		dataSelectata = iso;
		oraSelectata = '';
		onDataSchimbata();
		modalOreOpen = true;
	}

	function alegeOra(o: string, ocupat: boolean) {
		if (ocupat) return;
		oraSelectata = o;
		modalOreOpen = false;
	}

	function inchideModalOre() {
		modalOreOpen = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && modalOreOpen) {
			e.preventDefault();
			inchideModalOre();
		}
	}

	type StareZi = 'past' | 'far' | 'weekend' | 'sarbatoare' | 'liber';
	function stareZi(iso: string, date: Date): { stare: StareZi; label?: string } {
		if (iso < minDate) return { stare: 'past' };
		if (iso > maxDate) return { stare: 'far' };
		const blocat = zileBlocate.get(iso);
		if (blocat) return { stare: blocat.motiv === 'weekend' ? 'weekend' : 'sarbatoare', label: blocat.label };
		// Fallback local pentru weekend (înainte ca API-ul să răspundă)
		const dow = date.getDay();
		if (dow === 0 || dow === 6) return { stare: 'weekend', label: 'Weekend' };
		return { stare: 'liber' };
	}

	/**
	 * Pasul 1 era nouă pătrate goale: omul venit din Piesa365 nu știe unde e
	 * atelierul, cine îi montează piesa sau ce face cu mașina cât stă în service.
	 * Heroul de deasupra grilei spune asta înainte să i se ceară o alegere.
	 *
	 * Textul pentru cel venit din magazin vorbește despre MONTAJ, nu despre
	 * „piesa noastră": Piesa365 e altă firmă, iar Next Level Garage e serviciul
	 * ei de casă. Prima variantă spunea că piesa „a plecat din același loc" —
	 * ceea ce nu e adevărat și amestecă două firme.
	 *
	 * Poza e prima din galeria de service (Setări → Portal clienți); fără ea
	 * rămâne fundalul, fără atelier nu se afișează deloc — pasul 1 arată ca azi.
	 */
	let pozaAtelier = $state<string | null>(null);
	const dinShop   = $derived(marca.val.cheie === 'piesa365');
	const hartaUrl  = $derived(
		$atelier?.adresa
			? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${$atelier.denumire} ${$atelier.adresa}`)}`
			: null,
	);

	onMount(async () => {
		incarcaAtelier();
		api.serviceGalerie()
			.then((res) => (pozaAtelier = res.galerie[0]?.url ?? null))
			.catch(() => {});

		try {
			const cfg = await api.programariConfig();
			ore            = cfg.ore;
			masini         = cfg.masini;
			tipuriServiciu = cfg.tipuri_serviciu;
			maxFutureDays  = cfg.max_future_days;
			// Pre-selecteaza prima masina daca exista una singura
			if (masini.length === 1) masinaSelectata = masini[0].numar_inmatriculare;

			// Prefill pentru reprogramare — sări direct la pasul 2
			if (reprogramareId) {
				if (reprogramareNr && masini.some(m => m.numar_inmatriculare === reprogramareNr)) {
					masinaSelectata = reprogramareNr;
				}
				if (reprogramareTip && tipuriServiciu.some(t => t.cod === reprogramareTip)) {
					tipSelectat = reprogramareTip;
					pas = 2;
					incarcaZileBlocate();
				}
			}
		} catch { error = 'Eroare la încărcare.'; }
		finally { loading = false; }
	});

	// La schimbarea datei → cere sloturile ocupate ca sa marcam butoanele ca disabled
	async function onDataSchimbata() {
		oraSelectata = '';
		oreOcupate   = [];
		if (!dataSelectata) return;
		loadingSloturi = true;
		try {
			const cfg = await api.programariConfig(dataSelectata);
			oreOcupate = cfg.ore_ocupate;
		} catch {
			// Esecul aici nu e fatal — utilizatorul va primi 409 la submit daca slotul e luat
		} finally {
			loadingSloturi = false;
		}
	}

	function selectTip(cod: string) {
		tipSelectat = cod;
		pas = 2;
		incarcaZileBlocate();
	}

	function inapoiLaPas1() {
		pas = 1;
		dataSelectata = '';
		oraSelectata  = '';
	}

	function continuaLaPas3() {
		if (!dataSelectata || !oraSelectata || !masinaSelectata) return;
		pas = 3;
	}

	/**
	 * „Schimbă" de pe o etapă închisă: firul se retrage până acolo. Etapele de
	 * după se golesc, altfel ar rămâne un răspuns fără întrebare (ai schimbat
	 * serviciul, dar ora aleasă pentru vechiul serviciu stă mai jos).
	 */
	function inapoiLa(n: 1 | 2 | 3) {
		if (trimis) return;
		if (n === 1) { dataSelectata = ''; oraSelectata = ''; }
		pas = n;
	}

	/** Unde e omul pe fir: 1–3 cât alege, 4 după ce a trimis cererea. */
	const etapaCurenta = $derived(trimis ? 4 : pas);
	const stareEt = (n: number) =>
		etapaCurenta > n ? 'gata' : etapaCurenta === n ? 'acum' : 'viitor';


	// ── Coregrafia ────────────────────────────────────────────────────────────
	// Fiecare mișcare răspunde la o întrebare pe care omul o are exact atunci:
	// unde s-a dus alegerea mea (Flip), s-a închis pasul? (bifa desenată), mai
	// e mult? (firul care curge), unde mă uit acum? (inelul care pulsează).
	const reducedMotion = () =>
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	/** Etapa care tocmai s-a închis: bifa se desenează, firul curge spre următoarea. */
	function inchideEtapa(n: number) {
		if (reducedMotion()) return;
		const et = document.querySelector(`[data-etapa="${n}"]`);
		if (!et) return;

		const tl = gsap.timeline();
		const bifa = et.querySelector('.et-bifa path');
		if (bifa) tl.fromTo(bifa, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.34, ease: 'power2.inOut' }, 0.1);
		const linie = et.querySelector('.et-linie i');
		if (linie) tl.fromTo(linie, { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: 'power2.out' }, 0.05);
		const rez = et.querySelector('.et-rezumat');
		if (rez) tl.from(rez, { opacity: 0, y: 6, duration: 0.3, ease: 'power2.out' }, 0.14);

		const urm = document.querySelector(`[data-etapa="${n + 1}"] .et-corp`);
		if (urm) tl.from(urm, { opacity: 0, y: 10, duration: 0.4, ease: 'power2.out' }, 0.3);
	}

	/**
	 * Pătratul ales zboară în rezumat: „unde s-a dus alegerea mea?" — acolo, o vezi.
	 *
	 * Se zboară o CLONĂ fixată, nu elementul: originalul dispare odată cu grila
	 * (Svelte îl scoate din DOM la schimbarea pasului), iar un element care nu
	 * mai există nu poate fi animat. Se cheamă din `onclick`, cât timp mai are
	 * poziție de citit.
	 */
	function zboaraInFir(sursa: HTMLElement) {
		if (reducedMotion()) return;
		const a = sursa.getBoundingClientRect();
		const clona = sursa.cloneNode(true) as HTMLElement;
		Object.assign(clona.style, {
			position: 'fixed', left: `${a.left}px`, top: `${a.top}px`,
			width: `${a.width}px`, height: `${a.height}px`, margin: '0',
			zIndex: '60', pointerEvents: 'none',
		});
		document.body.appendChild(clona);

		tick().then(() => {
			const tinta = document.querySelector('[data-etapa="1"] .et-rezumat-ic');
			if (!tinta) { clona.remove(); return; }
			const t = tinta.getBoundingClientRect();
			gsap.to(clona, {
				duration: 0.5, ease: 'power2.inOut',
				x: t.left - a.left + (t.width - a.width) / 2,
				y: t.top - a.top + (t.height - a.height) / 2,
				scale: t.width / a.width,
				borderRadius: 8,
				onComplete: () => {
					clona.remove();
					gsap.fromTo(tinta, { scale: 1.25 }, { scale: 1, duration: 0.26, ease: 'back.out(2)' });
				},
			});
		});
	}

	/** Mesajul de final intră cuvânt cu cuvânt — se citește ca o vorbă, nu ca un toast. */
	function scrieFinalul() {
		if (reducedMotion()) return;
		const el = document.querySelector('.et-final-mesaj');
		if (!el) return;
		const split = new SplitText(el, { type: 'words' });
		gsap.from(split.words, { opacity: 0, y: 7, duration: 0.36, stagger: 0.065, ease: 'power2.out', delay: 0.1 });
	}

	// Coregrafia se leagă de starea firului, nu de fiecare buton în parte.
	let etapaAnterioara = 1;
	$effect(() => {
		const acum = trimis ? 4 : pas;
		if (acum > etapaAnterioara) {
			tick().then(() => {
				inchideEtapa(acum - 1);
				if (acum === 4) scrieFinalul();
			});
		}
		etapaAnterioara = acum;
	});

	async function confirma() {
		error = '';
		saving = true;
		try {
			await api.addProgramare({
				data:             dataSelectata,
				ora:              oraSelectata,
				nr_inmatriculare: masinaSelectata,
				tip_serviciu:     tipSelectat,
				notita:           notita || undefined,
			});
			// La reprogramare → anulează programarea veche după ce noua e creată cu succes
			if (reprogramareId) {
				try { await api.anulareProgramare(reprogramareId); } catch { /* nefatal — userul vede ambele în listă */ }
			}
			// Nu-l mai aruncăm într-o listă: drumul se termină unde a început, cu
			// etapa 4 — „am primit cererea, îți confirmăm ora". Lista e la un clic.
			trimis = true;
		} catch (e: any) {
			error = e.message ?? 'Eroare la salvare.';
			// 409 = slot ocupat intre timp → reincarca sloturile si trimite-l inapoi la pas 2
			if (e.status === 409) {
				oraSelectata = '';
				try {
					const cfg = await api.programariConfig(dataSelectata);
					oreOcupate = cfg.ore_ocupate;
				} catch {}
			}
			pas = 2;
		} finally {
			saving = false;
		}
	}

	const tipLabel     = $derived(tipuriServiciu.find(t => t.cod === tipSelectat)?.label ?? '');
	const masinaNume   = $derived(masini.find(m => m.numar_inmatriculare === masinaSelectata));
	const dataFormatat = $derived(dataSelectata
		? new Date(dataSelectata + 'T00:00:00').toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })
		: '');

	/** Rezumatul etapei 2: ziua și ora, într-un rând. */
	const rezumatCand = $derived(
		dataSelectata && oraSelectata ? `${dataFormatat} · ${oraSelectata}` : '',
	);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		{#if pas === 1}
			<a href="/dashboard/programari" class="text-sm" style="color: var(--muted)">← Înapoi</a>
		{:else}
			<button onclick={() => pas === 2 ? inapoiLaPas1() : (pas = 2)}
				class="text-sm" style="color: var(--muted)">← Înapoi</button>
		{/if}
	</div>

	<!-- Banner reprogramare -->
	{#if reprogramareId}
		<div class="px-4 py-3 rounded-2xl border flex items-center gap-3"
			style="background: #3b82f612; border-color: #3b82f640;">
			<span class="text-xl shrink-0">📆</span>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-semibold" style="color: var(--text)">Reprogramare</p>
				<p class="text-xs mt-0.5" style="color: var(--muted)">Programarea veche pentru {reprogramareNr} se anulează automat la confirmare.</p>
			</div>
		</div>
	{/if}


	{#if loading}
		<div class="space-y-3">
			{#each Array(4) as _}
				<div class="p-3 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
					<Skeleton height="h-3" class="w-24 mb-2" />
					<Skeleton height="h-10" class="w-full" rounded="rounded-xl" />
				</div>
			{/each}
		</div>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- FIRUL — patru etape, nu trei ecrane -->
	<!-- ═══════════════════════════════════════════════════ -->
	{:else}
		{#if $atelier}
			<!-- Cine suntem, înainte de „alege un pătrat". Textul urmează sursa: cine
			     vine din magazin aude puntea (piesa lui, montată aici), cine vine
			     direct aude atelierul. -->
			<section class="ate-hero">
				{#if pozaAtelier}
					<img src={pozaAtelier} alt="" class="ate-poza" loading="lazy" />
				{/if}
				<div class="ate-val"></div>

				<div class="ate-text">
					<p class="ate-eyebrow">{dinShop ? 'Serviciul de casă Piesa365' : 'Atelierul tău'}</p>
					<h2 class="ate-nume">{$atelier.denumire}</h2>
					<p class="ate-pitch">
						{dinShop
							? 'Ai luat o piesă din Piesa365? Te ajutăm cu montajul — alege mai jos ce ai nevoie și îți spunem ce presupune și cât durează.'
							: 'Lași mașina, urmărești lucrarea din portal și aprobi devizul de pe telefon.'}
					</p>

					<div class="ate-rand">
						{#if $atelier.adresa}
							<span class="ate-pastila">📍 {$atelier.adresa}</span>
						{/if}
						<span class="ate-pastila">🚗 Mașină de schimb cât durează</span>
						<span class="ate-pastila">🔍 Diagnoză pe loc</span>
						{#if hartaUrl}
							<a href={hartaUrl} target="_blank" rel="noopener noreferrer" class="ate-harta">
								Vezi pe hartă →
							</a>
						{/if}
					</div>
				</div>
			</section>
		{/if}

		<!-- ═══════════════════════════════════════════════════════════════════
		     FIRUL — cele trei întrebări plus răspunsul atelierului.
		     Nu mai sunt trei ecrane care se înlocuiesc, ci o conversație care
		     ține minte: fiecare răspuns rămâne la vedere, cu „schimbă" lângă,
		     iar etapa 4 e vizibilă de la început, ștearsă, ca omul să știe din
		     prima că drumul se termină cu un răspuns de la noi.
		═══════════════════════════════════════════════════════════════════ -->

		<!-- ETAPA 1 — ce are mașina -->
		<section class="et {stareEt(1)}" data-etapa="1">
			<div class="et-stanga">
				<span class="et-bul">
					<span class="et-nr">1</span>
					<svg class="et-bifa" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9.5 L7.2 13 L14.5 5" /></svg>
					<span class="et-inel"></span>
				</span>
				<span class="et-linie"><i></i></span>
			</div>
			<div class="et-corp">
				<p class="et-intrebare">Ce are mașina?</p>
				{#if etapaCurenta === 1}
					<p class="et-ajutor">Spune-ne pe scurt — dacă nu știi, e în regulă.</p>

					<div class="et-raspuns">
						<div class="grid grid-cols-3 gap-3" use:sortable={{ key: 'programari-tip-serviciu', idAttr: 'data-sort-id' }}>
							{#each tipuriServiciu.filter(t => t.cod !== 'diagnoza') as tip}
								<button
									data-sort-id={tip.cod}
									onclick={(e) => { zboaraInFir(e.currentTarget); selectTip(tip.cod); }}
									class="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all active:scale-95 text-center"
									style="background: var(--surface); border-color: {tipSelectat === tip.cod ? 'var(--accent)' : 'var(--border)'};">
									<span class="text-2xl">{tip.icon}</span>
									<span class="text-xs font-medium leading-tight" style="color: var(--text)">{tip.label}</span>
								</button>
							{/each}
						</div>

						<!-- „Nu știu ce are" — stă în afara grilei sortabile: e un răspuns, nu
						     un tip de serviciu pe care clientul să-l poată rearanja. Duce la
						     diagnoză, care există deja în catalog. -->
						{#if tipuriServiciu.some(t => t.cod === 'diagnoza')}
							<button
								onclick={(e) => { zboaraInFir(e.currentTarget); selectTip('diagnoza'); }}
								class="et-nustiu">
								<span class="text-xl leading-none">🔍</span>
								<span class="min-w-0 text-left">
									<b>Nu știu ce are</b>
									<em>ne uităm noi — diagnoză la venire</em>
								</span>
							</button>
						{/if}
					</div>
				{:else}
					<div class="et-rezumat">
						<span class="et-rezumat-ic">{tipuriServiciu.find(t => t.cod === tipSelectat)?.icon ?? '🔧'}</span>
						<span class="et-rezumat-val">{tipLabel}</span>
						{#if !trimis}
							<button type="button" class="et-schimba" onclick={() => inapoiLa(1)}>schimbă</button>
						{/if}
					</div>
				{/if}
			</div>
		</section>

		<!-- ETAPA 2 — când poate veni -->
		<section class="et {stareEt(2)}" data-etapa="2">
			<div class="et-stanga">
				<span class="et-bul">
					<span class="et-nr">2</span>
					<svg class="et-bifa" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9.5 L7.2 13 L14.5 5" /></svg>
					<span class="et-inel"></span>
				</span>
				<span class="et-linie"><i></i></span>
			</div>
			<div class="et-corp">
				<p class="et-intrebare">Când poți veni?</p>
				{#if etapaCurenta === 2}
					<p class="et-ajutor">Îți arătăm doar zilele și orele libere.</p>
					<div class="et-raspuns">

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- (continuarea etapei 2 — calendarul si masina) -->
	<!-- ═══════════════════════════════════════════════════ -->
		{#if masini.length === 1}
			<div class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border mb-3"
				style="background: var(--surface); border-color: var(--border);">
				<span class="text-lg">🚗</span>
				<div class="leading-tight">
					<p class="text-sm font-semibold" style="color: var(--text)">{masini[0].numar_inmatriculare}</p>
					<p class="text-[11px]" style="color: var(--muted)">{masini[0].marca} {masini[0].model}</p>
				</div>
			</div>
		{/if}

		<div class="space-y-4">
			<!-- Selector mașină când există mai multe -->
			{#if masini.length > 1}
				<div>
					<p class="text-xs mb-2 font-medium" style="color: var(--muted)">Mașina</p>
					<div class="space-y-2">
						{#each masini as m}
							<button
								onclick={() => masinaSelectata = m.numar_inmatriculare}
								class="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left"
								style="background: var(--surface); border-color: {masinaSelectata === m.numar_inmatriculare ? 'var(--accent)' : 'var(--border)'};">
								<div>
									<p class="text-sm font-semibold" style="color: var(--text)">{m.numar_inmatriculare}</p>
									<p class="text-xs" style="color: var(--muted)">{m.marca} {m.model}</p>
								</div>
								{#if masinaSelectata === m.numar_inmatriculare}
									<span style="color: var(--accent)">✓</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{:else if masini.length === 0}
				<div class="p-4 rounded-xl border text-center" style="border-color: var(--border)">
					<p class="text-sm" style="color: var(--muted)">Nu ai nicio mașină înregistrată.</p>
					<a href="/dashboard/masini" class="text-sm mt-1 block" style="color: var(--accent)">
						Adaugă o mașină →
					</a>
				</div>
			{/if}

			<!-- Data — grid de carduri-zi -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<p class="text-xs font-medium" style="color: var(--muted)">Alege ziua</p>
					<div class="flex items-center gap-1">
						<button type="button" onclick={() => schimbaLuna(-1)} disabled={!potRetro}
							class="w-8 h-8 rounded-lg text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
							style="background: var(--surface); border: 1px solid var(--border); color: var(--text);">‹</button>
						<span class="text-xs font-semibold capitalize px-2 min-w-[120px] text-center" style="color: var(--text)">{lunaLabel}</span>
						<button type="button" onclick={() => schimbaLuna(1)} disabled={!potInainte}
							class="w-8 h-8 rounded-lg text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
							style="background: var(--surface); border: 1px solid var(--border); color: var(--text);">›</button>
					</div>
				</div>

				<!-- Cap săptămână -->
				<div class="grid grid-cols-7 gap-1 mb-1.5">
					{#each ['Lu','Ma','Mi','Jo','Vi','Sâ','Du'] as zi, i}
						<div class="text-center text-[10px] font-semibold tracking-wide"
							style="color: {i >= 5 ? '#ef444499' : 'var(--muted)'}">{zi}</div>
					{/each}
				</div>

				<!-- Grid zile — wow cards compact -->
				<div class="grid grid-cols-7 gap-1">
					{#each zileLuna as cell}
						{#if cell === null}
							<div></div>
						{:else}
							{@const s = stareZi(cell.data, cell.date)}
							{@const selectata = dataSelectata === cell.data}
							{@const indisponibila = s.stare !== 'liber'}
							{@const azi = cell.data === isoDate(today0)}
							{@const ocup = ocupare[cell.data] ?? 0}
							{@const procent = Math.min(100, Math.round((ocup / totalSloturi) * 100))}
							{@const aglomerat = procent >= 80}
							<button
								type="button"
								onclick={() => !indisponibila && selecteazaZi(cell.data)}
								disabled={indisponibila}
								title={s.label ?? (ocup ? `${ocup}/${totalSloturi} sloturi ocupate` : 'Liber')}
								class="zi-card relative overflow-hidden flex flex-col items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed"
								class:zi-selectata={selectata}
								class:zi-blocata={indisponibila}
								class:zi-azi={azi}
								class:zi-aglomerat={aglomerat && !indisponibila}>
								{#if indisponibila && s.stare !== 'past' && s.stare !== 'far'}
									<span class="absolute top-0.5 right-1 text-[8px] opacity-55">🔒</span>
								{/if}
								{#if azi}
									<span class="zi-azi-badge absolute top-0.5 left-0.5">AZI</span>
								{/if}

								<span class="text-sm font-bold leading-none tabular-nums">{cell.zi}</span>

								{#if s.stare === 'weekend'}
									<span class="zi-meta">Weekend</span>
								{:else if s.stare === 'sarbatoare'}
									<span class="zi-meta zi-meta-rosu">Sărb.</span>
								{:else if !indisponibila && ocup > 0}
									<span class="zi-meta">{ocup}/{totalSloturi}</span>
								{/if}

								{#if !indisponibila}
									<div class="zi-bar-wrap">
										<div class="zi-bar" style="width: {Math.max(procent, 4)}%; opacity: {procent === 0 ? 0.3 : 1}"></div>
									</div>
								{/if}
							</button>
						{/if}
					{/each}
				</div>

				<!-- Legendă -->
				<div class="flex items-center justify-center gap-3 mt-2 text-[10px] flex-wrap" style="color: var(--muted)">
					<span class="flex items-center gap-1"><span class="legend-bar legend-low"></span>Liber</span>
					<span class="flex items-center gap-1"><span class="legend-bar legend-mid"></span>Parțial</span>
					<span class="flex items-center gap-1"><span class="legend-bar legend-high"></span>Aglomerat</span>
					<span class="flex items-center gap-1">🔒 Nelucrătoare</span>
				</div>
			</div>

			<!-- Chip cu ora aleasă -->
			{#if dataSelectata && oraSelectata}
				<button type="button" onclick={() => modalOreOpen = true}
					class="ora-chip flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all">
					<span class="flex items-center gap-2">
						<span class="text-base">⏰</span>
						<span class="text-sm font-semibold" style="color: var(--text)">{oraSelectata}</span>
						<span class="text-xs" style="color: var(--muted)">· schimbă</span>
					</span>
					<span style="color: var(--muted)">›</span>
				</button>
			{/if}

			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}

			<button
				onclick={continuaLaPas3}
				disabled={!dataSelectata || !oraSelectata || !masinaSelectata}
				class="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
				style="background: var(--accent); color: white;">
				Continuă →
			</button>
					</div>
				</div>
				{:else if etapaCurenta > 2}
					<div class="et-rezumat">
						<span class="et-rezumat-ic">📅</span>
						<span class="et-rezumat-val">
							{rezumatCand}
							<em>{masinaSelectata}{#if masinaNume} · {masinaNume.marca} {masinaNume.model}{/if}</em>
						</span>
						{#if !trimis}
							<button type="button" class="et-schimba" onclick={() => inapoiLa(2)}>schimbă</button>
						{/if}
					</div>
				{/if}
			</div>
		</section>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- (etapele 3 si 4) -->
	<!-- ═══════════════════════════════════════════════════ -->
		<!-- ETAPA 3 — ce mai știm despre mașină -->
		<section class="et {stareEt(3)}" data-etapa="3">
			<div class="et-stanga">
				<span class="et-bul">
					<span class="et-nr">3</span>
					<svg class="et-bifa" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9.5 L7.2 13 L14.5 5" /></svg>
					<span class="et-inel"></span>
				</span>
				<span class="et-linie"><i></i></span>
			</div>
			<div class="et-corp">
				<p class="et-intrebare">Mai știm ceva despre mașină?</p>
				{#if etapaCurenta === 3}
					<p class="et-ajutor">
						{#if dinShop}Adu piesa cumpărată din Piesa365 și talonul.{:else}Adu talonul. Orice detaliu ne ajută să fim gata când vii.{/if}
					</p>
					<div class="et-raspuns">
						<textarea
							bind:value={notita}
							rows="2"
							placeholder="ex: scârțâie la frânare de o săptămână, mai tare pe umed"
							class="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
							style="background: var(--surface); border: 1px solid var(--border); color: var(--text);"></textarea>

						{#if error}
							<p class="text-sm text-red-400 mt-2">{error}</p>
						{/if}

						<!-- „Trimite cererea", nu „Confirmă": confirmarea o dă atelierul, la
						     etapa 4. Butonul vechi promitea ceva ce lista contrazicea imediat,
						     cu „⏳ Planificată". -->
						<button
							onclick={confirma}
							disabled={saving}
							class="et-trimite"
							type="button">
							{saving ? 'Se trimite…' : 'Trimite cererea →'}
						</button>
					</div>
				{:else if etapaCurenta > 3}
					<div class="et-rezumat">
						<span class="et-rezumat-ic">📝</span>
						<span class="et-rezumat-val">{notita || 'fără alte detalii'}</span>
					</div>
				{/if}
			</div>
		</section>

		<!-- ETAPA 4 — răspunsul atelierului -->
		<section class="et et-ultima {stareEt(4)}" data-etapa="4">
			<div class="et-stanga">
				<span class="et-bul">
					<span class="et-nr">4</span>
					<svg class="et-bifa" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9.5 L7.2 13 L14.5 5" /></svg>
					<span class="et-inel"></span>
				</span>
			</div>
			<div class="et-corp">
				{#if trimis}
					<p class="et-intrebare et-final-mesaj">Gata — am primit cererea.</p>
					<p class="et-ajutor">Verificăm programul mecanicului și îți confirmăm ora aici, în portal.</p>
					<p class="et-final-nota">
						Până atunci programarea scrie <b>„⏳ Planificată"</b> — nu e o eroare, e etapa asta.
					</p>
					<a href="/dashboard/programari" class="et-final-link">Vezi programările mele →</a>
				{:else}
					<p class="et-intrebare">Îți confirmăm ora</p>
					<p class="et-ajutor">după ce trimiți cererea</p>
				{/if}
			</div>
		</section>
	{/if}
</div>

<svelte:window onkeydown={onKeydown} />

<!-- ═══════════════════════════════════════════════════ -->
<!-- Modal alegere oră -->
<!-- ═══════════════════════════════════════════════════ -->
{#if modalOreOpen && dataSelectata}
	<div
		class="fundal-modal ore-overlay"
		role="presentation"
		onclick={inchideModalOre}>
	</div>
	<div class="ore-modal" role="dialog" aria-modal="true" aria-label="Alege ora">
		<div class="flex items-center justify-between px-4 pt-4 pb-3">
			<div>
				<p class="text-[10px] uppercase tracking-widest font-semibold" style="color: var(--muted)">Alege ora</p>
				<p class="text-base font-bold capitalize" style="color: var(--text)">{dataFormatat}</p>
				{#if loadingSloturi}
					<p class="text-xs mt-0.5" style="color: var(--muted)">verifică disponibilitatea...</p>
				{:else}
					<p class="text-xs mt-0.5" style="color: var(--muted)">
						{ore.length - oreOcupate.length} libere · {oreOcupate.length} ocupate
					</p>
				{/if}
			</div>
			<button type="button" onclick={inchideModalOre}
				class="w-8 h-8 rounded-full flex items-center justify-center transition-all"
				style="background: var(--surface); border: 1px solid var(--border); color: var(--muted)"
				aria-label="Închide">✕</button>
		</div>

		<div class="px-4 pb-4 grid grid-cols-4 gap-2 overflow-y-auto">
			{#each ore as o}
				{@const ocupat = oreOcupate.includes(o)}
				{@const selectata = oraSelectata === o}
				<button
					type="button"
					onclick={() => alegeOra(o, ocupat)}
					disabled={ocupat}
					title={ocupat ? 'Slot ocupat' : ''}
					class="ora-cell py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:cursor-not-allowed"
					class:ora-selectata={selectata}
					class:ora-ocupata={ocupat}>
					<span>{o}</span>
					{#if ocupat}
						<span class="block text-[8px] mt-0.5 uppercase tracking-wider opacity-70">Ocupat</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	/* === Firul conversației ================================================
	   Patru etape sub același fir: întrebarea, răspunsul care rămâne la vedere
	   și, la capăt, răspunsul atelierului. Stările vin din clasa pusă în
	   markup (`gata` / `acum` / `viitor`), animația din GSAP — CSS-ul nu face
	   decât să le arate. */
	.et { display: grid; grid-template-columns: 30px 1fr; gap: 13px; }
	.et-stanga { display: flex; flex-direction: column; align-items: center; }
	.et-bul {
		position: relative;
		width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
		display: grid; place-items: center;
		font-size: 12px; font-weight: 800;
		background: var(--surface2); color: var(--muted);
		border: 2px solid var(--border);
		transition: background .3s ease, border-color .3s ease, color .3s ease;
	}
	.et-nr { transition: opacity .2s ease, transform .3s ease; }
	.et-bifa { position: absolute; inset: 6px; opacity: 0; }
	.et-bifa path {
		fill: none; stroke: #052e1a; stroke-width: 3.2;
		stroke-linecap: round; stroke-linejoin: round;
	}
	.et-inel { position: absolute; inset: -5px; border-radius: 50%; pointer-events: none; }

	.et.acum .et-bul { background: var(--accent); color: #fff; border-color: var(--accent); }
	.et.acum .et-inel { animation: etPuls 2.4s ease-out infinite; }
	@keyframes etPuls {
		0%   { box-shadow: 0 0 0 0 rgba(59,130,246,.40); }
		70%  { box-shadow: 0 0 0 9px rgba(59,130,246,0); }
		100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
	}
	.et.gata .et-bul { background: var(--green, #22c55e); border-color: var(--green, #22c55e); }
	.et.gata .et-nr  { opacity: 0; transform: scale(.4); }
	.et.gata .et-bifa { opacity: 1; }
	.et.viitor { opacity: .45; }
	.et.viitor .et-ajutor { display: none; }

	.et-linie {
		flex: 1; width: 2px; min-height: 12px; margin: 4px 0;
		border-radius: 2px; background: var(--border); overflow: hidden;
	}
	.et-linie i {
		display: block; width: 100%; height: 100%; border-radius: 2px;
		background: linear-gradient(180deg, #22c55e, #3b82f6);
		transform: scaleY(0); transform-origin: top center;
	}
	.et.gata .et-linie i { transform: scaleY(1); }

	.et-corp { padding-bottom: 18px; min-width: 0; }
	.et.et-ultima .et-corp { padding-bottom: 0; }

	.et-intrebare { font-size: 15px; font-weight: 700; letter-spacing: -.01em; line-height: 1.35; color: var(--text); }
	.et.gata .et-intrebare { font-size: 12px; font-weight: 600; color: var(--muted); }
	.et-ajutor { margin: 3px 0 0; font-size: 12.5px; color: var(--muted); }
	.et-raspuns { padding-top: 12px; }

	.et-rezumat { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
	.et-rezumat-ic {
		width: 28px; height: 28px; border-radius: 9px; flex-shrink: 0;
		display: grid; place-items: center; font-size: 15px;
		background: var(--surface2); border: 1px solid var(--border);
	}
	.et-rezumat-val { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 700; color: var(--text); }
	.et-rezumat-val em {
		display: block; font-style: normal; font-weight: 500;
		font-size: 11.5px; color: var(--muted);
	}
	.et-schimba {
		flex-shrink: 0;
		font-size: 11px; font-weight: 700; color: var(--accent);
		background: none; border: 1px solid rgba(59,130,246,.38);
		border-radius: 9px; padding: 5px 10px; cursor: pointer;
	}
	.et-schimba:hover { background: rgba(59,130,246,.10); }

	/* „Nu știu ce are" — răspunsul celui care nu se poate autodiagnostica. */
	.et-nustiu {
		width: 100%; margin-top: 10px;
		display: flex; align-items: center; gap: 10px;
		padding: 12px 14px; border-radius: 16px; text-align: left;
		background: rgba(59,130,246,.10);
		border: 1px solid rgba(59,130,246,.38);
		transition: border-color .18s ease, transform .12s ease;
	}
	.et-nustiu:active { transform: scale(.98); }
	.et-nustiu b  { display: block; font-size: 13px; font-weight: 700; color: var(--text); }
	.et-nustiu em { display: block; font-style: normal; font-size: 11px; color: var(--muted); }

	.et-trimite {
		width: 100%; margin-top: 11px; padding: 13px; border-radius: 13px;
		font-size: 14px; font-weight: 800; color: #fff; border: 1px solid transparent;
		background: linear-gradient(100deg, #b45309 0%, #dc2626 55%, #7c3aed 100%);
		box-shadow: 0 10px 26px -12px rgba(220,38,38,.7);
		transition: transform .12s ease, opacity .2s ease;
	}
	.et-trimite:active { transform: scale(.98); }
	.et-trimite:disabled { opacity: .55; }

	.et-final-nota {
		margin: 10px 0 0; font-size: 11.5px; color: var(--muted);
		border-left: 2px solid #eab308; padding-left: 10px;
	}
	.et-final-link {
		display: inline-block; margin-top: 12px;
		font-size: 12.5px; font-weight: 700; color: var(--accent); text-decoration: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.et.acum .et-inel { animation: none; }
		.et.gata .et-linie i { transform: scaleY(1); }
	}

	/* === Heroul atelierului (pasul 1) ===================================== */
	.ate-hero {
		position: relative;
		height: 190px;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid var(--border);
		/* Fundalul de sub poză: fără nicio poză în galerie, heroul rămâne o hală
		   întunecată, nu o cutie neagră goală. */
		background: radial-gradient(120% 95% at 50% 25%, #2c3a68 0%, #161c38 55%, #10162c 100%);
		isolation: isolate;
	}
	@media (max-width: 480px) { .ate-hero { height: 165px; } }

	.ate-poza {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	/* Vălul începe abia pe la jumătate: peste toată înălțimea stingea poza. */
	.ate-val {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg,
			rgba(13,13,34,0.10) 0%,
			rgba(13,13,34,0.30) 42%,
			rgba(13,13,34,0.86) 78%,
			rgba(13,13,34,0.96) 100%);
	}
	.ate-text {
		position: absolute;
		left: 0; right: 0; bottom: 0;
		padding: 14px 16px;
	}
	.ate-eyebrow {
		margin: 0;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		color: #fcd34d;
	}
	.ate-nume {
		margin: 5px 0 0;
		font-size: 19px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: #fff;
	}
	.ate-pitch {
		margin: 4px 0 0;
		font-size: 12.5px;
		color: rgba(255,255,255,0.85);
	}
	.ate-rand {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}
	.ate-pastila {
		font-size: 11px;
		font-weight: 700;
		color: #fff;
		background: rgba(255,255,255,0.14);
		border: 1px solid rgba(255,255,255,0.24);
		border-radius: 999px;
		padding: 5px 10px;
		backdrop-filter: blur(4px);
	}
	/* Pe îngust rămâne adresa; restul dovezilor cad, ca rândul să nu se rupă în trei. */
	@media (max-width: 480px) {
		.ate-pastila:not(:first-child) { display: none; }
	}
	.ate-harta {
		font-size: 11px;
		font-weight: 800;
		color: #1d1d2e;
		background: #fff;
		border-radius: 999px;
		padding: 5px 11px;
		text-decoration: none;
		box-shadow: 0 8px 22px -8px rgba(0,0,0,0.5);
	}

	/* === Carduri-zi premium compact === */
	.zi-card {
		font-feature-settings: 'tnum';
		height: 56px;
		padding: 4px 2px 6px;
		gap: 2px;
		background:
			linear-gradient(160deg, rgba(99,102,241,0.06) 0%, transparent 60%),
			var(--surface);
		border-color: var(--border);
		color: var(--text);
		isolation: isolate;
	}

	.zi-meta {
		font-size: 8px;
		line-height: 1;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.6;
	}
	.zi-meta-rosu {
		color: #ef4444;
		opacity: 0.85;
	}
	.zi-selectata .zi-meta { opacity: 0.85; }
	.zi-card:not(:disabled):hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		background:
			linear-gradient(160deg, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%),
			var(--surface);
		box-shadow:
			0 8px 18px -8px color-mix(in srgb, var(--accent) 60%, transparent),
			0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent);
	}
	.zi-card:not(:disabled):active { transform: scale(0.96); }

	/* AZI — badge text + ring subtil */
	.zi-azi {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent) inset;
	}
	.zi-azi-badge {
		font-size: 7px;
		font-weight: 800;
		letter-spacing: 0.06em;
		padding: 1px 3px;
		border-radius: 3px;
		background: var(--accent);
		color: #fff;
		line-height: 1;
		box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 70%, transparent);
		animation: ziAziPulse 2.2s ease-in-out infinite;
		z-index: 2;
	}
	@keyframes ziAziPulse {
		0%, 100% { box-shadow: 0 0 8px  color-mix(in srgb, var(--accent) 60%, transparent); }
		50%      { box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 90%, transparent); }
	}
	.zi-selectata .zi-azi-badge {
		background: rgba(255,255,255,0.95);
		color: var(--accent);
		box-shadow: 0 0 8px rgba(255,255,255,0.55);
	}

	/* Selectată — gradient accent + glow + animație pop */
	.zi-selectata {
		background: linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 75%, #6366f1) 100%) !important;
		border-color: var(--accent) !important;
		color: #fff !important;
		box-shadow:
			0 1px 0 rgba(255,255,255,0.22) inset,
			0 8px 22px -6px color-mix(in srgb, var(--accent) 80%, transparent),
			0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent);
		animation: ziPop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.zi-selectata::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%);
		transform: translateX(-100%);
		animation: ziShimmer 1.4s ease-out;
		pointer-events: none;
	}
	@keyframes ziPop {
		0%   { transform: scale(0.88); }
		55%  { transform: scale(1.06); }
		100% { transform: scale(1); }
	}
	@keyframes ziShimmer {
		0%   { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}

	/* Aglomerat (>=80%) — accent subtil de avertizare */
	.zi-aglomerat {
		background:
			linear-gradient(160deg, rgba(234,179,8,0.10) 0%, transparent 60%),
			var(--surface);
	}

	/* Blocată — textură diagonală + dim */
	.zi-blocata {
		opacity: 0.55;
		background:
			repeating-linear-gradient(135deg, transparent 0 5px, rgba(255,255,255,0.035) 5px 6px),
			var(--surface);
		color: var(--muted);
	}

	/* Progress bar ocupare — pinned bottom */
	.zi-bar-wrap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 3px;
		background: rgba(255,255,255,0.08);
		overflow: hidden;
	}
	.zi-bar {
		height: 100%;
		background: linear-gradient(90deg, #22c55e 0%, #22c55e 55%, #eab308 78%, #ef4444 100%);
		background-size: 167% 100%;
		background-position: 0 0;
		border-radius: 0 2px 2px 0;
		transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), background-position 0.4s ease;
	}
	.zi-aglomerat .zi-bar {
		background-position: 100% 0;
		box-shadow: 0 0 8px rgba(239,68,68,0.45);
	}
	.zi-selectata .zi-bar-wrap { background: rgba(255,255,255,0.22); }
	.zi-selectata .zi-bar {
		background: rgba(255,255,255,0.95);
		box-shadow: 0 0 10px rgba(255,255,255,0.6);
	}

	/* Legendă */
	.legend-bar {
		display: inline-block;
		width: 14px;
		height: 3px;
		border-radius: 2px;
	}
	.legend-low  { background: #22c55e; }
	.legend-mid  { background: #eab308; }
	.legend-high { background: #ef4444; }

	@media (prefers-reduced-motion: reduce) {
		.zi-dot-azi, .zi-selectata, .zi-selectata::after { animation: none; }
	}

	/* === Chip cu ora aleasă === */
	.ora-chip {
		background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 70%), var(--surface);
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
		box-shadow: 0 4px 14px -8px color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.ora-chip:hover {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
		transform: translateY(-1px);
	}

	/* === Bottom sheet alegere oră (nu acoperă calendarul) === */
	/* Vălul vine din clasa globală `fundal-modal` (app.css); aici doar stratul. */
	.ore-overlay { z-index: 60; }
	.ore-modal {
		position: fixed;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: min(560px, 100vw);
		max-height: 50vh;
		overflow: hidden;
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 35%),
			var(--surface);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
		border-bottom: none;
		border-radius: 22px 22px 0 0;
		box-shadow:
			0 1px 0 rgba(255,255,255,0.06) inset,
			0 -16px 40px -12px rgba(0,0,0,0.55);
		z-index: 61;
		animation: oreSheetIn 0.32s cubic-bezier(0.32, 1.4, 0.5, 1);
		display: flex;
		flex-direction: column;
		padding-bottom: env(safe-area-inset-bottom);
	}
	.ore-modal::before {
		content: '';
		display: block;
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: rgba(255,255,255,0.18);
		margin: 8px auto 0;
	}
	@keyframes oreSheetIn {
		from { transform: translate(-50%, 100%); }
		to   { transform: translate(-50%, 0); }
	}

	@media (min-width: 900px) {
		/* Pe desktop — card lateral dreapta, calendarul rămâne neacoperit */
		.ore-overlay { background: transparent; backdrop-filter: none; -webkit-backdrop-filter: none; }
		.ore-modal {
			left: auto;
			right: 24px;
			bottom: 24px;
			top: 50%;
			transform: translateY(-50%);
			width: 360px;
			max-height: min(80vh, 620px);
			border-radius: 22px;
			border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
			animation: oreCardIn 0.3s cubic-bezier(0.32, 1.4, 0.5, 1);
		}
		.ore-modal::before { display: none; }
		@keyframes oreCardIn {
			from { opacity: 0; transform: translate(20px, -50%); }
			to   { opacity: 1; transform: translate(0, -50%); }
		}
	}

	.ora-cell {
		background: var(--surface);
		border-color: var(--border);
		color: var(--text);
		font-feature-settings: 'tnum';
		line-height: 1;
	}
	.ora-cell:not(:disabled):hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		box-shadow: 0 4px 12px -6px color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.ora-cell:not(:disabled):active { transform: scale(0.96); }
	.ora-selectata {
		background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 75%, #6366f1)) !important;
		color: #fff !important;
		border-color: var(--accent) !important;
		box-shadow: 0 6px 18px -6px color-mix(in srgb, var(--accent) 70%, transparent);
	}
	.ora-ocupata {
		opacity: 0.4;
		text-decoration: line-through;
		background:
			repeating-linear-gradient(135deg, transparent 0 5px, rgba(255,255,255,0.04) 5px 6px),
			var(--surface);
	}
</style>
