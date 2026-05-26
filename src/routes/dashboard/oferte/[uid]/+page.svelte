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
			// Dacă nu e VM, redirect la pagina de reparații
			if (wo && wo.dept !== 'VM') {
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

	const facturaTipLabel = $derived((tip: string | null) => {
		switch (tip) {
			case 'oferta':   return 'Ofertă';
			case 'proforma': return 'Proformă';
			case 'fiscala':  return 'Factură fiscală';
			default:         return tip ?? 'Document';
		}
	});

	const facturaColor = $derived((tip: string | null) => {
		switch (tip) {
			case 'oferta':   return '#eab308';
			case 'proforma': return '#3b82f6';
			case 'fiscala':  return '#22c55e';
			default:         return '#64748b';
		}
	});
</script>

<div class="space-y-4 p-4 max-w-2xl mx-auto pb-24">
	{#if loading}
		<Skeleton />
	{:else if loadError}
		<div class="p-4 rounded-2xl text-sm" style="background:#ef444412; color:#ef4444">{loadError}</div>
	{:else if wo && wo.dept === 'VM' && wo.vm}
		{@const m = wo.vm.masina}
		{@const f = wo.vm.factura}
		<a href="/dashboard" class="text-sm" style="color: var(--muted)">← Înapoi</a>

		<header class="space-y-1">
			<h1 class="text-2xl font-extrabold" style="color: var(--text)">Ofertă vânzare</h1>
			<p class="text-sm" style="color: var(--muted)">Mașină din parcul intern, pregătită pentru tine.</p>
		</header>

		{#if m}
			<section class="p-5 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
				<p class="font-bold text-xl" style="color: var(--text)">{m.marca ?? ''} {m.model ?? ''} {m.an ? `· ${m.an}` : ''}</p>
				<div class="text-xs mt-1 space-y-0.5" style="color: var(--muted)">
					{#if m.numar_inmatriculare}<p>Nr.: <span class="font-mono">{m.numar_inmatriculare}</span></p>{/if}
					{#if m.vin}<p>VIN: <span class="font-mono">{m.vin}</span></p>{/if}
				</div>
				<p class="text-3xl font-extrabold mt-3" style="color: var(--accent)">
					{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: m.moneda || 'RON', minimumFractionDigits: 0 }).format(m.pret)}
				</p>
			</section>
		{/if}

		{#if wo.vm.stare_vanzare === 'avariata'}
			<section class="p-4 rounded-2xl border space-y-2" style="background:#f59e0b0d; border-color:#f59e0b30;">
				<p class="font-bold text-sm" style="color:#f59e0b">⚠ Mașina se vinde în stare avariată</p>
				<pre class="whitespace-pre-wrap text-xs" style="color: var(--text); font-family: inherit;">{wo.vm.descriere_avarii ?? '—'}</pre>
			</section>
		{/if}

		{#if f}
			<section class="p-4 rounded-2xl border space-y-2" style="background: var(--surface); border-color: var(--border);">
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold uppercase tracking-wide" style="color: var(--muted)">Document curent</span>
					<span class="text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide"
					      style="background: {facturaColor(f.tip)}20; color: {facturaColor(f.tip)};">
						{facturaTipLabel(f.tip)}
					</span>
				</div>
				<div class="flex items-baseline justify-between">
					<span class="font-bold text-base" style="color: var(--text)">{f.numar}</span>
					<span class="text-lg font-extrabold" style="color: var(--text)">
						{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(f.total)}
					</span>
				</div>
				{#if f.data}
					<p class="text-xs" style="color: var(--muted)">Emis: {new Date(f.data).toLocaleDateString('ro-RO')}</p>
				{/if}
			</section>
		{/if}

		<!-- Acțiuni acceptare/refuz, doar dacă deviz pending -->
		{#if wo.deviz_trimis_la && !wo.deviz_aprobat_la && !wo.deviz_refuzat_la}
			<section class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
				<p class="font-semibold text-sm" style="color: var(--text)">Decizia ta</p>

				{#if actionMsg}
					<p class="text-xs px-3 py-2 rounded-xl" style="background:#22c55e12; color:#22c55e">{actionMsg}</p>
				{/if}
				{#if actionError}
					<p class="text-xs px-3 py-2 rounded-xl" style="background:#ef444412; color:#ef4444">{actionError}</p>
				{/if}

				<div class="grid grid-cols-2 gap-3">
					<button onclick={() => action(() => api.aprobaDeviz(uid, []))} disabled={actionLoading}
					        class="px-4 py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50"
					        style="background:#22c55e; color:white;">
						{actionLoading ? '...' : 'Accept oferta'}
					</button>
					<button onclick={() => { if (confirm('Refuzi oferta?')) action(() => api.refuzaDeviz(uid)); }}
					        disabled={actionLoading}
					        class="px-4 py-3 rounded-xl font-semibold text-sm transition disabled:opacity-50"
					        style="background:#ef444412; color:#ef4444; border:1px solid #ef444430;">
						Refuz
					</button>
				</div>
			</section>
		{:else if wo.deviz_aprobat_la}
			<section class="p-4 rounded-2xl text-sm font-semibold text-center" style="background:#22c55e12; color:#22c55e">
				✓ Ai acceptat oferta. Continui cu plata pentru factura fiscală.
			</section>
		{:else if wo.deviz_refuzat_la}
			<section class="p-4 rounded-2xl text-sm font-semibold text-center" style="background:#ef444412; color:#ef4444">
				Oferta a fost refuzată.
			</section>
		{/if}
	{/if}
</div>

{#if wo}
	<ChatPortal woUid={uid} bind:visible={chatOpen} bind:chatUnread={chatUnread} />
{/if}
