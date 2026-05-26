<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { page } from '$app/state';
	import { api, type TripResult, type OfferRequest, type TripRoadRequirement } from '$lib/api';

	const tripId = $derived(Number(page.params.id));

	let tripData  = $state<TripResult | null>(null);
	let offerReq  = $state<OfferRequest | null>(null);
	let loading   = $state(true);
	let error     = $state('');

	// Offer form
	let offerOpen   = $state(false);
	let selProducts = $state<{ country: string; type: string }[]>([]);
	let offerNote   = $state('');
	let offerSaving = $state(false);
	let offerError  = $state('');

	const TARI: Record<string, string> = {
		RO: 'România', MD: 'Moldova', HU: 'Ungaria', BG: 'Bulgaria',
		RS: 'Serbia', HR: 'Croația', SK: 'Slovacia', CZ: 'Cehia',
		AT: 'Austria', SI: 'Slovenia', DE: 'Germania', CH: 'Elveția',
		IT: 'Italia', FR: 'Franța', ES: 'Spania', PT: 'Portugalia',
		GR: 'Grecia', TR: 'Turcia', PL: 'Polonia', BE: 'Belgia',
		NL: 'Olanda', GB: 'Marea Britanie',
	};

	function flag(code: string): string {
		return [...code.toUpperCase()].map(c =>
			String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
		).join('');
	}

	function formatData(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function zilePanaLa(iso: string): number {
		return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
	}

	onMount(async () => {
		try {
			const [tripRes, offerRes] = await Promise.all([
				api.trip(tripId),
				api.offerRequest(tripId).catch(() => null),
			]);
			tripData = tripRes;
			offerReq = offerRes;

			// Pre-selectăm produsele obligatorii
			selProducts = tripRes.road_requirements
				.filter(r => r.obligatoriu)
				.map(r => ({ country: r.country, type: r.tip }));

			gsap.from('.section-card', { y: 12, opacity: 0, duration: 0.25, stagger: 0.07, ease: 'power2.out' });
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcarea călătoriei.';
		} finally {
			loading = false;
		}
	});

	// ── Helpers ───────────────────────────────────────────────────────────────

	function checkStyle(status: string) {
		if (status === 'ok')           return { color: '#22c55e', bg: '#22c55e12', icon: '✅' };
		if (status === 'critic')       return { color: '#ef4444', bg: '#ef444412', icon: '❌' };
		if (status === 'missing')      return { color: '#ef4444', bg: '#ef444412', icon: '⛔' };
		if (status === 'unknown_date') return { color: '#f59e0b', bg: '#f59e0b12', icon: '❓' };
		return                                { color: '#f59e0b', bg: '#f59e0b12', icon: '⚠️' }; // warning
	}

	function checkBadge(status: string): string {
		if (status === 'ok')           return 'OK';
		if (status === 'critic')       return 'Problemă';
		if (status === 'missing')      return 'Lipsă';
		if (status === 'unknown_date') return '? Dată';
		return 'Expiră';
	}

	// Grupăm road requirements pe țară
	const reqByCountry = $derived(
		(tripData?.road_requirements ?? []).reduce((map, r) => {
			const arr = map.get(r.country) ?? [];
			arr.push(r);
			map.set(r.country, arr);
			return map;
		}, new Map<string, TripRoadRequirement[]>())
	);

	// ── Offer form ────────────────────────────────────────────────────────────

	function sheetAction(node: HTMLElement) {
		gsap.fromTo(node, { y: '100%' }, { y: 0, duration: 0.38, ease: 'power3.out' });
	}

	function isSelProduct(country: string, type: string): boolean {
		return selProducts.some(p => p.country === country && p.type === type);
	}

	function toggleProduct(country: string, type: string) {
		if (isSelProduct(country, type)) {
			selProducts = selProducts.filter(p => !(p.country === country && p.type === type));
		} else {
			selProducts = [...selProducts, { country, type }];
		}
	}

	async function trimiteOferta() {
		if (!tripData || selProducts.length === 0) return;
		offerSaving = true; offerError = '';
		try {
			const res = await api.createOfferRequest(tripData.trip.id, {
				products: selProducts,
				note: offerNote.trim() || undefined,
			});
			offerReq  = res;
			offerOpen = false;
		} catch (e: any) {
			offerError = e.message ?? 'Eroare.';
		} finally {
			offerSaving = false;
		}
	}

	const offerStatusLabel: Record<string, string> = {
		created:     'Trimisă',
		in_progress: 'În procesare',
		finalizata:  'Finalizată',
		anulata:     'Anulată',
	};
	const offerStatusColor: Record<string, string> = {
		created:     '#3b82f6',
		in_progress: '#f59e0b',
		finalizata:  '#22c55e',
		anulata:     '#6b7280',
	};
</script>

<!-- ════════════════════════════════════════════════════════
     DETALIU TRIP
     ════════════════════════════════════════════════════════ -->
<div class="flex flex-col gap-4 pb-4">

	<!-- Header cu back -->
	<div class="flex items-center gap-3">
		<a href="/dashboard/trips"
			class="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
			style="background: var(--surface); border: 1px solid var(--border); color: var(--muted); text-decoration: none;">
			‹
		</a>
		<h1 class="text-xl font-bold" style="color: var(--text)">Detalii călătorie</h1>
	</div>

	{#if loading}
		<div class="space-y-3">
			{#each Array(4) as _}
				<div class="h-24 rounded-2xl border animate-pulse"
					style="background: var(--surface); border-color: var(--border);"></div>
			{/each}
		</div>

	{:else if error}
		<div class="text-center py-10" style="color: var(--muted)">
			<p class="text-3xl mb-2">⚠️</p>
			<p class="text-sm">{error}</p>
		</div>

	{:else if tripData}
		{@const trip = tripData.trip}
		{@const zileDepart = zilePanaLa(trip.departure_date)}
		{@const isOk = trip.status === 'ok'}

		<!-- ══ CARD TRIP ══ -->
		<div class="section-card rounded-2xl border px-4 py-4" style="background: var(--surface); border-color: var(--border);">
			<div class="flex items-start justify-between gap-3">
				<div class="flex-1 min-w-0">
					<!-- Ruta cu flags -->
					<p class="text-xl font-bold leading-tight" style="color: var(--text)">
						{flag('RO')}
						{#if trip.transit && trip.transit.length > 0}
							{#each trip.transit as c} → {flag(c)}{/each}
						{/if}
						→ {flag(trip.destination)}
					</p>
					<p class="text-sm mt-1" style="color: var(--muted)">
						{TARI['RO']}
						{#if trip.transit && trip.transit.length > 0}
							→ {trip.transit.map(c => TARI[c] ?? c).join(' → ')}
						{/if}
						→ {TARI[trip.destination] ?? trip.destination}
					</p>
					<p class="text-xs mt-2" style="color: var(--muted)">
						📅 {formatData(trip.departure_date)} — {formatData(trip.return_date)}
					</p>
					<p class="text-xs mt-0.5" style="color: var(--muted)">
						🚘 {trip.masina.numar_inmatriculare ?? '—'}
						{#if trip.masina.marca} · {trip.masina.marca} {trip.masina.model}{/if}
					</p>
				</div>
				<span class="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-xl"
					style="background: {isOk ? '#22c55e18' : '#f59e0b18'}; color: {isOk ? '#22c55e' : '#f59e0b'}">
					{isOk ? '✅ OK' : '⚠️ Atenție'}
				</span>
			</div>

			<!-- Zile până la plecare -->
			{#if zileDepart > 0}
				<div class="mt-3 pt-3 border-t" style="border-color: var(--border)">
					<p class="text-xs" style="color: var(--muted)">
						{#if zileDepart === 1}
							🚨 Pleci mâine!
						{:else if zileDepart <= 3}
							⚠️ Pleci în <strong style="color: #f59e0b">{zileDepart} zile</strong>
						{:else if zileDepart <= 10}
							🔔 Pleci în <strong>{zileDepart} zile</strong>
						{:else}
							📅 Pleci în {zileDepart} zile
						{/if}
					</p>
				</div>
			{:else if zileDepart === 0}
				<div class="mt-3 pt-3 border-t" style="border-color: var(--border)">
					<p class="text-xs font-semibold" style="color: #ef4444">🚨 Pleci azi!</p>
				</div>
			{/if}
		</div>

		<!-- ══ ALERTE PRE-PLECARE ══ -->
		{#if tripData.trip_alerts && tripData.trip_alerts.length > 0}
			<div class="section-card space-y-2">
				{#each tripData.trip_alerts as alert}
					<div class="flex items-start gap-3 px-4 py-3 rounded-2xl"
						style="background: #f59e0b10; border: 1px solid #f59e0b30;">
						<span class="text-base shrink-0">🔔</span>
						<p class="text-sm" style="color: var(--text)">{alert.mesaj}</p>
					</div>
				{/each}
			</div>
		{/if}

		<!-- ══ VERIFICARE DOCUMENTE ══ -->
		{#if tripData.checks && tripData.checks.length > 0}
			<div class="section-card">
				<p class="text-[10px] font-bold uppercase tracking-widest mb-2 px-1" style="color: var(--muted)">
					Verificare documente
				</p>
				<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border);">
					{#each tripData.checks as check, i}
						{@const cs = checkStyle(check.status)}
						<div class="flex items-center gap-3 px-4 py-3 {i > 0 ? 'border-t' : ''}"
							style="background: {cs.bg}; border-color: var(--border);">
							<span class="text-lg shrink-0">{cs.icon}</span>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium" style="color: var(--text)">{check.label}</p>
								{#if check.message}
									<p class="text-xs mt-0.5" style="color: {cs.color}">{check.message}</p>
								{:else if check.data_expirare}
									<p class="text-xs mt-0.5" style="color: var(--muted)">Expiră: {formatData(check.data_expirare)}</p>
								{/if}
								{#if check.has_conflict}
									<p class="text-xs mt-0.5" style="color: #f59e0b">
										⚡ WMS: {formatData(check.wms_date)} · Client: {formatData(check.client_date)}
									</p>
								{/if}
							</div>
							<span class="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
								style="background: {cs.bg}; color: {cs.color}; border: 1px solid {cs.color}40">
								{checkBadge(check.status)}
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ══ DE LUT CU TINE (checklist) ══ -->
		{#if tripData.checklist && tripData.checklist.length > 0}
			<div class="section-card">
				<p class="text-[10px] font-bold uppercase tracking-widest mb-2 px-1" style="color: var(--muted)">
					De luat cu tine
				</p>
				<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border);">
					{#each tripData.checklist as item, i}
						<div class="flex items-center gap-3 px-4 py-3 {i > 0 ? 'border-t' : ''}"
							style="background: var(--surface); border-color: var(--border);">
							<span class="text-base">📋</span>
							<p class="text-sm font-medium flex-1" style="color: var(--text)">{item.label}</p>
							{#if item.obligatoriu}
								<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
									style="background: #ef444412; color: #ef4444">Obligatoriu</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ══ TAXE DE DRUM ══ -->
		{#if reqByCountry.size > 0}
			<div class="section-card">
				<p class="text-[10px] font-bold uppercase tracking-widest mb-2 px-1" style="color: var(--muted)">
					Taxe de drum necesare
				</p>
				<div class="space-y-2">
					{#each [...reqByCountry.entries()] as [country, reqs]}
						<div class="rounded-2xl border px-4 py-3" style="background: var(--surface); border-color: var(--border);">
							<p class="text-sm font-semibold mb-2" style="color: var(--text)">
								{flag(country)} {TARI[country] ?? country}
							</p>
							<div class="flex flex-wrap gap-2">
								{#each reqs as req}
									<span class="text-xs px-2.5 py-1 rounded-full font-medium"
										style="background: {req.obligatoriu ? '#ef444412' : 'var(--surface2)'}; color: {req.obligatoriu ? '#ef4444' : 'var(--muted)'}; border: 1px solid {req.obligatoriu ? '#ef444430' : 'var(--border)'}">
										{req.label}{req.obligatoriu ? ' *' : ''}
									</span>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				<p class="text-[10px] mt-2 px-1" style="color: var(--muted)">* Obligatoriu conform legislației locale</p>
			</div>
		{/if}

		<!-- ══ OFERTĂ PRODUSE ══ -->
		{#if reqByCountry.size > 0}
			<div class="section-card">
				{#if offerReq}
					<!-- Cerere existentă -->
					<div class="rounded-2xl border px-4 py-4" style="background: var(--surface); border-color: var(--border);">
						<div class="flex items-center justify-between mb-3">
							<p class="text-sm font-bold" style="color: var(--text)">📦 Cerere ofertă trimisă</p>
							<span class="text-xs font-semibold px-2.5 py-1 rounded-full"
								style="background: {offerStatusColor[offerReq.status]}18; color: {offerStatusColor[offerReq.status]}">
								{offerStatusLabel[offerReq.status] ?? offerReq.status}
							</span>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each offerReq.products as p}
								<span class="text-xs px-2.5 py-1 rounded-full"
									style="background: var(--surface2); color: var(--text); border: 1px solid var(--border)">
									{flag(p.country)} {p.label}
								</span>
							{/each}
						</div>
						{#if offerReq.note}
							<p class="text-xs mt-2 italic" style="color: var(--muted)">{offerReq.note}</p>
						{/if}
						<p class="text-[11px] mt-3" style="color: var(--muted)">
							Trimisă pe {formatData(offerReq.created_at)}. Te vom contacta în curând.
						</p>
					</div>
				{:else}
					<!-- CTA ofertă -->
					<button onclick={() => offerOpen = true}
						class="w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all active:scale-[0.98]"
						style="background: var(--accent); color: white;">
						<div class="text-left">
							<p class="text-sm font-bold">📦 Cere ofertă produse</p>
							<p class="text-xs mt-0.5 opacity-80">Vignete, roviniete, taxe rutiere</p>
						</div>
						<span class="text-lg">→</span>
					</button>
				{/if}
			</div>
		{/if}

	{/if}
</div>

<!-- ════════════════════════════════════════════════════════
     FORM OFERTĂ
     ════════════════════════════════════════════════════════ -->
{#if offerOpen && tripData}
	<button class="fixed inset-0 z-40" style="background: rgba(0,0,0,0.6);"
		onclick={() => offerOpen = false} aria-label="Închide"></button>

	<div use:sheetAction
		class="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
		style="background: var(--surface); max-height: 90vh; overflow-y: auto; border-top: 1px solid var(--border);">

		<div class="sticky top-0 z-10 px-4 pt-3 pb-4" style="background: var(--surface);">
			<div class="w-10 h-1 rounded-full mx-auto mb-4" style="background: var(--border);"></div>
			<div class="flex items-center justify-between">
				<h2 class="text-base font-bold" style="color: var(--text)">Selectează produse</h2>
				<button onclick={() => offerOpen = false}
					class="w-8 h-8 rounded-full flex items-center justify-center text-lg"
					style="background: var(--surface2); color: var(--muted);">×</button>
			</div>
		</div>

		<div class="px-4 pb-8 space-y-4">
			<p class="text-sm" style="color: var(--muted)">
				Alege ce produse dorești să includem în ofertă pentru acest traseu.
			</p>

			<!-- Produse per țară -->
			{#each [...reqByCountry.entries()] as [country, reqs]}
				<div>
					<p class="text-xs font-bold mb-2" style="color: var(--muted)">
						{flag(country)} {TARI[country] ?? country}
					</p>
					<div class="space-y-2">
						{#each reqs as req}
							{@const sel = isSelProduct(req.country, req.tip)}
							<button onclick={() => toggleProduct(req.country, req.tip)}
								class="w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all active:scale-[0.98]"
								style="
									background: {sel ? '#3b82f618' : 'var(--surface2)'};
									border-color: {sel ? '#3b82f6' : 'var(--border)'};
								">
								<span class="text-lg">{sel ? '☑️' : '☐'}</span>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium" style="color: var(--text)">{req.label}</p>
									{#if req.obligatoriu}
										<p class="text-[11px]" style="color: #ef4444">Obligatoriu</p>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/each}

			<!-- Notă opțională -->
			<div>
				<label for="offer-note" class="text-xs font-bold uppercase tracking-widest mb-2 block" style="color: var(--muted)">
					Notă <span class="font-normal normal-case tracking-normal">(opțional)</span>
				</label>
				<textarea id="offer-note" bind:value={offerNote} rows="2"
					placeholder="Ex: Doresc ofertă și pentru rovinieta anuală..."
					class="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
					style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);"></textarea>
			</div>

			{#if offerError}
				<p class="text-xs" style="color: #ef4444">{offerError}</p>
			{/if}

			<button
				onclick={trimiteOferta}
				disabled={selProducts.length === 0 || offerSaving}
				class="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
				style="background: var(--accent); color: white;">
				{offerSaving ? 'Se trimite...' : `Trimite cererea (${selProducts.length} produse)`}
			</button>
		</div>
	</div>
{/if}
