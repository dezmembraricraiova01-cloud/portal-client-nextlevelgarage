<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { gsap } from 'gsap';
	import { api, type TripResult, type Masina } from '$lib/api';

	let trips   = $state<TripResult[]>([]);
	let masine  = $state<Masina[]>([]);
	let loading = $state(true);
	let error   = $state('');

	// ── Form ──────────────────────────────────────────────────────────────────
	let formOpen  = $state(false);
	let formStep  = $state<'masina' | 'ruta' | 'date'>('masina');
	let saving    = $state(false);
	let saveError = $state('');

	let selMasina  = $state<Masina | null>(null);
	let selDest    = $state('');
	let selTransit = $state<string[]>([]);
	let selDepart  = $state('');
	let selReturn  = $state('');

	const AZI = new Date().toISOString().split('T')[0];

	const TARI_LIST = [
		{ code: 'RO', name: 'România' },   { code: 'MD', name: 'Moldova' },
		{ code: 'HU', name: 'Ungaria' },   { code: 'BG', name: 'Bulgaria' },
		{ code: 'RS', name: 'Serbia' },    { code: 'HR', name: 'Croația' },
		{ code: 'SK', name: 'Slovacia' },  { code: 'CZ', name: 'Cehia' },
		{ code: 'AT', name: 'Austria' },   { code: 'SI', name: 'Slovenia' },
		{ code: 'DE', name: 'Germania' },  { code: 'CH', name: 'Elveția' },
		{ code: 'IT', name: 'Italia' },    { code: 'FR', name: 'Franța' },
		{ code: 'ES', name: 'Spania' },    { code: 'PT', name: 'Portugalia' },
		{ code: 'GR', name: 'Grecia' },    { code: 'TR', name: 'Turcia' },
		{ code: 'PL', name: 'Polonia' },   { code: 'BE', name: 'Belgia' },
		{ code: 'NL', name: 'Olanda' },    { code: 'GB', name: 'Marea Britanie' },
	];

	const TARI: Record<string, string> = Object.fromEntries(TARI_LIST.map(t => [t.code, t.name]));

	function flag(code: string): string {
		return [...code.toUpperCase()].map(c =>
			String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
		).join('');
	}

	function ruta(t: TripResult): string {
		const tari = [t.trip.destination, ...(t.trip.transit ?? [])];
		return tari.map(flag).join(' → ');
	}

	function formatData(iso: string): string {
		return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
	}

	onMount(async () => {
		try {
			const [tripsRes, masineRes] = await Promise.all([
				api.trips().catch(() => [] as TripResult[]),
				api.masini().catch(() => [] as Masina[]),
			]);
			trips  = tripsRes;
			masine = masineRes;
			await tick();
			if (trips.length > 0) {
				gsap.from('.trip-card', { y: 16, opacity: 0, duration: 0.28, stagger: 0.06, ease: 'power2.out' });
			}
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcare.';
		} finally {
			loading = false;
		}
	});

	// ── Form logic ────────────────────────────────────────────────────────────

	function sheetAction(node: HTMLElement) {
		gsap.fromTo(node, { y: '100%' }, { y: 0, duration: 0.38, ease: 'power3.out' });
	}

	function deschideForm() {
		saveError = ''; selDest = ''; selTransit = []; selDepart = ''; selReturn = '';
		selMasina = masine.length === 1 ? masine[0] : null;
		formStep  = selMasina ? 'ruta' : 'masina';
		formOpen  = true;
	}

	function selectMasina(m: Masina) {
		selMasina = m; formStep = 'ruta';
	}

	function toggleTransit(code: string) {
		if (code === selDest) return;
		selTransit = selTransit.includes(code)
			? selTransit.filter(c => c !== code)
			: [...selTransit, code];
	}

	const canGoToDate = $derived(selDest.length === 2);
	const canSubmit   = $derived(selMasina !== null && selDest !== '' && selDepart !== '' && selReturn !== '');

	const minReturn = $derived(
		selDepart
			? new Date(new Date(selDepart).getTime() + 86_400_000).toISOString().split('T')[0]
			: AZI
	);

	$effect(() => {
		if (selReturn && selDepart && selReturn <= selDepart) selReturn = '';
	});

	async function salveaza() {
		if (!canSubmit || !selMasina) return;
		saving = true; saveError = '';
		try {
			const res = await api.createTrip({
				masina_id:      selMasina.id,
				destination:    selDest,
				transit:        selTransit.length > 0 ? selTransit : undefined,
				departure_date: selDepart,
				return_date:    selReturn,
			});
			trips = [res, ...trips];
			formOpen = false;
			await tick();
			gsap.from('.trip-card:first-child', { y: -12, opacity: 0, duration: 0.3, ease: 'power2.out' });
		} catch (e: any) {
			saveError = e.message ?? 'Eroare la salvare.';
		} finally {
			saving = false;
		}
	}
</script>

<!-- ════════════════════════════════════════════════════════
     LISTA TRIPS
     ════════════════════════════════════════════════════════ -->
<div class="flex flex-col gap-5 pb-4">

	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold" style="color: var(--text)">Călătorii</h1>
		{#if !loading && masine.length > 0}
			<button onclick={deschideForm}
				class="text-sm px-4 py-2 rounded-xl font-semibold"
				style="background: var(--accent); color: white;">+ Nouă</button>
		{/if}
	</div>

	{#if loading}
		<div class="space-y-3">
			{#each Array(3) as _}
				<div class="h-20 rounded-2xl border animate-pulse"
					style="background: var(--surface); border-color: var(--border);"></div>
			{/each}
		</div>

	{:else if error}
		<p class="text-sm text-center py-6" style="color: #ef4444">{error}</p>

	{:else if trips.length === 0}
		<div class="text-center py-12" style="color: var(--muted)">
			<p class="text-4xl mb-3">🗺️</p>
			<p class="text-sm font-medium mb-1" style="color: var(--text)">Nicio călătorie planificată</p>
			<p class="text-xs mb-4">Adaugă o călătorie pentru a verifica documentele necesare.</p>
			{#if masine.length > 0}
				<button onclick={deschideForm}
					class="text-sm px-5 py-2.5 rounded-xl font-semibold"
					style="background: var(--accent); color: white;">
					Planifică prima călătorie
				</button>
			{/if}
		</div>

	{:else}
		<div class="space-y-3">
			{#each trips as t (t.trip.id)}
				{@const isOk = t.trip.status === 'ok'}
				<a href="/dashboard/trips/{t.trip.id}"
					class="trip-card flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-opacity active:opacity-70"
					style="background: var(--surface); border-color: var(--border); text-decoration: none;">

					<!-- Ruta cu flag-uri -->
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap">
							<p class="text-base font-semibold" style="color: var(--text)">{ruta(t)}</p>
							<span class="text-xs font-semibold px-2 py-0.5 rounded-full"
								style="background: {isOk ? '#22c55e18' : '#f59e0b18'}; color: {isOk ? '#22c55e' : '#f59e0b'}">
								{isOk ? 'Documente OK' : 'Atenție'}
							</span>
						</div>
						<p class="text-xs mt-1" style="color: var(--muted)">
							📅 {formatData(t.trip.departure_date)} — {formatData(t.trip.return_date)}
							· 🚘 {t.trip.masina.numar_inmatriculare ?? '—'}
						</p>
						{#if t.trip.transit && t.trip.transit.length > 0}
							<p class="text-xs mt-0.5" style="color: var(--muted)">
								Tranzit: {t.trip.transit.map(c => TARI[c] ?? c).join(', ')}
							</p>
						{/if}
					</div>

					<span style="color: var(--muted)">›</span>
				</a>
			{/each}
		</div>
	{/if}

</div>

<!-- ════════════════════════════════════════════════════════
     FORM CREARE TRIP
     ════════════════════════════════════════════════════════ -->
{#if formOpen}
	<button class="fixed inset-0 z-40" style="background: rgba(0,0,0,0.6);"
		onclick={() => formOpen = false} aria-label="Închide"></button>

	<div use:sheetAction
		class="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
		style="background: var(--surface); max-height: 90vh; overflow-y: auto; border-top: 1px solid var(--border);">

		<!-- Handle + header -->
		<div class="sticky top-0 z-10 px-4 pt-3 pb-4" style="background: var(--surface);">
			<div class="w-10 h-1 rounded-full mx-auto mb-4" style="background: var(--border);"></div>
			<div class="flex items-center justify-between">
				<div>
					{#if formStep !== 'masina' && (masine.length > 1 || formStep === 'date')}
						<button onclick={() => formStep = formStep === 'date' ? 'ruta' : 'masina'}
							class="text-xs mb-1 flex items-center gap-1" style="color: var(--muted);">
							← Înapoi
						</button>
					{/if}
					<h2 class="text-base font-bold" style="color: var(--text)">
						{#if formStep === 'masina'}Selectează mașina
						{:else if formStep === 'ruta'}Destinație și traseu
						{:else}Date călătorie
						{/if}
					</h2>
				</div>
				<button onclick={() => formOpen = false}
					class="w-8 h-8 rounded-full flex items-center justify-center text-lg"
					style="background: var(--surface2); color: var(--muted);">×</button>
			</div>
		</div>

		<div class="px-4 pb-8 space-y-4">

			<!-- STEP 1: Mașină -->
			{#if formStep === 'masina'}
				<p class="text-sm" style="color: var(--muted)">Pe care mașină călătorești?</p>
				<div class="space-y-2">
					{#each masine as m}
						<button onclick={() => selectMasina(m)}
							class="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition-all active:scale-[0.98]"
							style="background: var(--surface2); border-color: var(--border);">
							<span class="text-2xl">🚘</span>
							<div>
								<p class="text-sm font-semibold" style="color: var(--text)">{m.marca} {m.model}{m.an ? ` (${m.an})` : ''}</p>
								<p class="text-xs font-mono" style="color: var(--muted)">{m.numar_inmatriculare}</p>
							</div>
							<span class="ml-auto" style="color: var(--muted)">→</span>
						</button>
					{/each}
				</div>

			<!-- STEP 2: Ruta -->
			{:else if formStep === 'ruta'}
				<!-- Destinație -->
				<div>
					<label class="text-xs font-bold uppercase tracking-widest mb-2 block" style="color: var(--muted)">
						Destinație
					</label>
					<select bind:value={selDest}
						class="w-full px-3 py-3 rounded-xl text-sm outline-none"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);">
						<option value="">Alege țara de destinație...</option>
						{#each TARI_LIST as t}
							<option value={t.code}>{flag(t.code)} {t.name}</option>
						{/each}
					</select>
				</div>

				<!-- Transit -->
				<div>
					<label class="text-xs font-bold uppercase tracking-widest mb-2 block" style="color: var(--muted)">
						Tranzit <span class="font-normal normal-case tracking-normal">(opțional)</span>
					</label>
					<div class="flex flex-wrap gap-2">
						{#each TARI_LIST as t}
							{@const sel = selTransit.includes(t.code)}
							{@const isDest = t.code === selDest}
							<button
								onclick={() => toggleTransit(t.code)}
								disabled={isDest}
								class="text-xs px-2.5 py-1.5 rounded-full border transition-all disabled:opacity-30"
								style="
									background: {sel ? 'var(--accent)' : 'var(--surface2)'};
									border-color: {sel ? 'var(--accent)' : 'var(--border)'};
									color: {sel ? 'white' : 'var(--text)'};
								">
								{flag(t.code)} {t.name}
							</button>
						{/each}
					</div>
				</div>

				{#if selDest}
					<div class="p-3 rounded-xl text-xs" style="background: var(--surface2); color: var(--muted)">
						Traseu: 🇷🇴 România → {selTransit.map(c => `${flag(c)} ${TARI[c] ?? c}`).join(' → ')}{selTransit.length > 0 ? ' → ' : ''}{flag(selDest)} {TARI[selDest] ?? selDest}
					</div>
				{/if}

				<button
					onclick={() => formStep = 'date'}
					disabled={!canGoToDate}
					class="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
					style="background: var(--accent); color: white;">
					Următor →
				</button>

			<!-- STEP 3: Date -->
			{:else}
				<div>
					<label for="dep-date" class="text-xs font-bold uppercase tracking-widest mb-2 block" style="color: var(--muted)">
						Data plecării
					</label>
					<input id="dep-date" type="date" bind:value={selDepart} min={AZI}
						class="w-full px-3 py-3 rounded-xl text-sm outline-none"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
				</div>
				<div>
					<label for="ret-date" class="text-xs font-bold uppercase tracking-widest mb-2 block" style="color: var(--muted)">
						Data întoarcerii
					</label>
					<input id="ret-date" type="date" bind:value={selReturn} min={minReturn}
						class="w-full px-3 py-3 rounded-xl text-sm outline-none"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
				</div>

				{#if saveError}
					<p class="text-xs" style="color: #ef4444">{saveError}</p>
				{/if}

				<button
					onclick={salveaza}
					disabled={!canSubmit || saving}
					class="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
					style="background: var(--accent); color: white;">
					{saving ? 'Se verifică...' : '🗺️ Verifică documetele'}
				</button>

				<p class="text-[11px] text-center" style="color: var(--muted)">
					Vom verifica automat RCA, ITP, Carte Verde și permisul față de data întoarcerii.
				</p>
			{/if}

		</div>
	</div>
{/if}
