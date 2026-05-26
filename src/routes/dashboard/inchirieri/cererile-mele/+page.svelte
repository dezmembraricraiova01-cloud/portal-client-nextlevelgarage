<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type InchiriereCerere } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';

	let cereri  = $state<InchiriereCerere[]>([]);
	let loading = $state(true);
	let error   = $state('');
	let cancelingId = $state<number | null>(null);

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await api.inchirieriCereri();
			cereri = res.cereri;
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcare.';
		} finally {
			loading = false;
		}
	}

	async function anuleaza(id: number) {
		if (!confirm('Anulezi cererea? Operația este definitivă.')) return;
		cancelingId = id;
		try {
			const res = await api.anuleazaCerereInchiriere(id);
			cereri = cereri.map(c => c.id === id ? res.cerere : c);
		} catch (e: any) {
			alert(e.message ?? 'Eroare la anulare.');
		} finally {
			cancelingId = null;
		}
	}

	const STATUS_STYLES: Record<string, { bg: string; fg: string; border: string }> = {
		in_asteptare: { bg: '#eab30818', fg: '#eab308', border: '#eab30840' },
		acceptata:    { bg: '#22c55e18', fg: '#22c55e', border: '#22c55e40' },
		respinsa:     { bg: '#ef444418', fg: '#ef4444', border: '#ef444440' },
		anulata:      { bg: 'var(--surface2)', fg: 'var(--muted)', border: 'var(--border)' },
	};
	const statusStyle = (s: string) =>
		STATUS_STYLES[s] ?? { bg: 'var(--surface2)', fg: 'var(--muted)', border: 'var(--border)' };

	const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });

	onMount(load);
</script>

<div class="space-y-4 pb-4">
	<div class="flex items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-bold tracking-tight" style="color: var(--text)">Cererile mele de închiriere</h1>
			<p class="text-xs mt-0.5" style="color: var(--muted)">Istoric și status</p>
		</div>
		<a href="/dashboard/inchirieri"
			class="text-xs font-semibold px-3 py-1.5 rounded-full"
			style="background: var(--accent); color: white; text-decoration: none;">
			+ Cerere nouă
		</a>
	</div>

	{#if loading}
		<div class="space-y-3">
			{#each Array(2) as _}
				<div class="p-4 rounded-2xl border space-y-2" style="background: var(--surface); border-color: var(--border);">
					<Skeleton height="h-5" class="w-40" />
					<Skeleton height="h-3" class="w-32" />
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="p-4 rounded-2xl text-sm" style="background: #ef444418; color: #ef4444; border: 1px solid #ef444440;">
			{error}
		</div>
	{:else if cereri.length === 0}
		<div class="text-center py-12 px-4 rounded-2xl border"
			style="background: var(--surface); border-color: var(--border);">
			<div class="text-4xl mb-2">📭</div>
			<p class="font-semibold" style="color: var(--text)">Nicio cerere încă</p>
			<p class="text-xs mt-1" style="color: var(--muted)">Vezi flota și alege o mașină.</p>
			<a href="/dashboard/inchirieri" class="inline-block mt-4 text-xs font-semibold px-4 py-2 rounded-xl"
				style="background: var(--accent); color: white; text-decoration: none;">
				Vezi flota →
			</a>
		</div>
	{:else}
		<div class="space-y-3">
			{#each cereri as c (c.id)}
				{@const s = statusStyle(c.status)}
				<div class="rounded-2xl border overflow-hidden" style="background: var(--surface); border-color: var(--border);">
					<div class="flex">
						{#if c.masina?.foto_url}
							<div class="w-24 shrink-0" style="background: #0a0a18;">
								<img src={c.masina.foto_url} alt="{c.masina.marca}"
									class="w-full h-full object-cover" />
							</div>
						{:else}
							<div class="w-24 shrink-0 flex items-center justify-center text-3xl"
								style="background: var(--surface2);">
								🚗
							</div>
						{/if}

						<div class="flex-1 p-3 min-w-0">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0">
									<p class="font-bold text-sm leading-tight" style="color: var(--text)">
										{c.masina ? `${c.masina.marca} ${c.masina.model}` : 'Mașină indisponibilă'}
									</p>
									<p class="text-xs mt-0.5" style="color: var(--muted)">
										{fmtDate(c.data_start)} → {fmtDate(c.data_end)}
									</p>
								</div>
								<span class="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full"
									style="background: {s.bg}; color: {s.fg}; border: 1px solid {s.border};">
									{c.status_label}
								</span>
							</div>

							<div class="flex items-center justify-between mt-2">
								<p class="text-xs" style="color: var(--muted)">
									{c.nr_zile} {c.nr_zile === 1 ? 'zi' : 'zile'} ·
									<span style="color: var(--text); font-weight: 600">{c.cost_estimat.toFixed(0)} lei</span>
								</p>
								{#if c.status === 'in_asteptare'}
									<button onclick={() => anuleaza(c.id)} disabled={cancelingId === c.id}
										class="text-xs font-semibold px-2.5 py-1 rounded-lg"
										style="background: transparent; color: #ef4444; border: 1px solid #ef444440;">
										{cancelingId === c.id ? '...' : 'Anulează'}
									</button>
								{/if}
							</div>

							{#if c.extras && c.extras.length > 0}
								<div class="flex flex-wrap gap-1 mt-1.5">
									{#each c.extras as e}
										<span class="text-[10px] font-medium px-1.5 py-0.5 rounded"
											style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
											+ {e.label}
										</span>
									{/each}
								</div>
							{/if}

							{#if c.status === 'respinsa' && c.motiv_respingere}
								<p class="text-xs mt-2 p-2 rounded-lg"
									style="background: #ef444410; color: #ef4444;">
									<strong>Motiv:</strong> {c.motiv_respingere}
								</p>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
