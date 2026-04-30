<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Programare } from '$lib/api';

	let programari = $state<Programare[]>([]);
	let loading = $state(true);

	const statusColor: Record<string, string> = {
		planificata: 'var(--yellow)', confirmata: 'var(--green)', anulata: 'var(--red)'
	};

	onMount(async () => {
		programari = await api.programari();
		loading = false;
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold" style="color: var(--text)">Programări</h1>
		<a href="/dashboard/programari/noua"
			class="text-sm px-4 py-2 rounded-xl font-semibold"
			style="background: var(--accent); color: white;">+ Nouă</a>
	</div>

	{#if loading}
		<div class="flex justify-center py-10">
			<div class="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
		</div>
	{:else if programari.length === 0}
		<div class="text-center py-10" style="color: var(--muted)">
			<p class="text-3xl mb-2">📅</p>
			<p class="text-sm">Nu ai programări.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each programari as p}
				<div class="p-4 rounded-2xl border flex items-center justify-between"
					style="background: var(--surface); border-color: var(--border);">
					<div>
						<p class="font-semibold text-sm" style="color: var(--text)">{p.nr_inmatriculare}</p>
						<p class="text-xs mt-0.5" style="color: var(--muted)">
							{new Date(p.start_at).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })}
						</p>
						{#if p.notita}<p class="text-xs mt-1" style="color: var(--muted)">{p.notita}</p>{/if}
					</div>
					<span class="text-xs px-2 py-1 rounded-lg font-medium"
						style="background: {statusColor[p.status] ?? 'var(--surface2)'}22; color: {statusColor[p.status] ?? 'var(--muted)'}">
						{p.status}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
