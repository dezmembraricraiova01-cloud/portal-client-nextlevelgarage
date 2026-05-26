<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, type MasinaInchiriereDetaliu, type IntervalBlocat, type InchiriereForm, type ExtraOferit } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';

	let masina    = $state<MasinaInchiriereDetaliu | null>(null);
	let blocate   = $state<IntervalBlocat[]>([]);
	let extras    = $state<ExtraOferit[]>([]);
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

	let saving      = $state(false);
	let formError   = $state('');
	let formSuccess = $state(false);

	let masinaId = $derived(Number(page.params.id));

	let nrZile = $derived.by(() => {
		if (!dataStart || !dataEnd) return 0;
		const s = new Date(dataStart).getTime();
		const e = new Date(dataEnd).getTime();
		const z = Math.round((e - s) / 86_400_000);
		return z > 0 ? z : 0;
	});

	let costMasina = $derived(masina ? Math.round(nrZile * masina.tarif_zi * 100) / 100 : 0);

	let extraseAlese = $derived(extras.filter(e => selectedExtras[e.cod]));

	let costExtras = $derived(
		extraseAlese.reduce((sum, e) =>
			sum + (e.tip === 'per_zi' ? e.pret * nrZile : e.pret), 0)
	);

	let costEstimat = $derived(Math.round((costMasina + costExtras) * 100) / 100);

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

	const today = new Date().toISOString().slice(0, 10);
	const maxDate = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);

	async function load() {
		loading = true;
		loadError = '';
		try {
			const res = await api.inchiriereMasina(masinaId);
			masina  = res.masina;
			blocate = res.intervale_blocate;
			extras  = res.extras;

			// Pre-fill date din URL params (din listing) — sare la pasul Extras
			const params = new URLSearchParams(window.location.search);
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
			};
			await api.rezervaInchiriere(masinaId, data);
			formSuccess = true;
		} catch (e: any) {
			formError = e.message ?? 'Cererea nu a putut fi trimisă.';
			if (e.status === 409) load();
		} finally {
			saving = false;
		}
	}

	const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });

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

	onMount(load);
</script>

<div class="space-y-4 pb-32">
	<a href="/dashboard/inchirieri" class="inline-flex items-center gap-1.5 text-xs font-semibold"
		style="color: var(--muted); text-decoration: none;">← Înapoi la flotă</a>

	{#if loading}
		<Skeleton height="h-56" class="w-full" rounded="rounded-2xl" />
		<div class="space-y-2"><Skeleton height="h-6" class="w-48" /><Skeleton height="h-4" class="w-32" /></div>
	{:else if loadError}
		<div class="p-4 rounded-2xl text-sm" style="background: #ef444418; color: #ef4444; border: 1px solid #ef444440;">
			{loadError}
		</div>
	{:else if masina}
		<!-- Step indicator (4 pași: Vehicul ✓ · Date · Extras · Confirmă) -->
		<div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider overflow-x-auto">
			<span class="step-dot step-done">✓</span>
			<span style="color: var(--muted)" class="hidden sm:inline">Vehicul</span>
			<span class="flex-1 h-px min-w-[12px]" style="background: var(--border)"></span>

			<span class="step-dot {step === 1 ? 'step-active' : 'step-done'}">{step > 1 ? '✓' : '2'}</span>
			<span style="color: {step === 1 ? 'var(--text)' : 'var(--muted)'}">Date</span>
			<span class="flex-1 h-px min-w-[12px]" style="background: var(--border)"></span>

			<span class="step-dot {step === 2 ? 'step-active' : (step > 2 ? 'step-done' : 'step-pending')}">{step > 2 ? '✓' : '3'}</span>
			<span style="color: {step === 2 ? 'var(--text)' : 'var(--muted)'}">Extras</span>
			<span class="flex-1 h-px min-w-[12px]" style="background: var(--border)"></span>

			<span class="step-dot {step === 3 ? 'step-active' : 'step-pending'}">4</span>
			<span style="color: {step === 3 ? 'var(--text)' : 'var(--muted)'}">Confirmă</span>
		</div>

		{#if formSuccess}
			<div class="text-center py-12 px-4 rounded-2xl border"
				style="background: var(--surface); border-color: var(--border);">
				<div class="text-5xl mb-3">✅</div>
				<p class="font-bold text-lg" style="color: var(--text)">Cererea ta a fost trimisă</p>
				<p class="text-sm mt-1" style="color: var(--muted)">Te contactăm telefonic pentru confirmare.</p>
				<div class="flex gap-2 mt-5 justify-center">
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
			<div class="hero-stage rounded-2xl overflow-hidden border relative"
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
			</div>

			<!-- TARIF CARD — business-driven, lângă poză pe wide screens -->
			<div class="tarif-card relative overflow-hidden p-4 rounded-2xl flex flex-col"
				style="--ac: {theme.accent}; background: linear-gradient(135deg, color-mix(in srgb, {theme.accent} 22%, transparent) 0%, color-mix(in srgb, {theme.accent} 6%, transparent) 60%, transparent 100%), var(--surface); border: 1px solid color-mix(in srgb, {theme.accent} 38%, transparent);">
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
						<p class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--muted)">Tarif/zi · TVA inclus</p>
						<p class="font-bold leading-none mt-1" style="color: #34d399; text-shadow: 0 0 24px color-mix(in srgb, #10b981 40%, transparent);">
							<span class="text-4xl sm:text-5xl">{masina.tarif_zi.toFixed(0)}</span><span class="text-base font-normal ml-0.5" style="color: var(--muted)"> lei</span>
						</p>
						{#if masina.km_inclusi_zi}
							<p class="text-[11px] mt-1.5" style="color: var(--muted)">
								<span class="font-bold" style="color: {theme.accent};">{masina.km_inclusi_zi} km/zi</span> incluși{masina.tarif_km_extra > 0 ? ` · extra ${masina.tarif_km_extra.toFixed(2)} lei/km` : ''}
							</p>
						{/if}
					</div>
					<span class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-md inline-flex items-center gap-1"
						style="background: {theme.chipBg}; color: {theme.chip}; border: 1px solid {theme.chipBorder};">
						<span class="cat-dot" style="background: {theme.accent};"></span>
						{theme.name}
					</span>
				</div>

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

				<!-- Spacer pentru wide screens -->
				<div class="hidden lg:block flex-1"></div>

				<!-- CTA primary — apare doar pe wide screens (mobil are sticky footer) -->
				<button onclick={() => { if (step !== 1) step = 1; document.getElementById('ds')?.focus(); }}
					class="cta-btn cta-btn-hero hidden lg:inline-flex relative w-full justify-center mt-4">
					<span>Rezervă acum</span>
					<span class="cta-arrow">→</span>
				</button>
				<p class="hidden lg:block relative text-[10px] text-center mt-2" style="color: var(--muted)">
					⏱ Răspuns telefonic în 30 minute · 0 angajament
				</p>
			</div>
			</div><!-- /hero-grid -->

			<!-- Spec icon grid (full width sub hero) -->
			<div class="grid grid-cols-4 sm:grid-cols-8 gap-2" style="--ac: {theme.accent};">
				{#if masina.nr_locuri}
					<div class="spec-card">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
						<p class="spec-val">{masina.nr_locuri}</p>
						<p class="spec-lbl">Locuri</p>
					</div>
				{/if}
				{#if masina.nr_usi}
					<div class="spec-card">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16"/><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><circle cx="14" cy="13" r="1"/></svg>
						<p class="spec-val">{masina.nr_usi}</p>
						<p class="spec-lbl">Uși</p>
					</div>
				{/if}
				{#if masina.transmisie}
					<div class="spec-card">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
						<p class="spec-val">{masina.transmisie.toLowerCase().startsWith('aut') ? 'A' : (masina.transmisie.toLowerCase().startsWith('man') ? 'M' : masina.transmisie.charAt(0).toUpperCase())}</p>
						<p class="spec-lbl">{masina.transmisie}</p>
					</div>
				{/if}
				{#if masina.combustibil}
					<div class="spec-card">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2v0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>
						<p class="spec-val text-xs leading-tight">{masina.combustibil}</p>
						<p class="spec-lbl">Combustibil</p>
					</div>
				{/if}
				{#if masina.are_ac}
					<div class="spec-card">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>
						<p class="spec-val">AC</p>
						<p class="spec-lbl">Climă</p>
					</div>
				{/if}
				{#if masina.is_4wd}
					<div class="spec-card">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
						<p class="spec-val">4×4</p>
						<p class="spec-lbl">Tracțiune</p>
					</div>
				{/if}
				{#if masina.putere_cp}
					<div class="spec-card">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
						<p class="spec-val">{masina.putere_cp}</p>
						<p class="spec-lbl">CP</p>
					</div>
				{/if}
				{#if masina.km_inclusi_zi}
					<div class="spec-card">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
						<p class="spec-val">{masina.km_inclusi_zi}</p>
						<p class="spec-lbl">km/zi</p>
					</div>
				{/if}
			</div>

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

			<!-- Step content -->
			<div class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
				{#if step === 1}
					<h2 class="font-bold text-base" style="color: var(--text)">Alege intervalul</h2>
					<p class="text-xs" style="color: var(--muted)">Plata la ridicare. Te sunăm pentru confirmare.</p>

					<div class="grid grid-cols-2 gap-2">
						<div>
							<label for="ds" class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--muted)">De la</label>
							<input id="ds" type="date" bind:value={dataStart}
								min={today} max={maxDate} required
								class="w-full mt-1 text-sm px-3 py-2.5 rounded-xl"
								style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
						</div>
						<div>
							<label for="de" class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--muted)">Până la</label>
							<input id="de" type="date" bind:value={dataEnd}
								min={dataStart || today} max={maxDate} required
								class="w-full mt-1 text-sm px-3 py-2.5 rounded-xl"
								style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
						</div>
					</div>

					{#if intervalConflict}
						<div class="p-2.5 rounded-lg text-xs"
							style="background: #ef444418; color: #ef4444; border: 1px solid #ef444440;">
							Mașina este deja rezervată în acest interval. Alege alte date.
						</div>
					{/if}

					{#if blocate.length > 0}
						<details class="text-xs" style="color: var(--muted)">
							<summary class="cursor-pointer font-medium">Vezi intervale ocupate ({blocate.length})</summary>
							<ul class="mt-2 space-y-1 pl-3">
								{#each blocate as b}
									<li>· {fmtDate(b.from)} → {fmtDate(b.to)}</li>
								{/each}
							</ul>
						</details>
					{/if}
				{:else if step === 2}
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
						<div class="flex justify-between">
							<span style="color: var(--muted)">Perioadă</span>
							<span class="font-semibold" style="color: var(--text)">{fmtDate(dataStart)} → {fmtDate(dataEnd)}</span>
						</div>
						<div class="flex justify-between">
							<span style="color: var(--muted)">Închiriere</span>
							<span style="color: var(--text)">{nrZile} {nrZile === 1 ? 'zi' : 'zile'} × {masina.tarif_zi.toFixed(2)} = <strong>{costMasina.toFixed(2)} lei</strong></span>
						</div>
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

		<!-- Sticky bottom action bar -->
		{#if !formSuccess}
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
								{masina.tarif_zi.toFixed(0)} lei/zi
							</p>
							<p class="text-sm font-medium" style="color: var(--text)">Alege intervalul</p>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						{#if step === 1}
							<button onclick={() => step = 2} disabled={!canGoStep2}
								class="cta-btn"
								class:cta-disabled={!canGoStep2}>
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
	}
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

	.spec-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 12px 6px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text);
		text-align: center;
		gap: 2px;
		transition: border-color 0.25s ease, background 0.25s ease, transform 0.2s ease;
	}
	.spec-card:hover {
		transform: translateY(-1px);
		background: color-mix(in srgb, var(--ac) 6%, var(--surface));
		border-color: color-mix(in srgb, var(--ac) 35%, var(--border));
	}
	.spec-card svg { color: var(--ac, var(--accent)); margin-bottom: 4px; }
	.spec-val {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		line-height: 1.1;
	}
	.spec-lbl {
		font-size: 10px;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 600;
	}

	.sticky-action {
		position: fixed;
		left: 0; right: 0; bottom: 64px; /* deasupra bottom-nav-ului */
		z-index: 30;
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

	@media (min-width: 640px) {
		.sticky-action { bottom: 0; }
	}

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
