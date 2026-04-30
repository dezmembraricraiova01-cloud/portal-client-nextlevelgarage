<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { api, type WorkOrder, type TimelineStep, type Feedback } from '$lib/api';

	const uid = $derived($page.params.uid);
	let wo = $state<WorkOrder | null>(null);
	let timeline = $state<TimelineStep[]>([]);
	let feedback = $state<Feedback | null>(null);
	let loading = $state(true);
	let actionMsg = $state('');
	let actionLoading = $state(false);

	onMount(async () => {
		const res = await api.reparatie(uid);
		wo = res.wo; timeline = res.timeline; feedback = res.feedback;
		loading = false;
	});

	async function action(fn: () => Promise<any>) {
		actionLoading = true;
		try {
			const res = await fn();
			actionMsg = res.message;
			const refreshed = await api.reparatie(uid);
			wo = refreshed.wo; timeline = refreshed.timeline;
		} catch (e: any) { actionMsg = e.message; }
		finally { actionLoading = false; }
	}
</script>

{#if loading}
	<div class="flex justify-center py-20">
		<div class="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
	</div>
{:else if wo}
	<div class="space-y-6">
		<div class="flex items-center gap-3">
			<a href="/dashboard/reparatii" class="text-sm" style="color: var(--muted)">← Înapoi</a>
		</div>

		<div class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
			<p class="font-bold text-lg" style="color: var(--text)">{wo.masina?.numar_inmatriculare}</p>
			<p class="text-sm" style="color: var(--muted)">{wo.masina?.marca} {wo.masina?.model}</p>
			{#if wo.reception_at}
				<p class="text-xs mt-1" style="color: var(--muted)">
					Recepție: {new Date(wo.reception_at).toLocaleDateString('ro-RO')}
				</p>
			{/if}
		</div>

		<!-- Timeline -->
		<section>
			<h2 class="text-xs font-semibold uppercase tracking-widest mb-4" style="color: var(--muted)">Progres</h2>
			<div class="space-y-3">
				{#each timeline as step, i}
					<div class="flex items-start gap-3">
						<div class="flex flex-col items-center">
							<div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
								style="background: {step.done ? (step.declined ? '#ef444433' : '#22c55e33') : 'var(--surface2)'}; color: {step.done ? (step.declined ? 'var(--red)' : 'var(--green)') : 'var(--muted)'}; border: 1px solid {step.done ? (step.declined ? 'var(--red)' : 'var(--green)') : 'var(--border)'}">
								{step.done ? (step.declined ? '✕' : '✓') : i + 1}
							</div>
							{#if i < timeline.length - 1}
								<div class="w-px flex-1 mt-1" style="background: var(--border); min-height: 16px;"></div>
							{/if}
						</div>
						<div class="pb-3">
							<p class="text-sm font-medium" style="color: {step.active ? 'var(--accent)' : 'var(--text)'}">{step.label}</p>
							{#if step.sublabel}<p class="text-xs" style="color: var(--muted)">{step.sublabel}</p>{/if}
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Deviz actions -->
		{#if wo.deviz_trimis_la && !wo.deviz_aprobat_la && !wo.deviz_refuzat_la}
			<section class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
				<h2 class="font-semibold text-sm" style="color: var(--text)">Deviz în așteptare</h2>
				<p class="text-xs" style="color: var(--muted)">Vă rugăm să aprobați sau refuzați devizul de reparație.</p>
				{#if actionMsg}<p class="text-xs text-blue-400">{actionMsg}</p>{/if}
				<div class="flex gap-2">
					<button onclick={() => action(() => api.aprobaDeviz(uid))} disabled={actionLoading}
						class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
						style="background: var(--green); color: white;">Aprobă</button>
					<button onclick={() => action(() => api.refuzaDeviz(uid))} disabled={actionLoading}
						class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
						style="background: var(--surface2); color: var(--red); border: 1px solid var(--border);">Refuză</button>
				</div>
				<button onclick={() => action(() => api.intrebareDeviz(uid, ''))} disabled={actionLoading}
					class="w-full py-2 rounded-xl text-sm disabled:opacity-40"
					style="color: var(--muted);">Am o întrebare →</button>
			</section>
		{/if}

		{#if feedback}
			<section class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
				<h2 class="font-semibold text-sm mb-2" style="color: var(--text)">Feedback-ul tău</h2>
				<div class="flex gap-1 mb-1">
					{#each [1,2,3,4,5] as s}
						<span style="color: {s <= feedback.rating ? '#eab308' : 'var(--border)'}">★</span>
					{/each}
				</div>
				{#if feedback.comentariu}<p class="text-xs" style="color: var(--muted)">{feedback.comentariu}</p>{/if}
			</section>
		{/if}
	</div>
{/if}
