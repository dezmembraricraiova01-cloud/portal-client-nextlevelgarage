<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { gsap } from 'gsap';
	import { api, type Programare } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';

	let programari     = $state<Programare[]>([]);
	let loading        = $state(true);
	let loadingMore    = $state(false);
	let error          = $state('');
	let confirmId      = $state<number | null>(null);
	let anulareLoading = $state(false);
	let currentPage    = $state(1);
	let lastPage       = $state(1);
	let includeAnulate = $state(false);

	const canCancel = (p: Programare) =>
		['planificata', 'confirmata'].includes(p.status) && new Date(p.start_at) > new Date();

	async function reincarca() {
		loading = true;
		error   = '';
		try {
			const res = await api.programari(includeAnulate);
			programari  = res.data;
			currentPage = res.current_page;
			lastPage    = res.last_page;
			await tick();
			gsap.from('.prog-card', { y: 16, opacity: 0, duration: 0.32, stagger: 0.07, ease: 'power2.out' });
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcarea programărilor.';
		} finally {
			loading = false;
		}
	}

	onMount(reincarca);

	async function loadMore() {
		if (loadingMore || currentPage >= lastPage) return;
		loadingMore = true;
		try {
			const res = await api.programariPage(currentPage + 1, includeAnulate);
			programari  = [...programari, ...res.data];
			currentPage = res.current_page;
			lastPage    = res.last_page;
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcare.';
		} finally {
			loadingMore = false;
		}
	}

	async function anuleaza(id: number) {
		anulareLoading = true;
		error = '';
		try {
			await api.anulareProgramare(id);
			if (includeAnulate) {
				programari = programari.map(p =>
					p.id === id ? { ...p, status: 'anulata', anulat_la: new Date().toISOString() } : p
				);
			} else {
				programari = programari.filter(p => p.id !== id);
			}
			confirmId = null;
		} catch (e: any) {
			error = e.message ?? 'Eroare la anulare.';
			confirmId = null;
		} finally {
			anulareLoading = false;
		}
	}

	function reprogrameaza(p: Programare) {
		const params = new URLSearchParams({
			reprogramare: String(p.id),
			nr:           p.nr_inmatriculare,
			...(p.tip_serviciu ? { tip: p.tip_serviciu } : {}),
		});
		goto(`/dashboard/programari/noua?${params.toString()}`);
	}

	function toggleAnulate() {
		includeAnulate = !includeAnulate;
		reincarca();
	}

	const statusStyle: Record<string, { bg: string; text: string; border: string; label: string; icon: string }> = {
		planificata: { bg: '#eab30818', text: '#eab308', border: '#eab30840', label: 'Planificată', icon: '⏳' },
		confirmata:  { bg: '#22c55e18', text: '#22c55e', border: '#22c55e40', label: 'Confirmată',  icon: '✅' },
		anulata:     { bg: '#ef444418', text: '#ef4444', border: '#ef444440', label: 'Anulată',     icon: '✕'  },
	};

	function styleFor(p: Programare) {
		return statusStyle[p.status] ?? { bg: 'var(--surface2)', text: 'var(--muted)', border: 'var(--border)', label: p.status, icon: '•' };
	}

	const luniRO  = ['IAN','FEB','MAR','APR','MAI','IUN','IUL','AUG','SEP','OCT','NOI','DEC'];
	const zileRO  = ['DUM','LUN','MAR','MIE','JOI','VIN','SÂM'];

	function dateBits(iso: string) {
		const d = new Date(iso);
		return {
			zi:    zileRO[d.getDay()],
			zn:    String(d.getDate()),
			luna:  luniRO[d.getMonth()],
			an:    d.getFullYear(),
			ora:   d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
		};
	}

	function countdown(iso: string): string {
		const ms = new Date(iso).getTime() - Date.now();
		if (ms < 0) return 'Trecut';
		const minutes = Math.floor(ms / 60_000);
		if (minutes < 60)        return `Peste ${minutes} min`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24)          return `Peste ${hours} ${hours === 1 ? 'oră' : 'ore'}`;
		const days = Math.floor(hours / 24);
		if (days === 1)          return 'Mâine';
		if (days < 7)            return `Peste ${days} zile`;
		const weeks = Math.floor(days / 7);
		if (weeks === 1)         return 'Săptămâna viitoare';
		return `Peste ${weeks} săptămâni`;
	}

	const proxima  = $derived(programari.find(p => canCancel(p)));
	const ceilalti = $derived(programari.filter(p => p.id !== proxima?.id));
</script>

<div class="space-y-6 pb-4">

	<!-- Header -->
	<div class="flex items-end justify-between gap-3">
		<div>
			<h1 class="text-xl font-bold" style="color: var(--text)">Programările mele</h1>
			<p class="text-xs mt-0.5" style="color: var(--muted)">Vezi, reprogramează sau anulează rezervările tale</p>
		</div>
		<a href="/dashboard/programari/noua"
			class="shrink-0 flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-xl font-semibold transition-all active:scale-[0.97]"
			style="background: var(--accent); color: white; box-shadow: 0 4px 14px rgba(59,130,246,0.35);">
			<span class="text-lg leading-none">+</span>
			<span>Programare nouă</span>
		</a>
	</div>

	<button
		onclick={toggleAnulate}
		class="text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95"
		style="background: {includeAnulate ? 'var(--accent)' : 'var(--surface)'}; color: {includeAnulate ? 'white' : 'var(--muted)'}; border-color: {includeAnulate ? 'var(--accent)' : 'var(--border)'};">
		{includeAnulate ? '✓ Afișează și anulate' : 'Afișează și anulate'}
	</button>

	{#if error}
		<div class="rounded-xl px-4 py-3 text-sm" style="background: #ef444418; color: #ef4444; border: 1px solid #ef444430;">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="space-y-3">
			<div class="rounded-3xl border overflow-hidden" style="background: var(--surface); border-color: var(--border);">
				<div class="px-5 py-5 space-y-3">
					<Skeleton height="h-3" class="w-24" />
					<div class="flex items-center gap-4">
						<Skeleton height="h-20" class="w-20 shrink-0" rounded="rounded-2xl" />
						<div class="flex-1 space-y-2">
							<Skeleton height="h-5" class="w-32" />
							<Skeleton height="h-3" class="w-24" />
							<Skeleton height="h-3" class="w-40" />
						</div>
					</div>
					<div class="flex gap-2">
						<Skeleton height="h-10" class="flex-1" rounded="rounded-xl" />
						<Skeleton height="h-10" class="flex-1" rounded="rounded-xl" />
					</div>
				</div>
			</div>
			{#each Array(2) as _}
				<div class="rounded-2xl border overflow-hidden" style="background: var(--surface); border-color: var(--border);">
					<div class="flex items-center gap-3 px-4 py-4">
						<Skeleton height="h-14" class="w-14 shrink-0" rounded="rounded-xl" />
						<div class="flex-1 space-y-2">
							<Skeleton height="h-4" class="w-28" />
							<Skeleton height="h-3" class="w-40" />
						</div>
					</div>
				</div>
			{/each}
		</div>

	{:else if programari.length === 0}
		<div class="rounded-3xl border p-10 text-center" style="border-color: var(--border); background: var(--surface);">
			<div class="text-5xl mb-3">📅</div>
			<p class="text-base font-semibold mb-1" style="color: var(--text)">Nu ai programări încă</p>
			<p class="text-sm mb-5" style="color: var(--muted)">Rezervă o vizită la service în câțiva pași.</p>
			<a href="/dashboard/programari/noua"
				class="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
				style="background: var(--accent); color: white; box-shadow: 0 4px 14px rgba(59,130,246,0.35);">
				<span>📅</span>
				<span>Programează-te la service</span>
				<span>→</span>
			</a>
		</div>

	{:else}

		<!-- ── HERO: Următoarea programare ─────────────────────────────────── -->
		{#if proxima}
			{@const d = dateBits(proxima.start_at)}
			{@const cd = countdown(proxima.start_at)}
			{@const ss = styleFor(proxima)}
			<div class="prog-card rounded-3xl border overflow-hidden relative"
				style="background: linear-gradient(135deg, #3b82f622 0%, #1e1e3812 60%, var(--surface) 100%); border-color: #3b82f640; box-shadow: 0 12px 40px rgba(59,130,246,0.18);">

				<!-- Bara superioară: countdown -->
				<div class="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<span class="text-xs font-bold uppercase tracking-widest" style="color: #93c5fd">Următoarea programare</span>
					</div>
					<span class="text-xs font-bold px-2.5 py-1 rounded-full"
						style="background: #3b82f6; color: white;">
						{cd}
					</span>
				</div>

				<!-- Corp: bloc dată + info -->
				<div class="px-5 pb-4 flex items-stretch gap-4">
					<!-- Dată mare -->
					<div class="shrink-0 w-20 rounded-2xl flex flex-col items-center justify-center py-3"
						style="background: var(--surface); border: 1.5px solid #3b82f640;">
						<span class="text-[10px] font-bold tracking-widest" style="color: #93c5fd">{d.zi}</span>
						<span class="text-3xl font-extrabold leading-none mt-0.5" style="color: var(--text)">{d.zn}</span>
						<span class="text-[10px] font-bold tracking-widest mt-0.5" style="color: var(--muted)">{d.luna}</span>
					</div>

					<div class="flex-1 min-w-0 flex flex-col justify-center">
						<div class="flex items-center gap-2 flex-wrap mb-1">
							<span class="font-mono font-bold text-base" style="color: var(--text)">{proxima.nr_inmatriculare}</span>
							<span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
								style="background: {ss.bg}; color: {ss.text}; border: 1px solid {ss.border};">
								{ss.icon} {ss.label}
							</span>
						</div>
						<p class="text-sm font-semibold" style="color: var(--text)">
							🕐 {d.ora}
						</p>
						{#if proxima.tip_serviciu_label}
							<p class="text-xs mt-1" style="color: var(--muted)">{proxima.tip_serviciu_label}</p>
						{/if}
						{#if proxima.notita}
							<p class="text-xs mt-1 italic" style="color: var(--muted)">"{proxima.notita}"</p>
						{/if}
					</div>
				</div>

				<!-- Acțiuni -->
				{#if confirmId === proxima.id}
					<div class="px-5 py-4 border-t flex items-center justify-between gap-3"
						style="background: #ef444410; border-color: #ef444430;">
						<p class="text-xs font-medium" style="color: #ef4444">Sigur anulezi?</p>
						<div class="flex gap-2">
							<button onclick={() => confirmId = null}
								class="text-xs px-3 py-2 rounded-lg font-semibold"
								style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
								Nu
							</button>
							<button onclick={() => anuleaza(proxima.id)} disabled={anulareLoading}
								class="text-xs px-3 py-2 rounded-lg font-semibold disabled:opacity-40"
								style="background: #ef4444; color: white;">
								{anulareLoading ? '...' : 'Da, anulează'}
							</button>
						</div>
					</div>
				{:else}
					<div class="px-5 pb-5 grid grid-cols-2 gap-2.5">
						<button onclick={() => reprogrameaza(proxima)}
							class="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
							style="background: var(--surface); color: var(--text); border: 1.5px solid #3b82f640;">
							<span>📆</span>
							<span>Reprogramează</span>
						</button>
						<button onclick={() => confirmId = proxima.id}
							class="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
							style="background: var(--surface); color: #ef4444; border: 1.5px solid #ef444440;">
							<span>✕</span>
							<span>Anulează</span>
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- ── Restul programărilor ─────────────────────────────────────────── -->
		{#if ceilalti.length > 0}
			<div class="space-y-2.5">
				{#if proxima}
					<h2 class="text-xs font-semibold uppercase tracking-widest" style="color: var(--muted)">Alte programări</h2>
				{/if}
				{#each ceilalti as p (p.id)}
					{@const d = dateBits(p.start_at)}
					{@const ss = styleFor(p)}
					{@const trecut = new Date(p.start_at) < new Date()}
					<div class="prog-card rounded-2xl border overflow-hidden"
						style="background: var(--surface); border-color: var(--border); opacity: {p.status === 'anulata' ? 0.65 : 1};">

						<div class="px-4 py-4 flex items-center gap-4">
							<!-- Dată compactă -->
							<div class="shrink-0 w-14 rounded-xl flex flex-col items-center justify-center py-2"
								style="background: var(--surface2); border: 1px solid var(--border);">
								<span class="text-[9px] font-bold tracking-widest" style="color: var(--muted)">{d.zi}</span>
								<span class="text-xl font-extrabold leading-none" style="color: var(--text)">{d.zn}</span>
								<span class="text-[9px] font-bold tracking-widest" style="color: var(--muted)">{d.luna}</span>
							</div>

							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-mono font-semibold text-sm" style="color: var(--text)">{p.nr_inmatriculare}</span>
									<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
										style="background: {ss.bg}; color: {ss.text}; border: 1px solid {ss.border};">
										{ss.label}
									</span>
								</div>
								<p class="text-xs mt-1" style="color: var(--muted)">
									🕐 {d.ora}{p.tip_serviciu_label ? ' · ' + p.tip_serviciu_label : ''}
								</p>
								{#if p.anulat_la}
									<p class="text-[10px] mt-0.5" style="color: #ef4444">
										Anulată {new Date(p.anulat_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}
									</p>
								{/if}
							</div>
						</div>

						{#if canCancel(p) && !trecut}
							{#if confirmId === p.id}
								<div class="px-4 py-3 border-t flex items-center justify-between gap-3"
									style="background: #ef444408; border-color: #ef444430;">
									<p class="text-xs font-medium" style="color: #ef4444">Sigur anulezi?</p>
									<div class="flex gap-2">
										<button onclick={() => confirmId = null}
											class="text-xs px-3 py-1.5 rounded-lg font-medium"
											style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
											Nu
										</button>
										<button onclick={() => anuleaza(p.id)} disabled={anulareLoading}
											class="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
											style="background: #ef4444; color: white;">
											{anulareLoading ? '...' : 'Da'}
										</button>
									</div>
								</div>
							{:else}
								<div class="border-t grid grid-cols-2" style="border-color: var(--border)">
									<button onclick={() => reprogrameaza(p)}
										class="py-2.5 text-xs font-semibold transition-opacity active:opacity-60"
										style="color: var(--text); border-right: 1px solid var(--border);">
										📆 Reprogramează
									</button>
									<button onclick={() => confirmId = p.id}
										class="py-2.5 text-xs font-semibold transition-opacity active:opacity-60"
										style="color: #ef4444">
										✕ Anulează
									</button>
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if currentPage < lastPage}
			<button onclick={loadMore} disabled={loadingMore}
				class="w-full py-3 rounded-xl text-sm font-medium disabled:opacity-40 transition-all active:scale-[0.98]"
				style="background: var(--surface); color: var(--muted); border: 1px solid var(--border);">
				{loadingMore ? 'Se încarcă...' : `Mai multe (pagina ${currentPage + 1} din ${lastPage})`}
			</button>
		{/if}
	{/if}
</div>
