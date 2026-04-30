<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type WorkOrder } from '$lib/api';

	let reparatii = $state<WorkOrder[]>([]);
	let loading = $state(true);

	onMount(async () => {
		reparatii = await api.reparatii();
		loading = false;
	});

	const colorMap: Record<string, string> = {
		green: 'var(--green)', red: 'var(--red)', yellow: 'var(--yellow)'
	};
</script>

<div class="space-y-6">
	<h1 class="text-xl font-bold" style="color: var(--text)">Reparații</h1>

	{#if loading}
		<div class="flex justify-center py-10">
			<div class="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
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
					class="block p-4 rounded-2xl border transition-all hover:border-blue-500/40"
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
					</p>
				</a>
			{/each}
		</div>
	{/if}
</div>
