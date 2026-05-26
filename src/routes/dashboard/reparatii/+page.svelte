<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { gsap } from 'gsap';
	import { api, timeAgo, type WorkOrder } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';

	let reparatii   = $state<WorkOrder[]>([]);
	let loading     = $state(true);
	let loadingMore = $state(false);
	let error       = $state('');
	let currentPage = $state(1);
	let lastPage    = $state(1);

	const colorMap: Record<string, string> = {
		green: '#22c55e', red: '#ef4444', yellow: '#eab308'
	};

	onMount(async () => {
		try {
			const res = await api.reparatii();
			reparatii   = res.data;
			currentPage = res.current_page;
			lastPage    = res.last_page;
			await tick();
			gsap.from('.wo-card', { y: 16, opacity: 0, duration: 0.28, stagger: 0.06, ease: 'power2.out' });
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcarea reparațiilor.';
		} finally {
			loading = false;
		}
	});

	async function loadMore() {
		if (loadingMore || currentPage >= lastPage) return;
		loadingMore = true;
		try {
			const res = await api.reparatiiPage(currentPage + 1);
			reparatii   = [...reparatii, ...res.data];
			currentPage = res.current_page;
			lastPage    = res.last_page;
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcare.';
		} finally {
			loadingMore = false;
		}
	}
</script>

<div class="space-y-6">
	<h1 class="text-xl font-bold" style="color: var(--text)">Reparații</h1>

	{#if loading}
		<div class="space-y-3">
			{#each Array(3) as _}
				<div class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
					<div class="flex items-center justify-between mb-2">
						<Skeleton height="h-4" class="w-28" />
						<Skeleton height="h-5" class="w-16" rounded="rounded-full" />
					</div>
					<Skeleton height="h-3" class="w-48 mt-1" />
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="text-center py-10">
			<p class="text-sm text-red-400">{error}</p>
		</div>
	{:else if reparatii.length === 0}
		<div class="text-center py-10" style="color: var(--muted)">
			<p class="text-3xl mb-2">🔧</p>
			<p class="text-sm">Nicio reparație în istoric.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each reparatii as wo}
				<a href="/dashboard/reparatii/{wo.uid}"
					class="wo-card block p-4 rounded-2xl border transition-all hover:border-blue-500/40"
					style="background: var(--surface); border-color: var(--border);">
					<div class="flex items-center justify-between mb-2">
						<span class="font-semibold text-sm" style="color: var(--text)">
							{wo.masina?.numar_inmatriculare ?? '—'}
						</span>
						{#if wo.portal_color}
							<span class="text-xs px-2 py-0.5 rounded-full font-medium"
								style="background: {colorMap[wo.portal_color]}22; color: {colorMap[wo.portal_color]}">
								{wo.portal_label}
							</span>
						{/if}
					</div>
					<p class="text-xs" style="color: var(--muted)">
						{wo.masina?.marca} {wo.masina?.model}
						{#if wo.reception_at}
							· {new Date(wo.reception_at).toLocaleDateString('ro-RO')}
						{/if}
						{#if wo.predare_la}
							· <span style="color: var(--accent)">predare {new Date(wo.predare_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}</span>
						{/if}
					</p>
					{#if wo.ultima_actualizare}
						<p class="text-[11px] mt-1" style="color: var(--muted)">actualizat {timeAgo(wo.ultima_actualizare)}</p>
					{/if}
				</a>
			{/each}
		</div>

		{#if currentPage < lastPage}
			<button
				onclick={loadMore}
				disabled={loadingMore}
				class="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 transition-all"
				style="background: var(--surface); color: var(--muted); border: 1px solid var(--border);">
				{loadingMore ? 'Se încarcă...' : `Mai multe (pagina ${currentPage + 1} din ${lastPage})`}
			</button>
		{/if}
	{/if}
</div>
