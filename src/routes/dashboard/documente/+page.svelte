<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Factura } from '$lib/api';

	let facturi = $state<Factura[]>([]);
	let loading = $state(true);

	onMount(async () => {
		facturi = await api.documente();
		loading = false;
	});
</script>

<div class="space-y-6">
	<h1 class="text-xl font-bold" style="color: var(--text)">Documente</h1>

	{#if loading}
		<div class="flex justify-center py-10">
			<div class="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
		</div>
	{:else if facturi.length === 0}
		<div class="text-center py-10" style="color: var(--muted)">
			<p class="text-3xl mb-2">📄</p>
			<p class="text-sm">Nu ai facturi disponibile.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each facturi as f}
				<div class="p-4 rounded-2xl border flex items-center justify-between"
					style="background: var(--surface); border-color: var(--border);">
					<div>
						<p class="font-semibold text-sm" style="color: var(--text)">
							Factură {f.serie}{f.numar}
						</p>
						{#if f.masina}
							<p class="text-xs mt-0.5" style="color: var(--muted)">
								{f.masina.numar_inmatriculare} — {f.masina.marca} {f.masina.model}
							</p>
						{/if}
						<p class="text-xs mt-0.5" style="color: var(--muted)">
							{new Date(f.data_factura).toLocaleDateString('ro-RO')}
						</p>
					</div>
					<a href={api.documentPdfUrl(f.id)} target="_blank"
						class="text-xs px-3 py-1.5 rounded-lg font-medium"
						style="background: var(--surface2); color: var(--accent); border: 1px solid var(--border);">
						PDF
					</a>
				</div>
			{/each}
		</div>
	{/if}
</div>
