<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, type FacturaDetalii } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';

	let factura     = $state<FacturaDetalii | null>(null);
	let loading     = $state(true);
	let error       = $state('');
	let downloading = $state(false);

	const facturaId = Number(page.params.id);

	onMount(async () => {
		try {
			factura = await api.factura(facturaId);
		} catch (e: any) {
			error = e?.message ?? 'Factura nu este disponibilă.';
		} finally {
			loading = false;
		}
	});

	async function downloadPdf() {
		if (!factura) return;
		downloading = true;
		try {
			await api.downloadPdf(factura.id, `factura-${factura.numar_complet}.pdf`);
		} catch {
			error = 'PDF indisponibil momentan.';
		} finally {
			downloading = false;
		}
	}

	function statusStyle(f: FacturaDetalii) {
		if (f.tip_document === 'storno') return { bg: '#ef444418', text: '#ef4444', border: '#ef444440' };
		if (f.status === 'incasata')     return { bg: '#10b98118', text: '#10b981', border: '#10b98140' };
		if (f.is_restanta)               return { bg: '#ef444418', text: '#ef4444', border: '#ef444440' };
		return { bg: '#3b82f618', text: '#3b82f6', border: '#3b82f640' };
	}

	function formatData(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function formatBani(n: number): string {
		return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<div class="space-y-4 pb-4">

	<button onclick={() => goto('/dashboard/documente')}
		class="flex items-center gap-2 text-sm font-medium hover:opacity-80"
		style="color: var(--muted)">
		<span>←</span>
		<span>Înapoi la documente</span>
	</button>

	{#if loading}
		<div class="space-y-3">
			<Skeleton height="h-7" class="w-48" />
			<Skeleton height="h-4" class="w-32" />
			<div class="rounded-2xl border p-5 space-y-3" style="border-color: var(--border); background: var(--surface)">
				<Skeleton height="h-12" class="w-full" />
				<Skeleton height="h-12" class="w-full" />
				<Skeleton height="h-12" class="w-full" />
			</div>
		</div>
	{:else if error || !factura}
		<div class="rounded-2xl border p-6 text-center" style="border-color: var(--border); background: var(--surface)">
			<p class="text-3xl mb-2">⚠️</p>
			<p class="text-sm" style="color: var(--muted)">{error || 'Factura nu există.'}</p>
		</div>
	{:else}

		<!-- HEADER -->
		<div class="space-y-2">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h1 class="text-xl font-bold" style="color: var(--text)">
						{factura.tip_label} {factura.numar_complet}
					</h1>
					<p class="text-xs mt-1" style="color: var(--muted)">
						Emisă pe {formatData(factura.data_factura)}
					</p>
				</div>
				{#snippet statusBadge()}
					{@const sb = statusStyle(factura!)}
					<span class="text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider whitespace-nowrap"
						style="background: {sb.bg}; color: {sb.text}; border: 1px solid {sb.border}">
						{factura!.status_label}
					</span>
				{/snippet}
				{@render statusBadge()}
			</div>

			{#if factura.data_scadenta}
				<p class="text-xs" style="color: {factura.is_restanta ? '#ef4444' : 'var(--muted)'}">
					{factura.is_restanta ? '⚠️ Scadență depășită: ' : 'Scadență: '}
					<strong>{formatData(factura.data_scadenta)}</strong>
				</p>
			{/if}

			{#if factura.parent}
				<p class="text-xs" style="color: var(--muted)">
					Referință: {factura.parent.numar_complet}
				</p>
			{/if}
		</div>

		<!-- VEHICUL ASOCIAT -->
		{#if factura.masina}
			<div class="rounded-2xl border p-4" style="border-color: var(--border); background: var(--surface)">
				<p class="text-xs font-semibold uppercase tracking-widest mb-1" style="color: var(--muted)">Vehicul</p>
				<p class="text-sm font-semibold" style="color: var(--text)">
					{factura.masina.marca} {factura.masina.model}
				</p>
				<p class="text-xs mt-0.5 font-mono" style="color: var(--muted)">
					{factura.masina.numar_inmatriculare}
				</p>
			</div>
		{/if}

		<!-- LINII -->
		<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border)">
			<div class="px-4 py-3 border-b" style="background: var(--surface); border-color: var(--border)">
				<p class="text-xs font-semibold uppercase tracking-widest" style="color: var(--muted)">
					Detalii ({factura.linii.length} {factura.linii.length === 1 ? 'linie' : 'linii'})
				</p>
			</div>
			{#each factura.linii as l, i}
				<div class="px-4 py-3 {i > 0 ? 'border-t' : ''}"
					style="background: var(--surface); border-color: var(--border);">
					<div class="flex justify-between gap-3 items-start">
						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium" style="color: var(--text)">
								{l.descriere}
							</p>
							<p class="text-xs mt-0.5" style="color: var(--muted)">
								{formatBani(l.cantitate)} × {formatBani(l.pret_unitar)} · TVA {Math.round(l.tva_procent)}%
							</p>
						</div>
						<div class="text-right shrink-0">
							<p class="text-sm font-bold font-mono" style="color: var(--text)">
								{formatBani(l.total_cu_tva)}
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- TOTALURI -->
		<div class="rounded-2xl border p-4 space-y-2" style="border-color: var(--border); background: var(--surface)">
			<div class="flex justify-between text-sm">
				<span style="color: var(--muted)">Subtotal (fără TVA)</span>
				<span class="font-mono font-medium" style="color: var(--text)">{formatBani(factura.subtotal)}</span>
			</div>
			<div class="flex justify-between text-sm">
				<span style="color: var(--muted)">TVA {Math.round(factura.tva_procent)}%</span>
				<span class="font-mono font-medium" style="color: var(--text)">{formatBani(factura.tva_valoare)}</span>
			</div>
			<div class="flex justify-between pt-2 border-t" style="border-color: var(--border)">
				<span class="font-bold text-base" style="color: var(--text)">Total</span>
				<span class="font-mono font-extrabold text-lg" style="color: var(--text)">
					{factura.tip_document === 'storno' ? '-' : ''}{formatBani(Math.abs(factura.total))} {factura.moneda}
				</span>
			</div>
		</div>

		{#if factura.observatii}
			<div class="rounded-2xl border p-4" style="border-color: var(--border); background: var(--surface)">
				<p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--muted)">Observații</p>
				<p class="text-sm italic" style="color: var(--text)">{factura.observatii}</p>
			</div>
		{/if}

		<!-- DOWNLOAD PDF -->
		<button
			onclick={downloadPdf}
			disabled={downloading}
			class="w-full py-3 rounded-xl font-bold text-sm transition disabled:opacity-50"
			style="background: var(--accent); color: white;">
			{downloading ? 'Se descarcă...' : '↓ Descarcă PDF'}
		</button>

	{/if}
</div>
