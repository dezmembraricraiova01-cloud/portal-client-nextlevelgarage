<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, type WorkOrder } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';
	import ChatPortal from '$lib/ChatPortal.svelte';

	const uid = $derived(page.params.uid!);
	let wo            = $state<WorkOrder | null>(null);
	let loading       = $state(true);
	let actionMsg     = $state('');
	let actionError   = $state('');
	let actionLoading = $state(false);
	let loadError     = $state('');
	let chatOpen      = $state(false);
	let chatUnread    = $state(0);

	onMount(async () => {
		try {
			const res = await api.reparatie(uid);
			wo = res.wo;
			if (wo && wo.dept !== 'MS') {
				await goto(`/dashboard/reparatii/${uid}`, { replaceState: true });
				return;
			}
		} catch (e: any) {
			loadError = e.message ?? 'Eroare la încărcare.';
		} finally {
			loading = false;
		}
	});

	async function action(fn: () => Promise<any>) {
		actionLoading = true;
		actionMsg = '';
		actionError = '';
		try {
			const res = await fn();
			actionMsg = res.message;
			const refreshed = await api.reparatie(uid);
			wo = refreshed.wo;
		} catch (e: any) {
			actionError = e.message ?? 'Eroare. Încearcă din nou.';
		} finally {
			actionLoading = false;
		}
	}
</script>

<div class="space-y-4 p-4 max-w-2xl mx-auto pb-24">
	{#if loading}
		<Skeleton />
	{:else if loadError}
		<div class="p-4 rounded-2xl text-sm" style="background:#ef444412; color:#ef4444">{loadError}</div>
	{:else if wo && wo.dept === 'MS' && wo.ms}
		{@const ms = wo.ms.masina_schimb}
		{@const premium = wo.ms.premium ?? []}
		<a href="/dashboard" class="text-sm" style="color: var(--muted)">← Înapoi</a>

		<header class="space-y-1">
			<h1 class="text-2xl font-extrabold" style="color: var(--text)">Mașină de schimb</h1>
			<p class="text-sm" style="color: var(--muted)">{wo.ms.mesaj_principal}</p>
		</header>

		{#if ms}
			<section class="p-5 rounded-2xl border" style="background:#22c55e0d; border-color:#22c55e30;">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="font-bold text-xl" style="color: var(--text)">{ms.marca ?? ''} {ms.model ?? ''} {ms.an ? `· ${ms.an}` : ''}</p>
						<div class="text-xs mt-1 space-y-0.5" style="color: var(--muted)">
							{#if ms.clasa}<p>Clasă: {ms.clasa}</p>{/if}
							{#if ms.numar_inmatriculare}<p>Nr.: <span class="font-mono">{ms.numar_inmatriculare}</span></p>{/if}
						</div>
					</div>
					<span class="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide shrink-0"
					      style="background:#22c55e; color:white">GRATIS</span>
				</div>
			</section>
		{/if}

		{#if actionMsg}
			<div class="p-3 rounded-xl text-xs" style="background:#22c55e12; color:#22c55e">{actionMsg}</div>
		{/if}
		{#if actionError}
			<div class="p-3 rounded-xl text-xs" style="background:#ef444412; color:#ef4444">{actionError}</div>
		{/if}

		<!-- Premium upsell -->
		{#if premium.length > 0}
			<section class="space-y-2">
				<div>
					<h2 class="text-sm font-semibold" style="color: var(--text)">Vrei o gamă superioară?</h2>
					<p class="text-xs" style="color: var(--muted)">Plătești doar diferența de tarif/zi față de cea gratuită.</p>
				</div>

				{#each premium as p (p.id)}
					<div class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
						<div class="flex items-start justify-between gap-3">
							<div class="flex-1 min-w-0">
								<p class="font-bold text-base" style="color: var(--text)">
									{p.marca ?? ''} {p.model ?? ''} {p.an ? `· ${p.an}` : ''}
								</p>
								<div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-0.5" style="color: var(--muted)">
									{#if p.clasa}<span>Clasă {p.clasa}</span>{/if}
									{#if p.tip_caroserie}<span>{p.tip_caroserie}</span>{/if}
									{#if p.transmisie}<span>{p.transmisie}</span>{/if}
									{#if p.nr_locuri}<span>{p.nr_locuri} locuri</span>{/if}
								</div>
							</div>
							<div class="text-right shrink-0">
								<p class="text-lg font-extrabold" style="color: var(--accent)">
									+{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', minimumFractionDigits: 0 }).format(p.tarif_extra)}
								</p>
								<p class="text-xs" style="color: var(--muted)">/zi extra</p>
							</div>
						</div>
						<button type="button"
						        onclick={() => action(() => api.intrebareDeviz(uid, `Doresc upgrade la mașina premium: ${p.marca ?? ''} ${p.model ?? ''} (nr. ${p.numar_inmatriculare ?? '—'}). Diferența: ${p.tarif_extra} RON/zi.`))}
						        disabled={actionLoading}
						        class="w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
						        style="background: var(--accent); color: white;">
							Cer această mașină
						</button>
					</div>
				{/each}

				<p class="text-xs px-1" style="color: var(--muted)">După solicitare te contactăm pentru confirmare și plata diferenței.</p>
			</section>
		{:else}
			<section class="p-4 rounded-2xl border-dashed border" style="border-color: var(--border)">
				<p class="text-xs" style="color: var(--text)">Momentan nu sunt mașini premium disponibile peste cea actuală. Pentru cereri speciale contactează-ne pe chat.</p>
			</section>
		{/if}
	{/if}
</div>

{#if wo}
	<ChatPortal woUid={uid} bind:visible={chatOpen} bind:chatUnread={chatUnread} />
{/if}
