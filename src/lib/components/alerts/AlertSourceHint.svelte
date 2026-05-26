<script lang="ts">
	import type { AlertSummaryItem } from '$lib/api';

	let { document, hasExisting }: {
		document: AlertSummaryItem | null | undefined;
		hasExisting: boolean;
	} = $props();
</script>

{#if document?.source === 'wms' && document.data_expirare}
	<div class="flex items-start gap-2 px-3 py-2.5 rounded-xl" style="background: #3b82f610; border: 1px solid #3b82f625;">
		<span class="text-xs shrink-0 mt-0.5">✅</span>
		<p class="text-xs" style="color: var(--muted)">Am găsit această dată pentru tine.</p>
	</div>

{:else if document?.source === 'client' && hasExisting}
	<div class="flex items-start gap-2 px-3 py-2.5 rounded-xl" style="background: var(--surface2); border: 1px solid var(--border);">
		<span class="text-xs shrink-0 mt-0.5">✏️</span>
		<p class="text-xs" style="color: var(--muted)">Data este setată de tine.</p>
	</div>

{:else if !hasExisting}
	<div class="px-3 py-3 rounded-xl" style="background: var(--surface2); border: 1px solid var(--border);">
		<p class="text-xs font-semibold mb-1" style="color: var(--text)">Nu avem încă această informație.</p>
		<p class="text-xs" style="color: var(--muted)">O poți adăuga, iar noi te anunțăm din timp.</p>
	</div>
{/if}
