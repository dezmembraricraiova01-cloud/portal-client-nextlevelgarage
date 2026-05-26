<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type MasinaInchiriereCard } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';

	let masini       = $state<MasinaInchiriereCard[]>([]);
	let loading      = $state(true);
	let error        = $state('');
	let q            = $state('');
	let combust      = $state('');

	// Date selection (înainte de a alege mașina)
	let dataStart    = $state('');
	let dataEnd      = $state('');
	let intervalInfo = $state<{ from: string; to: string; zile: number } | null>(null);

	const today   = new Date().toISOString().slice(0, 10);
	const maxDate = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);

	let nrZile = $derived.by(() => {
		if (!dataStart || !dataEnd) return 0;
		const s = new Date(dataStart).getTime();
		const e = new Date(dataEnd).getTime();
		const z = Math.round((e - s) / 86_400_000);
		return z > 0 ? z : 0;
	});

	let intervalValid = $derived(!!dataStart && !!dataEnd && nrZile > 0);

	let combustibili = $derived(
		Array.from(new Set(masini.map(m => m.combustibil).filter(Boolean) as string[]))
	);

	let masiniFiltrate = $derived(
		masini
			.filter(m => {
				if (q) {
					const t = q.toLowerCase();
					if (!`${m.marca} ${m.model}`.toLowerCase().includes(t)) return false;
				}
				if (combust && m.combustibil !== combust) return false;
				return true;
			})
			// disponibilele primele când avem interval
			.sort((a, b) => {
				if (!intervalValid) return 0;
				const da = a.disponibila_interval === false ? 1 : 0;
				const db = b.disponibila_interval === false ? 1 : 0;
				return da - db;
			})
	);

	async function loadFlota() {
		loading = true;
		error = '';
		try {
			const res = await api.inchirieriFlota(
				intervalValid ? { from: dataStart, to: dataEnd } : undefined
			);
			masini = res.masini;
			intervalInfo = res.interval;
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcarea flotei.';
		} finally {
			loading = false;
		}
	}

	// Refetch când se schimbă datele și sunt valide
	let refetchTimer: number | null = null;
	$effect(() => {
		if (!intervalValid) return;
		if (refetchTimer) clearTimeout(refetchTimer);
		refetchTimer = setTimeout(() => loadFlota(), 250) as unknown as number;
	});

	// URL pentru cardul mașinii — include datele dacă au fost alese
	function carUrl(id: number): string {
		if (!intervalValid) return `/dashboard/inchirieri/${id}`;
		return `/dashboard/inchirieri/${id}?from=${dataStart}&to=${dataEnd}`;
	}

	// Theming inteligent pe categorie — accent + gradient placeholder
	function tier(categoria: string): { accent: string; bg1: string; bg2: string; chip: string; chipBg: string; chipBorder: string } {
		const c = categoria.toUpperCase();
		if (c.includes('PREMIUM') || c.includes('LUX'))    return { accent: '#eab308', bg1: '#3b2f0a', bg2: '#1a1505', chip: '#fde68a', chipBg: '#eab30822', chipBorder: '#eab30855' };
		if (c.includes('UTILITAR') || c.includes('VAN'))   return { accent: '#f97316', bg1: '#3a1d08', bg2: '#1a0e04', chip: '#fed7aa', chipBg: '#f9731622', chipBorder: '#f9731655' };
		if (c.includes('SUV') || c.includes('CROSSOVER')) return { accent: '#10b981', bg1: '#072e23', bg2: '#04150f', chip: '#a7f3d0', chipBg: '#10b98122', chipBorder: '#10b98155' };
		if (c.includes('COMPACT'))                         return { accent: '#06b6d4', bg1: '#062e36', bg2: '#03161a', chip: '#a5f3fc', chipBg: '#06b6d422', chipBorder: '#06b6d455' };
		if (c.includes('ECONOMIC'))                        return { accent: '#3b82f6', bg1: '#0a2240', bg2: '#04101e', chip: '#bfdbfe', chipBg: '#3b82f622', chipBorder: '#3b82f655' };
		return                                                   { accent: '#8b5cf6', bg1: '#1f1142', bg2: '#0d0721', chip: '#ddd6fe', chipBg: '#8b5cf622', chipBorder: '#8b5cf655' };
	}

	function transmisieCode(t: string | null): string {
		if (!t) return '';
		const tx = t.toLowerCase();
		if (tx.startsWith('aut')) return 'A';
		if (tx.startsWith('man')) return 'M';
		return t.charAt(0).toUpperCase();
	}

	function combustibilEmoji(c: string | null): string {
		if (!c) return '⛽';
		const cl = c.toLowerCase();
		if (cl.includes('elect')) return '⚡';
		if (cl.includes('hibrid') || cl.includes('hybrid')) return '🔋';
		if (cl.includes('diesel')) return '🛢️';
		if (cl.includes('benz') || cl.includes('petrol')) return '⛽';
		if (cl.includes('gpl')) return '💨';
		return '⛽';
	}

	onMount(loadFlota);
</script>

<div class="space-y-4 pb-4">
	<!-- Header -->
	<div class="space-y-3">
		<div class="flex items-center justify-between gap-3">
			<a href="/dashboard" class="text-xs font-semibold inline-flex items-center gap-1"
				style="color: var(--muted); text-decoration: none;">← Acasă</a>
			<a href="/dashboard/inchirieri/cererile-mele"
				class="text-xs font-semibold px-3 py-1.5 rounded-full"
				style="background: var(--surface2); color: var(--text); border: 1px solid var(--border); text-decoration: none;">
				Cererile mele →
			</a>
		</div>

		<!-- Step indicator: Date → Vehicul → Confirmă -->
		<div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
			<span class="step-dot {intervalValid ? 'step-done' : 'step-active'}">{intervalValid ? '✓' : '1'}</span>
			<span style="color: var(--text)">Date</span>
			<span class="flex-1 h-px" style="background: var(--border)"></span>
			<span class="step-dot {intervalValid ? 'step-active' : 'step-pending'}">2</span>
			<span style="color: {intervalValid ? 'var(--text)' : 'var(--muted)'}">Vehicul</span>
			<span class="flex-1 h-px" style="background: var(--border)"></span>
			<span class="step-dot step-pending">3</span>
			<span style="color: var(--muted)">Confirmă</span>
		</div>

		<div>
			<h1 class="text-2xl font-bold tracking-tight" style="color: var(--text)">
				{intervalValid ? 'Alege mașina' : 'Alege intervalul'}
			</h1>
			<p class="text-xs mt-0.5" style="color: var(--muted)">
				{#if intervalValid}
					{nrZile} {nrZile === 1 ? 'zi' : 'zile'} · {masini.filter(m => m.disponibila_interval !== false).length} disponibile · plata la ridicare
				{:else}
					Selectează datele ca să vezi ce mașini sunt libere · plata la ridicare
				{/if}
			</p>
		</div>
	</div>

	<!-- DATE PICKER prominent — pas 1 înainte de a alege mașina -->
	<div class="date-card relative overflow-hidden p-4 rounded-2xl"
		style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, transparent) 0%, color-mix(in srgb, var(--accent) 4%, transparent) 60%, var(--surface) 100%); border: 1px solid color-mix(in srgb, var(--accent) {intervalValid ? '50%' : '35%'}, var(--border));">
		<div class="flex items-center gap-2 mb-3">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
			<p class="text-sm font-bold" style="color: var(--text)">Când ai nevoie de mașină?</p>
			{#if intervalValid}
				<span class="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md"
					style="background: #10b98122; color: #10b981; border: 1px solid #10b98140;">
					✓ {nrZile} {nrZile === 1 ? 'zi' : 'zile'}
				</span>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-2">
			<div>
				<label for="ds" class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--muted)">Ridicare</label>
				<input id="ds" type="date" bind:value={dataStart}
					min={today} max={maxDate}
					class="w-full mt-1 text-sm px-3 py-2.5 rounded-xl"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);" />
			</div>
			<div>
				<label for="de" class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--muted)">Returnare</label>
				<input id="de" type="date" bind:value={dataEnd}
					min={dataStart || today} max={maxDate}
					class="w-full mt-1 text-sm px-3 py-2.5 rounded-xl"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);" />
			</div>
		</div>

		{#if !intervalValid}
			<p class="text-[11px] mt-2 leading-snug" style="color: var(--muted)">
				💡 Alege datele ca să filtrezi mașinile libere și să blochezi prețul vizibil acum.
			</p>
		{/if}
	</div>

	<!-- Filters -->
	{#if !loading && masini.length > 0}
		<div class="flex flex-wrap items-center gap-2">
			<input bind:value={q}
				placeholder="Caută marcă / model..."
				class="flex-1 min-w-[180px] text-sm px-3 py-2 rounded-xl"
				style="background: var(--surface); border: 1px solid var(--border); color: var(--text);" />
			{#if combustibili.length > 1}
				<select bind:value={combust}
					class="text-sm px-3 py-2 rounded-xl"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);">
					<option value="">Orice combustibil</option>
					{#each combustibili as c}
						<option value={c}>{c}</option>
					{/each}
				</select>
			{/if}
		</div>
	{/if}

	{#if loading}
		<div class="grid grid-cols-2 gap-3">
			{#each Array(4) as _}
				<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border);">
					<Skeleton height="h-32" class="w-full" rounded="rounded-none" />
					<div class="p-3 space-y-2" style="background: var(--surface);">
						<Skeleton height="h-3" class="w-16" />
						<Skeleton height="h-4" class="w-24" />
						<Skeleton height="h-3" class="w-20" />
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="p-4 rounded-2xl text-sm" style="background: #ef444418; color: #ef4444; border: 1px solid #ef444440;">
			{error}
		</div>
	{:else if masini.length === 0}
		<div class="text-center py-12 px-4 rounded-2xl border"
			style="background: var(--surface); border-color: var(--border);">
			<div class="text-4xl mb-2">🚙</div>
			<p class="font-semibold" style="color: var(--text)">Nicio mașină disponibilă acum</p>
			<p class="text-xs mt-1" style="color: var(--muted)">Reîncearcă mai târziu sau întreabă pe chat.</p>
			<a href="/dashboard/chat" class="inline-block mt-4 text-xs font-semibold px-4 py-2 rounded-xl"
				style="background: var(--accent); color: white; text-decoration: none;">
				Întreabă pe chat →
			</a>
		</div>
	{:else if masiniFiltrate.length === 0}
		<div class="text-center py-8 px-4 rounded-2xl border"
			style="background: var(--surface); border-color: var(--border);">
			<p class="text-sm" style="color: var(--muted)">Niciun rezultat pentru filtrele selectate.</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
			{#each masiniFiltrate as m, i (m.id)}
				{@const t = tier(m.categoria)}
				{@const indisponibila = m.disponibila_interval === false}
				<a href={indisponibila ? '#' : carUrl(m.id)}
					onclick={(ev) => { if (indisponibila) ev.preventDefault(); }}
					aria-disabled={indisponibila}
					class="car-card group relative block rounded-2xl overflow-hidden"
					class:car-card-disabled={indisponibila}
					style="--ac: {t.accent}; animation-delay: {i * 50}ms;">

					<!-- Photo zone (4:3 aspect) -->
					<div class="relative aspect-[4/3] overflow-hidden"
						style="background: linear-gradient(135deg, {t.bg1} 0%, {t.bg2} 100%);">
						{#if m.foto_url}
							<img src={m.foto_url} alt="{m.marca} {m.model}"
								class="absolute inset-0 w-full h-full object-cover"
								style="transition: transform 0.5s ease;" />
							<!-- Gradient bottom overlay -->
							<div class="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
								style="background: linear-gradient(180deg, transparent 0%, rgba(13,13,34,0.85) 100%);"></div>
						{:else}
							<!-- Placeholder elegant -->
							<div class="absolute inset-0 flex items-center justify-center">
								<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={t.accent} stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.45;">
									<path d="M5 17h14M3 17l1.4-7.5a2 2 0 0 1 2-1.5h11.2a2 2 0 0 1 2 1.5L21 17"/>
									<circle cx="7" cy="17" r="2"/>
									<circle cx="17" cy="17" r="2"/>
								</svg>
							</div>
							<!-- Animated aurora pe placeholder -->
							<div class="placeholder-aurora absolute inset-0 pointer-events-none"
								style="background: radial-gradient(60% 50% at 30% 40%, {t.accent}26 0%, transparent 60%);"></div>
						{/if}

						<!-- Top-left: categoria badge color-coded -->
						<div class="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
							<span class="cat-badge text-[9px] font-bold tracking-wider px-2 py-1 rounded-md uppercase"
								style="background: {t.chipBg}; color: {t.chip}; border: 1px solid {t.chipBorder}; backdrop-filter: blur(8px); letter-spacing: 0.06em;">
								{m.categoria}
							</span>

							{#if m.rezervari_azi > 0}
								<span class="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
									style="background: rgba(239,68,68,0.95); color: #fff; backdrop-filter: blur(6px);">
									<span class="dot-pulse"></span>{m.rezervari_azi}×
								</span>
							{/if}
						</div>

						<!-- Bottom: marca + model overlay (numai dacă există poza) -->
						{#if m.foto_url}
							<div class="absolute left-3 right-3 bottom-2.5">
								<p class="font-bold text-[15px] leading-tight truncate" style="color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.6);">
									{m.marca}
								</p>
								<p class="text-[11px] font-medium leading-tight truncate" style="color: rgba(255,255,255,0.85); text-shadow: 0 1px 4px rgba(0,0,0,0.6);">
									{m.model}{m.an ? ` · ${m.an}` : ''}
								</p>
							</div>
						{/if}
					</div>

					<!-- Body content -->
					<div class="p-3 space-y-2" style="background: var(--surface);">
						<!-- Identitate când nu e poză -->
						{#if !m.foto_url}
							<div>
								<p class="font-bold text-sm leading-tight truncate" style="color: var(--text)">{m.marca}</p>
								<p class="text-[11px] truncate" style="color: var(--muted)">{m.model}{m.an ? ` · ${m.an}` : ''}</p>
							</div>
						{/if}

						<!-- Spec row -->
						<div class="flex items-center gap-1.5 flex-wrap">
							{#if m.nr_locuri}
								<span class="spec-pill" title="Locuri">
									<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
									{m.nr_locuri}
								</span>
							{/if}
							{#if m.nr_usi}
								<span class="spec-pill" title="Uși">
									<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16"/><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/></svg>
									{m.nr_usi}
								</span>
							{/if}
							{#if m.transmisie}
								<span class="spec-pill" title={m.transmisie}>{transmisieCode(m.transmisie)}</span>
							{/if}
							{#if m.combustibil}
								<span class="spec-pill" title={m.combustibil}>{combustibilEmoji(m.combustibil)}</span>
							{/if}
							{#if m.are_ac}
								<span class="spec-pill" title="AC">AC</span>
							{/if}
							{#if m.is_4wd}
								<span class="spec-pill" title="4×4">4×4</span>
							{/if}
							{#if m.putere_cp}
								<span class="spec-pill" title="Putere">{m.putere_cp} CP</span>
							{/if}
						</div>

						<!-- Price + CTA -->
						<div class="flex items-end justify-between gap-2 pt-1">
							<div class="min-w-0">
								{#if m.tarif_zi > 0}
									<p class="text-[9px] font-semibold uppercase tracking-wider leading-none" style="color: var(--muted)">de la</p>
									<p class="font-bold leading-tight" style="color: var(--text)">
										<span class="text-lg">{m.tarif_zi.toFixed(0)}</span><span class="text-[10px] font-normal" style="color: var(--muted)"> lei/zi</span>
									</p>
									{#if m.km_inclusi_zi}
										<p class="text-[9px] leading-tight mt-0.5" style="color: var(--muted)">{m.km_inclusi_zi} km/zi incluși</p>
									{/if}
								{:else}
									<p class="text-[10px] font-semibold uppercase tracking-wider leading-none" style="color: var(--muted)">tarif</p>
									<p class="text-sm font-bold leading-tight" style="color: var(--text)">la cerere</p>
									<p class="text-[9px] leading-tight mt-0.5" style="color: var(--muted)">te sunăm pentru ofertă</p>
								{/if}
							</div>
							<span class="select-cta shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
								style="background: {t.accent}; color: #0b0b1a;">
								Alege<span class="select-arrow">→</span>
							</span>
						</div>
					</div>

					<!-- Glow ring on hover (color-coded) -->
					<span class="card-ring absolute inset-0 rounded-2xl pointer-events-none"></span>

					{#if indisponibila}
						<div class="absolute inset-0 z-40 rounded-2xl flex items-center justify-center pointer-events-none"
							style="background: rgba(13,13,34,0.78); backdrop-filter: blur(2px);">
							<div class="text-center">
								<span class="inline-block text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md uppercase"
									style="background: #ef444422; color: #fca5a5; border: 1px solid #ef444455;">
									Indisponibilă
								</span>
								<p class="text-[10px] mt-1.5 px-2" style="color: rgba(255,255,255,0.7);">
									pentru intervalul ales
								</p>
							</div>
						</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	.step-dot {
		width: 22px; height: 22px;
		display: inline-flex; align-items: center; justify-content: center;
		border-radius: 50%;
		font-size: 11px;
		font-weight: 700;
	}
	.step-active {
		background: var(--accent);
		color: white;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
	}
	.step-pending {
		background: var(--surface2);
		color: var(--muted);
		border: 1px solid var(--border);
	}

	.car-card {
		background: var(--surface);
		border: 1px solid var(--border);
		text-decoration: none;
		isolation: isolate;
		transition: transform 0.25s ease, border-color 0.25s ease;
		animation: cardIn 0.45s ease both;
		opacity: 0;
	}
	.car-card:hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--ac) 55%, var(--border));
	}
	.car-card:active {
		transform: translateY(0);
	}
	.car-card:hover img {
		transform: scale(1.06);
	}

	@keyframes cardIn {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	/* Color-coded glow ring on hover */
	.card-ring {
		box-shadow: 0 0 0 0 transparent;
		transition: box-shadow 0.3s ease;
	}
	.car-card:hover .card-ring {
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--ac) 60%, transparent) inset,
			0 16px 32px -16px color-mix(in srgb, var(--ac) 60%, transparent);
	}

	.cat-badge {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.spec-pill {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 6px;
		background: var(--surface2);
		color: var(--muted);
		border: 1px solid var(--border);
		min-height: 18px;
	}
	.spec-pill svg { color: var(--muted); }
	.car-card:hover .spec-pill {
		border-color: color-mix(in srgb, var(--ac) 30%, var(--border));
		color: var(--text);
	}

	.dot-pulse {
		width: 5px; height: 5px;
		border-radius: 50%;
		background: #fff;
		display: inline-block;
		animation: pulse 1.4s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50%      { opacity: 0.4; transform: scale(0.7); }
	}

	.select-cta {
		box-shadow:
			0 1px 0 rgba(255,255,255,0.18) inset,
			0 4px 10px -4px color-mix(in srgb, var(--ac) 60%, transparent);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}
	.car-card:hover .select-cta {
		transform: translateY(-1px);
		box-shadow:
			0 1px 0 rgba(255,255,255,0.22) inset,
			0 8px 18px -4px color-mix(in srgb, var(--ac) 70%, transparent);
	}

	.select-arrow {
		display: inline-block;
		transition: transform 0.2s ease;
	}
	.car-card:hover .select-arrow { transform: translateX(2px); }

	.placeholder-aurora {
		animation: aurora 5s ease-in-out infinite alternate;
	}
	@keyframes aurora {
		0%   { transform: translate3d(0,0,0)    scale(1); }
		100% { transform: translate3d(8%,-4%,0) scale(1.1); }
	}

	.car-card-disabled {
		cursor: not-allowed;
		opacity: 0.85;
	}
	.car-card-disabled:hover {
		transform: none;
		border-color: var(--border);
	}
	.car-card-disabled:hover img,
	.car-card-disabled .select-cta,
	.car-card-disabled:hover .select-arrow {
		transform: none;
	}

	.step-done {
		background: #22c55e;
		color: #0b0b1a;
	}

	@media (prefers-reduced-motion: reduce) {
		.car-card { animation: none; opacity: 1; }
		.car-card:hover { transform: none; }
		.car-card:hover img { transform: none; }
		.placeholder-aurora, .dot-pulse { animation: none; }
	}
</style>
