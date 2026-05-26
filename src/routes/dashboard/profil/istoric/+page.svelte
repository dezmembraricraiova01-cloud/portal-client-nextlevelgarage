<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, type ActivitateItem } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';

	let items   = $state<ActivitateItem[]>([]);
	let loading = $state(true);
	let error   = $state('');

	const icon: Record<string, string> = {
		reparatie:  '🔧',
		programare: '📅',
		feedback:   '⭐',
		factura:    '🧾',
		deviz:      '📋',
	};

	onMount(async () => {
		try {
			items = await api.activitate();
		} catch (e: any) {
			error = e.message ?? 'Nu s-a putut încărca istoricul.';
		} finally {
			loading = false;
		}
	});

	function formatData(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
			+ ' · '
			+ d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
	}

	function groupByDay(arr: ActivitateItem[]): Array<{ key: string; label: string; items: ActivitateItem[] }> {
		const groups: Record<string, ActivitateItem[]> = {};
		for (const it of arr) {
			const key = new Date(it.created_at).toISOString().slice(0, 10);
			(groups[key] ??= []).push(it);
		}
		const azi  = new Date().toISOString().slice(0, 10);
		const ieri = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
		return Object.entries(groups).map(([key, list]) => ({
			key,
			label: key === azi ? 'Astăzi' : key === ieri ? 'Ieri'
				: new Date(key).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }),
			items: list,
		}));
	}

	const grupuri = $derived(groupByDay(items));
</script>

<div class="space-y-5 pb-4">
	<div class="flex items-center gap-3">
		<button onclick={() => goto('/dashboard/profil')}
			class="w-8 h-8 rounded-full flex items-center justify-center transition-opacity active:opacity-60"
			style="background: var(--surface); color: var(--muted); border: 1px solid var(--border);"
			aria-label="Înapoi">
			←
		</button>
		<div>
			<h1 class="text-xl font-bold" style="color: var(--text)">Istoric acțiuni</h1>
			<p class="text-xs mt-0.5" style="color: var(--muted)">Tot ce s-a întâmplat în contul tău</p>
		</div>
	</div>

	{#if loading}
		<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border)">
			{#each Array(6) as _, i}
				<div class="flex items-center gap-3 px-4 py-3 {i > 0 ? 'border-t' : ''}"
					style="background: var(--surface); border-color: var(--border);">
					<Skeleton height="h-5" class="w-5 shrink-0" rounded="rounded" />
					<Skeleton height="h-3" class="flex-1" />
					<Skeleton height="h-3" class="w-16 shrink-0" />
				</div>
			{/each}
		</div>
	{:else if error}
		<p class="text-sm text-red-400 text-center py-6">{error}</p>
	{:else if items.length === 0}
		<div class="rounded-2xl border p-8 text-center" style="border-color: var(--border); background: var(--surface)">
			<p class="text-3xl mb-2">📭</p>
			<p class="text-sm font-semibold" style="color: var(--text)">Niciun eveniment încă</p>
			<p class="text-xs mt-1" style="color: var(--muted)">Acțiunile tale (programări, devize, facturi) vor apărea aici.</p>
		</div>
	{:else}
		{#each grupuri as g}
			<section>
				<h2 class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--muted)">{g.label}</h2>
				<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border)">
					{#each g.items as item, i}
						<div class="flex items-center gap-3 px-4 py-3 {i > 0 ? 'border-t' : ''}"
							style="background: var(--surface); border-color: var(--border);">
							<span class="text-base shrink-0">{icon[item.tip] ?? '📌'}</span>
							<span class="flex-1 text-sm" style="color: var(--text)">{item.label}</span>
							<span class="text-xs shrink-0" style="color: var(--muted)">
								{new Date(item.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
							</span>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>
