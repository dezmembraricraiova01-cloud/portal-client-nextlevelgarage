<script lang="ts">
	import type { AlertSummaryItem } from '$lib/api';

	let { document, onapply, saving = false }: {
		document: AlertSummaryItem;
		onapply: () => void;
		saving?: boolean;
	} = $props();

	function formatData(iso: string | null | undefined): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
	}
</script>

<div class="px-3 py-3 rounded-xl space-y-2" style="background: #3b82f610; border: 1px solid #3b82f625;">
	<p class="text-xs font-semibold" style="color: #3b82f6">💡 Am găsit o dată diferită</p>
	<div class="space-y-1">
		<p class="text-xs" style="color: var(--muted)">
			Recomandarea noastră: <span class="font-semibold" style="color: var(--text)">{formatData(document.wms_date)}</span>
		</p>
		<p class="text-xs" style="color: var(--muted)">
			Tu ai setat: <span class="font-semibold" style="color: var(--text)">{formatData(document.client_date)}</span>
		</p>
	</div>
	<button
		onclick={onapply}
		disabled={saving}
		class="w-full py-2 rounded-xl text-xs font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
		style="background: #3b82f6; color: white;">
		{saving ? 'Se actualizează...' : 'Folosește această recomandare'}
	</button>
</div>
