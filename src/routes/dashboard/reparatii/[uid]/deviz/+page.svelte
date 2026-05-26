<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, type WorkOrder } from '$lib/api';

	const uid = $derived(page.params.uid!);

	let wo            = $state<WorkOrder | null>(null);
	let loading       = $state(true);
	let loadError     = $state('');
	let actionMsg     = $state('');
	let actionError   = $state('');
	let actionLoading = $state(false);

	let showIntrebare  = $state(false);
	let intrebareMesaj = $state('');
	let confirmRefuz   = $state(false);

	let idsAprobate = $state<Set<number>>(new Set());

	function initSelectie() {
		if (!wo?.costuri?.length) return;
		const niciUnul = wo.costuri.every(c => c.aprobat_client === null);
		idsAprobate = new Set(
			niciUnul
				? wo.costuri.map(c => c.id)
				: wo.costuri.filter(c => c.aprobat_client).map(c => c.id)
		);
	}

	function toggleItem(id: number) {
		const next = new Set(idsAprobate);
		next.has(id) ? next.delete(id) : next.add(id);
		idsAprobate = next;
	}

	const totalSelectat = $derived(
		wo?.costuri?.filter(c => idsAprobate.has(c.id)).reduce((s, c) => s + c.total, 0) ?? 0
	);

	onMount(async () => {
		try {
			const res = await api.reparatie(uid);
			wo = res.wo;
			initSelectie();
			// Dacă devizul nu mai e în așteptare, redirecționăm la reparație
			if (wo && (!wo.deviz_trimis_la || wo.deviz_aprobat_la || wo.deviz_refuzat_la)) {
				goto(`/dashboard/reparatii/${uid}`, { replaceState: true });
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
			initSelectie();
			showIntrebare = false;
			confirmRefuz = false;
			intrebareMesaj = '';
		} catch (e: any) {
			actionError = e.message ?? 'Eroare. Încearcă din nou.';
		} finally {
			actionLoading = false;
		}
	}

	const devizFinalizat = $derived(
		wo ? (!!wo.deviz_aprobat_la || !!wo.deviz_refuzat_la) : false
	);
</script>

<!-- Header minimal -->
<div class="flex items-center gap-3 px-4 py-3 sticky top-0 z-10" style="background: var(--bg); border-bottom: 1px solid var(--border);">
	<a href="/dashboard/reparatii/{uid}"
		class="flex items-center justify-center w-8 h-8 rounded-full transition-opacity active:opacity-60"
		style="background: var(--surface2); color: var(--text);">
		←
	</a>
	<div class="flex-1 min-w-0">
		{#if wo}
			<p class="text-sm font-semibold leading-tight truncate" style="color: var(--text)">
				{wo.masina?.marca} {wo.masina?.model}
			</p>
			<p class="text-xs font-mono" style="color: var(--muted)">{wo.masina?.numar_inmatriculare}</p>
		{:else}
			<p class="text-sm font-semibold" style="color: var(--text)">Deviz</p>
		{/if}
	</div>
	{#if wo?.deviz_trimis_la}
		<span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
			style="background:#eab30820; color:#eab308; border:1px solid #eab30840;">
			⚠️ În așteptare
		</span>
	{/if}
</div>

<div class="pb-8">

	{#if loading}
		<div class="flex flex-col items-center justify-center py-24 gap-3">
			<div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color: var(--border); border-top-color: var(--accent);"></div>
			<p class="text-sm" style="color: var(--muted)">Se încarcă devizul...</p>
		</div>

	{:else if loadError}
		<div class="mx-4 mt-6 p-4 rounded-2xl" style="background:#ef444412; border:1px solid #ef444430;">
			<p class="text-sm" style="color:#ef4444">{loadError}</p>
		</div>

	{:else if wo && !devizFinalizat}
		{@const items = wo.costuri ?? []}

		{#if items.length === 0}
			<!-- ── Deviz simplu, fără iteme ── -->
			<div class="px-4 mt-6 space-y-4">
				<div>
					<h1 class="text-lg font-bold" style="color: var(--text)">Deviz în așteptare</h1>
					<p class="text-sm mt-1" style="color: var(--muted)">
						Aprobă sau refuză devizul de reparație.
						{#if wo.deviz_trimis_la}
							Trimis pe {new Date(wo.deviz_trimis_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}.
						{/if}
					</p>
				</div>

				{#if wo.deviz_status === 'question_requested'}
					<div class="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style="background:#3b82f612; border:1px solid #3b82f630;">
						<span class="text-sm shrink-0" style="color:#3b82f6">ℹ</span>
						<p class="text-xs" style="color:#3b82f6">Ai trimis o întrebare echipei. Poți în continuare aproba sau refuza devizul.</p>
					</div>
				{/if}

				{#if actionMsg}
					<p class="text-xs px-3 py-2 rounded-xl" style="background:#22c55e12; color:#22c55e">{actionMsg}</p>
				{/if}
				{#if actionError}
					<p class="text-xs px-3 py-2 rounded-xl" style="background:#ef444412; color:#ef4444">{actionError}</p>
				{/if}

				{#if !confirmRefuz}
					<div class="flex gap-2">
						<button onclick={() => action(() => api.aprobaDeviz(uid, []))} disabled={actionLoading}
							class="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
							style="background: #22c55e; color: white;">
							{actionLoading ? '...' : '✓ Aprobă devizul'}
						</button>
						<button onclick={() => confirmRefuz = true} disabled={actionLoading}
							class="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
							style="background: var(--surface2); color: #ef4444; border: 1px solid var(--border);">
							Refuză
						</button>
					</div>
				{:else}
					<div class="p-4 rounded-2xl space-y-3" style="background:#ef444410; border:1px solid #ef444430;">
						<p class="text-sm font-medium text-center" style="color:#ef4444">Confirmi refuzul devizului?</p>
						<div class="flex gap-2">
							<button onclick={() => confirmRefuz = false}
								class="flex-1 py-2.5 rounded-xl text-sm"
								style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
								Nu, înapoi
							</button>
							<button onclick={() => action(() => api.refuzaDeviz(uid))} disabled={actionLoading}
								class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
								style="background: #ef4444; color: white;">
								{actionLoading ? '...' : 'Da, refuz'}
							</button>
						</div>
					</div>
				{/if}

				{#if !showIntrebare}
					<button onclick={() => showIntrebare = true} disabled={actionLoading}
						class="w-full py-2 text-sm disabled:opacity-40"
						style="color: var(--muted);">Am o întrebare despre deviz →</button>
				{:else}
					<div class="space-y-2">
						<textarea bind:value={intrebareMesaj} rows="3"
							placeholder="Descrie întrebarea ta..."
							class="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
							style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);"></textarea>
						<div class="flex gap-2">
							<button onclick={() => { showIntrebare = false; intrebareMesaj = ''; }}
								class="py-2.5 px-4 rounded-xl text-sm"
								style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
								Anulează
							</button>
							<button onclick={() => action(() => api.intrebareDeviz(uid, intrebareMesaj))} disabled={actionLoading}
								class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
								style="background: var(--accent); color: white;">
								{actionLoading ? '...' : 'Trimite întrebarea'}
							</button>
						</div>
					</div>
				{/if}
			</div>

		{:else}
			<!-- ── Deviz granular cu iteme individuale ── -->
			<div class="px-4 mt-6 mb-2">
				<h1 class="text-lg font-bold" style="color: var(--text)">Deviz în așteptare</h1>
				<p class="text-sm mt-1" style="color: var(--muted)">
					Bifează lucrările pe care dorești să le efectuăm.
					{#if wo.deviz_trimis_la}
						Trimis pe {new Date(wo.deviz_trimis_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}.
					{/if}
				</p>
			</div>

			{#if wo.deviz_status === 'question_requested'}
				<div class="mx-4 mb-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style="background:#3b82f612; border:1px solid #3b82f630;">
					<span class="text-sm shrink-0" style="color:#3b82f6">ℹ</span>
					<p class="text-xs" style="color:#3b82f6">Ai trimis o întrebare echipei. Poți în continuare aproba sau refuza devizul.</p>
				</div>
			{/if}

			<div class="px-4 space-y-2 pb-52">
				{#each items as item}
					<button
						onclick={() => toggleItem(item.id)}
						disabled={actionLoading}
						class="w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.98] disabled:opacity-40"
						style="background:{idsAprobate.has(item.id) ? '#22c55e0d' : 'var(--surface)'}; border-color:{idsAprobate.has(item.id) ? '#22c55e60' : 'var(--border)'};">
						<div class="flex items-start gap-3">
							<div class="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-all"
								style="background:{idsAprobate.has(item.id) ? '#22c55e' : 'var(--surface2)'}; border:1.5px solid {idsAprobate.has(item.id) ? '#22c55e' : 'var(--border)'};">
								{#if idsAprobate.has(item.id)}
									<span class="text-white text-xs leading-none">✓</span>
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="text-sm font-medium leading-tight" style="color: var(--text)">{item.descriere}</span>
									<span class="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide"
										style="background: var(--surface2); color: var(--muted);">
										{item.tip === 'piesa' ? 'Piesă' : item.tip === 'manopera' ? 'Manoperă' : item.tip}
									</span>
								</div>
								<p class="text-xs mt-1" style="color: var(--muted)">
									{item.cantitate} × {item.pret_unitar.toFixed(2)} RON
								</p>
							</div>
							<span class="text-sm font-bold shrink-0" style="color:{idsAprobate.has(item.id) ? '#22c55e' : 'var(--muted)'}">
								{item.total.toFixed(2)} RON
							</span>
						</div>
					</button>
				{/each}
			</div>

			<!-- Footer sticky cu acțiuni -->
			<div class="fixed bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-4 space-y-3"
				style="background: var(--bg); border-top: 1px solid var(--border); box-shadow: 0 -8px 32px #0008;">

				<div class="flex justify-between items-center">
					<span class="text-sm" style="color: var(--muted)">{idsAprobate.size} din {items.length} selectate</span>
					<span class="text-xl font-bold" style="color: var(--text)">{totalSelectat.toFixed(2)} RON</span>
				</div>

				{#if actionMsg}
					<p class="text-xs text-center px-3 py-2 rounded-xl" style="background:#22c55e12; color:#22c55e">{actionMsg}</p>
				{/if}
				{#if actionError}
					<p class="text-xs text-center px-3 py-2 rounded-xl" style="background:#ef444412; color:#ef4444">{actionError}</p>
				{/if}

				{#if !confirmRefuz && !showIntrebare}
					<div class="flex gap-2">
						<button
							onclick={() => action(() => api.aprobaDeviz(uid, [...idsAprobate]))}
							disabled={actionLoading || idsAprobate.size === 0}
							class="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
							style="background: #22c55e; color: white;">
							{actionLoading ? '...' : '✓ Confirmă selecția'}
						</button>
						<button
							onclick={() => { confirmRefuz = true; showIntrebare = false; }}
							disabled={actionLoading}
							class="py-3 px-4 rounded-xl text-sm font-semibold disabled:opacity-40"
							style="background: var(--surface2); color: #ef4444; border: 1px solid var(--border);">
							Refuză tot
						</button>
					</div>
					<button onclick={() => { showIntrebare = true; confirmRefuz = false; }} disabled={actionLoading}
						class="w-full py-1.5 text-sm disabled:opacity-40"
						style="color: var(--muted);">Am o întrebare despre deviz →</button>

				{:else if confirmRefuz}
					<div class="p-4 rounded-2xl space-y-3" style="background:#ef444410; border:1px solid #ef444430;">
						<p class="text-sm font-medium text-center" style="color:#ef4444">Confirmi refuzul întregului deviz?</p>
						<div class="flex gap-2">
							<button onclick={() => confirmRefuz = false}
								class="flex-1 py-2.5 rounded-xl text-sm"
								style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
								Nu, înapoi
							</button>
							<button onclick={() => action(() => api.refuzaDeviz(uid))} disabled={actionLoading}
								class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
								style="background: #ef4444; color: white;">
								{actionLoading ? '...' : 'Da, refuz totul'}
							</button>
						</div>
					</div>

				{:else if showIntrebare}
					<div class="space-y-2">
						<textarea bind:value={intrebareMesaj} rows="2"
							placeholder="Descrie întrebarea ta..."
							class="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
							style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);"></textarea>
						<div class="flex gap-2">
							<button onclick={() => { showIntrebare = false; intrebareMesaj = ''; }}
								class="py-2.5 px-4 rounded-xl text-sm"
								style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
								Anulează
							</button>
							<button onclick={() => action(() => api.intrebareDeviz(uid, intrebareMesaj))} disabled={actionLoading}
								class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
								style="background: var(--accent); color: white;">
								{actionLoading ? '...' : 'Trimite întrebarea'}
							</button>
						</div>
					</div>
				{/if}

			</div>
		{/if}

	{:else if wo && devizFinalizat}
		<!-- Deviz deja procesat -->
		<div class="px-4 mt-6">
			{#if wo.deviz_aprobat_la}
				<div class="p-4 rounded-2xl" style="background:#22c55e12; border:1px solid #22c55e30;">
					<p class="font-semibold text-sm" style="color:#22c55e">✓ Devizul a fost aprobat</p>
					<p class="text-xs mt-1" style="color: var(--muted)">
						pe {new Date(wo.deviz_aprobat_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
					</p>
				</div>
			{:else if wo.deviz_refuzat_la}
				<div class="p-4 rounded-2xl" style="background:#ef444412; border:1px solid #ef444430;">
					<p class="font-semibold text-sm" style="color:#ef4444">✕ Devizul a fost refuzat</p>
					<p class="text-xs mt-1" style="color: var(--muted)">
						pe {new Date(wo.deviz_refuzat_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
					</p>
				</div>
			{/if}
			<a href="/dashboard/reparatii/{uid}"
				class="flex items-center justify-center gap-2 w-full py-3 mt-4 rounded-xl font-semibold text-sm"
				style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);">
				← Înapoi la reparație
			</a>
		</div>
	{/if}

</div>
