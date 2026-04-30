<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type DashboardData } from '$lib/api';
	import { auth } from '$lib/stores';
	import { goto } from '$app/navigation';

	let data = $state<DashboardData | null>(null);
	let loading = $state(true);
	let client = $derived($auth);

	onMount(async () => {
		try { data = await api.dashboard(); }
		catch { goto('/login'); }
		finally { loading = false; }
	});

	const colorMap: Record<string, string> = {
		green: 'var(--green)', red: 'var(--red)', yellow: 'var(--yellow)'
	};
</script>

{#if loading}
	<div class="flex items-center justify-center h-40">
		<div class="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
	</div>
{:else if data}
	<div class="space-y-6">
		<!-- Greeting -->
		<div>
			<h1 class="text-2xl font-bold" style="color: var(--text)">
				Bună, {client?.nume?.split(' ')[0] ?? 'Client'}
			</h1>
			<p class="text-sm mt-0.5" style="color: var(--muted)">Portal NLG</p>
		</div>

		<!-- Active work orders -->
		{#if data.active.length > 0}
			<section>
				<h2 class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--muted)">
					Reparații active
				</h2>
				<div class="space-y-2">
					{#each data.active as wo}
						<a href="/dashboard/reparatii/{wo.uid}"
							class="block p-4 rounded-2xl border transition-all hover:border-blue-500/40"
							style="background: var(--surface); border-color: var(--border);">
							<div class="flex items-center justify-between mb-1">
								<span class="text-sm font-semibold" style="color: var(--text)">
									{wo.masina?.numar_inmatriculare ?? '—'}
								</span>
								<span class="text-xs px-2 py-0.5 rounded-full font-medium"
									style="background: {colorMap[wo.portal_color ?? 'yellow']}22; color: {colorMap[wo.portal_color ?? 'yellow']}">
									{wo.portal_label}
								</span>
							</div>
							<p class="text-xs" style="color: var(--muted)">
								{wo.masina?.marca} {wo.masina?.model}
							</p>
						</a>
					{/each}
				</div>
			</section>
		{:else}
			<div class="p-6 rounded-2xl border text-center" style="background: var(--surface); border-color: var(--border);">
				<p class="text-2xl mb-1">🔧</p>
				<p class="text-sm font-medium" style="color: var(--text)">Nicio reparație activă</p>
				<p class="text-xs mt-1" style="color: var(--muted)">Mașina ta e în regulă momentan.</p>
			</div>
		{/if}

		<!-- Quick access -->
		<section>
			<h2 class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--muted)">
				Acces rapid
			</h2>
			<div class="grid grid-cols-2 gap-3">
				{#each [
					{ href: '/dashboard/programari/noua', icon: '📅', label: 'Programare nouă', sub: 'Rezervă un slot' },
					{ href: '/dashboard/reparatii', icon: '🔧', label: 'Istoricul meu', sub: 'Toate reparațiile' },
					{ href: '/dashboard/masini', icon: '🚗', label: 'Mașinile mele', sub: `${data.masini.length} înregistrate` },
					{ href: '/dashboard/documente', icon: '📄', label: 'Documente', sub: 'Facturi & garanții' },
				] as item}
					<a href={item.href}
						class="p-4 rounded-2xl border flex flex-col gap-2 transition-all hover:border-blue-500/40"
						style="background: var(--surface); border-color: var(--border);">
						<span class="text-2xl">{item.icon}</span>
						<div>
							<p class="text-sm font-semibold" style="color: var(--text)">{item.label}</p>
							<p class="text-xs" style="color: var(--muted)">{item.sub}</p>
						</div>
					</a>
				{/each}
			</div>
		</section>

		<!-- Upcoming appointments -->
		{#if data.programari.length > 0}
			<section>
				<h2 class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--muted)">
					Programări viitoare
				</h2>
				<div class="space-y-2">
					{#each data.programari as p}
						<div class="p-4 rounded-2xl border flex items-center justify-between"
							style="background: var(--surface); border-color: var(--border);">
							<div>
								<p class="text-sm font-semibold" style="color: var(--text)">{p.nr_inmatriculare}</p>
								<p class="text-xs" style="color: var(--muted)">
									{new Date(p.start_at).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })}
								</p>
							</div>
							<span class="text-xs px-2 py-1 rounded-lg" style="background: var(--surface2); color: var(--muted)">
								{p.status}
							</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</div>
{/if}
