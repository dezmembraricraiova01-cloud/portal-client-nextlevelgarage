<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, type Factura, type ExpirareDoc, type SoldRestant } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';

	let facturi      = $state<Factura[]>([]);
	let expirari     = $state<ExpirareDoc[]>([]);
	let sold         = $state<SoldRestant | null>(null);
	let loading      = $state(true);
	let error        = $state('');
	let downloading  = $state<number | null>(null);

	onMount(async () => {
		try {
			const [docRes, expRes, soldRes] = await Promise.all([
				api.documente(),
				api.expirari(),
				api.soldRestant().catch(() => null),
			]);
			facturi  = docRes.data;
			expirari = expRes;
			sold     = soldRes;
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcarea documentelor.';
		} finally {
			loading = false;
		}
	});

	async function downloadPdf(id: number, e?: Event) {
		e?.stopPropagation();
		downloading = id;
		try {
			await api.downloadPdf(id, `factura-${id}.pdf`);
		} catch {
			error = 'PDF indisponibil momentan.';
		} finally {
			downloading = null;
		}
	}

	function badgeStyle(doc: ExpirareDoc) {
		if (doc.expirat)  return { bg: '#ef444418', text: '#ef4444', border: '#ef444440', label: 'Expirat' };
		if (doc.urgent)   return { bg: '#eab30818', text: '#eab308', border: '#eab30840', label: `${doc.expira_in_zile}z` };
		if ((doc.expira_in_zile ?? 999) <= 30)
			return { bg: '#3b82f618', text: '#3b82f6', border: '#3b82f640', label: `${doc.expira_in_zile}z` };
		return { bg: 'var(--surface2)', text: 'var(--muted)', border: 'var(--border)', label: `${doc.expira_in_zile}z` };
	}

	function statusStyle(f: Factura) {
		if (f.tip_document === 'storno')         return { bg: '#ef444418', text: '#ef4444', border: '#ef444440' };
		if (f.status === 'incasata')             return { bg: '#10b98118', text: '#10b981', border: '#10b98140' };
		if (f.is_restanta)                       return { bg: '#ef444418', text: '#ef4444', border: '#ef444440' };
		return { bg: '#3b82f618', text: '#3b82f6', border: '#3b82f640' };
	}

	const tipIcon: Record<string, string> = {
		rca: '🛡️', casco: '🔒', carte_verde: '🌍', itp: '🔬',
		rovinieta: '🛡️', buletin: '🪪', permis: '🚗', tahograf: '📡',
	};

	function formatData(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function formatBani(n: number): string {
		return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<div class="space-y-6 pb-4">
	<h1 class="text-xl font-bold" style="color: var(--text)">Documentele mele</h1>

	{#if loading}
		<div class="space-y-6">
			<section class="space-y-2">
				<Skeleton height="h-3" class="w-32" />
				{#each Array(2) as _}
					<div class="rounded-xl border px-4 py-3.5" style="background: var(--surface); border-color: var(--border);">
						<div class="flex items-center justify-between gap-3">
							<div class="flex items-center gap-3 flex-1">
								<Skeleton height="h-6" class="w-6 shrink-0" rounded="rounded-lg" />
								<div class="flex-1 space-y-1.5">
									<Skeleton height="h-4" class="w-36" />
									<Skeleton height="h-3" class="w-24" />
								</div>
							</div>
							<Skeleton height="h-6" class="w-12 shrink-0" rounded="rounded-full" />
						</div>
					</div>
				{/each}
			</section>
		</div>
	{:else if error}
		<p class="text-sm text-red-400 text-center py-6">{error}</p>
	{:else}

		<!-- ⓪ Sold restant (dacă există facturi neîncasate) -->
		{#if sold && sold.nr_facturi_emise > 0}
			<section
				class="rounded-2xl border p-4"
				style="background: {sold.total_restant > 0 ? '#ef444412' : '#3b82f612'}; border-color: {sold.total_restant > 0 ? '#ef444440' : '#3b82f640'}">
				<div class="flex items-start gap-3">
					<span class="text-2xl shrink-0">{sold.total_restant > 0 ? '⚠️' : '💳'}</span>
					<div class="flex-1 min-w-0">
						<p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted)">
							{sold.total_restant > 0 ? 'Sold restant' : 'Sold neîncasat'}
						</p>
						<p class="text-2xl font-extrabold mt-0.5" style="color: {sold.total_restant > 0 ? '#ef4444' : 'var(--text)'}">
							{formatBani(sold.total_restant > 0 ? sold.total_restant : sold.total_neincasat)} <span class="text-sm font-normal" style="color: var(--muted)">RON</span>
						</p>
						<p class="text-xs mt-1" style="color: var(--muted)">
							{#if sold.total_restant > 0}
								{sold.nr_facturi_restante} {sold.nr_facturi_restante === 1 ? 'factură restantă' : 'facturi restante'}
								din {sold.nr_facturi_emise} emise
							{:else}
								{sold.nr_facturi_emise} {sold.nr_facturi_emise === 1 ? 'factură emisă' : 'facturi emise'} (toate la termen)
							{/if}
						</p>
					</div>
				</div>
			</section>
		{/if}

		<!-- ① Acte & Asigurări -->
		<section>
			<h2 class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--muted)">
				Acte & Asigurări
			</h2>

			{#if expirari.length === 0}
				<div class="rounded-2xl border p-5 text-center" style="border-color: var(--border); background: var(--surface)">
					<p class="text-2xl mb-1">📋</p>
					<p class="text-sm" style="color: var(--muted)">Nu sunt acte înregistrate.</p>
					<p class="text-xs mt-1" style="color: var(--muted)">ITP, RCA și CASCO vor apărea aici când le adaugi.</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each expirari as doc}
						{@const badge = badgeStyle(doc)}
						<div class="rounded-xl border px-4 py-3.5"
							style="background: var(--surface); border-color: {doc.urgent || doc.expirat ? badge.border : 'var(--border)'}; background: {doc.urgent || doc.expirat ? badge.bg : 'var(--surface)'}">
							<div class="flex items-center justify-between gap-3">
								<div class="flex items-center gap-3 min-w-0">
									<span class="text-xl shrink-0">{tipIcon[doc.tip] ?? '📄'}</span>
									<div class="min-w-0">
										<p class="text-sm font-semibold leading-tight" style="color: var(--text)">
											{doc.label}
										</p>
										<p class="text-xs mt-0.5" style="color: var(--muted)">
											{doc.masina}{doc.asigurator ? ' · ' + doc.asigurator : ''}
										</p>
										{#if doc.numar_polita}
											<p class="text-xs mt-0.5 font-mono" style="color: var(--muted)">
												Poliță: {doc.numar_polita}
											</p>
										{/if}
									</div>
								</div>
								<div class="shrink-0 text-right">
									<span class="text-xs font-semibold px-2.5 py-1 rounded-full"
										style="background: {badge.bg}; color: {badge.text}; border: 1px solid {badge.border}">
										{#if doc.expirat}
											Expirat
										{:else if doc.expira_in_zile !== null}
											{doc.expira_in_zile === 0 ? 'Azi' : doc.expira_in_zile + 'z'}
										{:else}
											—
										{/if}
									</span>
								</div>
							</div>
							{#if doc.data_sfarsit}
								<p class="text-xs mt-2 ml-9" style="color: var(--muted)">
									Valabil până la {formatData(doc.data_sfarsit)}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- ② Facturi service -->
		<section>
			<h2 class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--muted)">
				Facturi service
			</h2>

			{#if facturi.length === 0}
				<div class="rounded-2xl border p-5 text-center" style="border-color: var(--border); background: var(--surface)">
					<p class="text-2xl mb-1">🧾</p>
					<p class="text-sm" style="color: var(--muted)">Nu ai facturi disponibile.</p>
				</div>
			{:else}
				<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border)">
					{#each facturi as f, i}
						{@const sb = statusStyle(f)}
						<button
							type="button"
							onclick={() => goto(`/dashboard/documente/${f.id}`)}
							class="w-full text-left flex items-center gap-3 px-4 py-3.5 {i > 0 ? 'border-t' : ''} hover:opacity-90 transition-opacity"
							style="background: var(--surface); border-color: var(--border);">
							<span class="text-lg shrink-0">{f.tip_document === 'storno' ? '↺' : '🧾'}</span>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<p class="text-sm font-semibold" style="color: var(--text)">
										{f.tip_label} {f.numar_complet}
									</p>
									<span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
										style="background: {sb.bg}; color: {sb.text}; border: 1px solid {sb.border}">
										{f.status_label}
									</span>
								</div>
								<p class="text-xs mt-0.5" style="color: var(--muted)">
									{formatData(f.data_factura)}{f.masina ? ' · ' + f.masina.numar_inmatriculare : ''}
								</p>
								{#if f.is_restanta && f.data_scadenta}
									<p class="text-xs mt-0.5 font-medium" style="color: #ef4444">
										Scadență depășită: {formatData(f.data_scadenta)}
									</p>
								{/if}
							</div>
							<div class="shrink-0 text-right">
								<p class="text-sm font-bold font-mono" style="color: var(--text)">
									{f.tip_document === 'storno' ? '-' : ''}{formatBani(Math.abs(f.total))}
								</p>
								<p class="text-[10px] mt-0.5" style="color: var(--muted)">{f.moneda}</p>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</section>

	{/if}
</div>
