<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { api, type Masina, type WoSummary } from '$lib/api';

	const id = $derived(Number($page.params.id));
	let masina = $state<Masina | null>(null);
	let reparatii = $state<WoSummary[]>([]);
	let loading = $state(true);

	onMount(async () => {
		const res = await api.masina(id);
		masina = res.masina; reparatii = res.reparatii;
		loading = false;
	});

	const statusLabel: Record<string, string> = {
		receptie: 'Recepție', in_lucru: 'În lucru', finalizat: 'Finalizat'
	};
</script>

{#if loading}
	<div class="flex justify-center py-20">
		<div class="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
	</div>
{:else if masina}
	<div class="space-y-6">
		<a href="/dashboard/masini" class="text-sm" style="color: var(--muted)">← Înapoi</a>

		<div class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
			<p class="font-bold text-xl" style="color: var(--text)">{masina.numar_inmatriculare}</p>
			<p class="text-sm mt-1" style="color: var(--muted)">{masina.marca} {masina.model} {masina.an ? `· ${masina.an}` : ''}</p>
			{#if masina.combustibil}<p class="text-xs mt-1 capitalize" style="color: var(--muted)">{masina.combustibil}</p>{/if}
			{#if masina.vin}<p class="text-xs mt-1 font-mono" style="color: var(--muted)">VIN: {masina.vin}</p>{/if}
		</div>

		{#if reparatii.length > 0}
			<section>
				<h2 class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--muted)">Istoric reparații</h2>
				<div class="space-y-2">
					{#each reparatii as r}
						<a href="/dashboard/reparatii/{r.uid}"
							class="block p-3 rounded-xl border transition-all hover:border-blue-500/40"
							style="background: var(--surface); border-color: var(--border);">
							<div class="flex items-center justify-between">
								<span class="text-xs" style="color: var(--muted)">
									{r.reception_at ? new Date(r.reception_at).toLocaleDateString('ro-RO') : '—'}
								</span>
								<span class="text-xs" style="color: var(--accent)">{statusLabel[r.status] ?? r.status}</span>
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</div>
{/if}
