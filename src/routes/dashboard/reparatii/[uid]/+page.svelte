<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, formatActualizare, type WorkOrder, type TimelineStep, type Feedback } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';
	import ProgressStepper from '$lib/ProgressStepper.svelte';
	import ChatPortal from '$lib/ChatPortal.svelte';

	const uid = $derived(page.params.uid!);
	let wo            = $state<WorkOrder | null>(null);
	let timeline      = $state<TimelineStep[]>([]);
	let feedback      = $state<Feedback | null>(null);
	let loading       = $state(true);
	let actionMsg     = $state('');
	let actionError   = $state('');
	let actionLoading = $state(false);

	let showIntrebare  = $state(false);
	let intrebareMesaj = $state('');
	let confirmRefuz   = $state(false);

	let idsAprobate = $state<Set<number>>(new Set());

	function initDevizSelectie() {
		if (!wo?.costuri?.length) return;
		const niciUnuBifat = wo.costuri.every(c => c.aprobat_client === null);
		idsAprobate = new Set(
			niciUnuBifat
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

	let ratingHover    = $state(0);
	let ratingSelectat = $state(0);
	let comentariu     = $state('');
	let feedbackSaving = $state(false);
	let feedbackError  = $state('');

	let loadError  = $state('');
	let chatOpen   = $state(false);
	let chatUnread = $state(0);

	onMount(async () => {
		try {
			const res = await api.reparatie(uid);
			wo = res.wo; timeline = res.timeline; feedback = res.feedback;
			// Auto-redirect la pagini dedicate pentru semantică curată
			if (wo?.dept === 'VM') {
				await goto(`/dashboard/oferte/${uid}`, { replaceState: true });
				return;
			}
			if (wo?.dept === 'MS') {
				await goto(`/dashboard/masini-schimb/${uid}`, { replaceState: true });
				return;
			}
			initDevizSelectie();
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
			wo = refreshed.wo; timeline = refreshed.timeline;
			initDevizSelectie();
			showIntrebare = false;
			confirmRefuz = false;
			intrebareMesaj = '';
		} catch (e: any) {
			actionError = e.message ?? 'Eroare. Încearcă din nou.';
		} finally {
			actionLoading = false;
		}
	}

	async function trimitereFeedback() {
		if (!ratingSelectat) return;
		feedbackError = '';
		feedbackSaving = true;
		try {
			feedback = await api.submitFeedback(uid, ratingSelectat, comentariu || undefined);
		} catch (e: any) {
			feedbackError = e.message ?? 'Eroare la trimitere.';
		} finally {
			feedbackSaving = false;
		}
	}

	const totalAprobatDeviz = $derived(
		wo?.costuri?.filter(i => i.aprobat_client !== false).reduce((s, i) => s + i.total, 0) ?? 0
	);

	const poateFeedback = $derived(
		wo && ['finalizat', 'livrat'].includes(wo.status) && !feedback
	);

	const nextStep = $derived(timeline.find(s => !s.done) ?? null);
	const statusColor = $derived(
		wo?.portal_color === 'green' ? '#22c55e' :
		wo?.portal_color === 'red'   ? '#ef4444' :
		wo?.portal_color === 'yellow'? '#eab308' : 'var(--text)'
	);

	const devizStatusInfo = $derived((): { label: string; color: string } | null => {
		if (!wo?.deviz_trimis_la) return null;
		switch (wo.deviz_status) {
			case 'pending':            return { label: 'Aștepți aprobare',   color: '#eab308' };
			case 'question_requested': return { label: 'Întrebare trimisă',  color: '#3b82f6' };
			case 'approved':           return { label: 'Aprobat',            color: '#22c55e' };
			case 'declined':
			case 'rejected':           return { label: 'Refuzat',            color: '#ef4444' };
			default:                   return { label: 'Deviz trimis',       color: '#eab308' };
		}
	});
</script>

{#if loading}
	<div class="space-y-6 pb-4">
		<Skeleton height="h-3" class="w-16" />
		<div class="p-4 rounded-2xl border space-y-2" style="background: var(--surface); border-color: var(--border);">
			<Skeleton height="h-5" class="w-32" />
			<Skeleton height="h-3" class="w-40" />
			<Skeleton height="h-3" class="w-24" />
		</div>
		<div class="space-y-3">
			{#each Array(5) as _}
				<div class="flex items-start gap-3">
					<Skeleton height="h-7" class="w-7 shrink-0" rounded="rounded-full" />
					<div class="flex-1 space-y-1.5 pt-1">
						<Skeleton height="h-3" class="w-28" />
					</div>
				</div>
			{/each}
		</div>
	</div>

{:else if loadError}
	<div class="py-16 text-center space-y-2">
		<p class="text-2xl">⚠️</p>
		<p class="text-sm" style="color: var(--muted)">{loadError}</p>
		<a href="/dashboard/reparatii" class="text-sm" style="color: var(--accent)">← Înapoi</a>
	</div>

{:else if wo}
	<div class="space-y-6 pb-4">
		<a href="/dashboard/reparatii" class="text-sm" style="color: var(--muted)">← Înapoi</a>

		<!-- Header mașină -->
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
			<h2 class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--muted)">Progres</h2>
			<ProgressStepper steps={timeline} />
		</section>

		<!-- Info cards -->
		<div class="grid grid-cols-2 gap-3">
			<div class="p-3.5 rounded-2xl" style="background: var(--surface);">
				<p class="text-xs mb-1" style="color: var(--muted)">Status</p>
				<p class="text-sm font-semibold" style="color: {statusColor}">{wo.portal_label ?? wo.status}</p>
			</div>
			{#if wo.reception_at}
				<div class="p-3.5 rounded-2xl" style="background: var(--surface);">
					<p class="text-xs mb-1" style="color: var(--muted)">Recepție</p>
					<p class="text-sm font-semibold" style="color: var(--text)">
						{new Date(wo.reception_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
					</p>
				</div>
			{/if}
			{#if wo.predare_la}
				<div class="p-3.5 rounded-2xl" style="background: var(--surface);">
					<p class="text-xs mb-1" style="color: var(--muted)">Predare estimată</p>
					<p class="text-sm font-semibold" style="color: var(--accent)">
						{new Date(wo.predare_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
					</p>
				</div>
			{/if}
			{#if wo.ultima_actualizare}
				<div class="p-3.5 rounded-2xl" style="background: var(--surface);">
					<p class="text-xs mb-1" style="color: var(--muted)">Ultima actualizare</p>
					<p class="text-sm font-semibold" style="color: var(--text)">{formatActualizare(wo.ultima_actualizare)}</p>
				</div>
			{/if}
			{#if devizStatusInfo()}
				{@const dsi = devizStatusInfo()!}
				<div class="p-3.5 rounded-2xl" style="background: var(--surface);">
					<p class="text-xs mb-1" style="color: var(--muted)">Deviz</p>
					<p class="text-sm font-semibold" style="color: {dsi.color}">{dsi.label}</p>
				</div>
			{/if}
			{#if nextStep}
				<div class="p-3.5 rounded-2xl" style="background: var(--surface);">
					<p class="text-xs mb-1" style="color: var(--muted)">Următorul pas</p>
					<p class="text-sm font-semibold" style="color: var(--accent)">{nextStep.label}</p>
				</div>
			{/if}
		</div>

		<!-- ═══════════════════════════════════════
		     VM — Ofertă vânzare mașină
		     ═══════════════════════════════════════ -->
		{#if wo.dept === 'VM' && wo.vm}
			{@const m = wo.vm.masina}
			{@const f = wo.vm.factura}
			<section class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
				<div>
					<h2 class="font-semibold text-sm" style="color: var(--text)">Ofertă vânzare</h2>
					<p class="text-xs mt-0.5" style="color: var(--muted)">Mașină din parcul intern, pregătită pentru tine.</p>
				</div>

				{#if m}
					<div class="p-3 rounded-xl" style="background: var(--bg);">
						<p class="font-bold text-base" style="color: var(--text)">{m.marca ?? ''} {m.model ?? ''} {m.an ? `· ${m.an}` : ''}</p>
						{#if m.numar_inmatriculare}
							<p class="text-xs mt-0.5" style="color: var(--muted)">Nr.: {m.numar_inmatriculare}</p>
						{/if}
						{#if m.vin}
							<p class="text-xs" style="color: var(--muted)">VIN: {m.vin}</p>
						{/if}
						<p class="text-xl font-extrabold mt-2" style="color: var(--accent)">
							{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: m.moneda || 'RON', minimumFractionDigits: 0 }).format(m.pret)}
						</p>
					</div>
				{/if}

				{#if wo.vm.stare_vanzare === 'avariata'}
					<div class="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style="background:#f59e0b12; border:1px solid #f59e0b30;">
						<span class="text-sm shrink-0" style="color:#f59e0b">⚠</span>
						<div class="text-xs" style="color:#f59e0b">
							<p class="font-bold mb-0.5">Mașina se vinde în stare avariată.</p>
							<pre class="whitespace-pre-wrap text-xs">{wo.vm.descriere_avarii ?? '—'}</pre>
						</div>
					</div>
				{/if}

				{#if f}
					<div class="text-xs px-3 py-2 rounded-xl flex items-center justify-between"
					     style="background: {f.tip === 'fiscala' ? '#22c55e12' : f.tip === 'proforma' ? '#3b82f612' : '#eab30812'}; color: {f.tip === 'fiscala' ? '#22c55e' : f.tip === 'proforma' ? '#3b82f6' : '#eab308'};">
						<span class="font-semibold">
							{#if f.tip === 'fiscala'}Factură fiscală
							{:else if f.tip === 'proforma'}Proformă
							{:else}Ofertă{/if}
							{f.numar}
						</span>
						<span>{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(f.total)}</span>
					</div>
				{/if}
			</section>
		{/if}

		<!-- ═══════════════════════════════════════
		     MS — Mașină schimb gratuită + upsell premium
		     ═══════════════════════════════════════ -->
		{#if wo.dept === 'MS' && wo.ms}
			{@const ms = wo.ms.masina_schimb}
			{@const premium = wo.ms.premium ?? []}
			<section class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
				<div>
					<h2 class="font-semibold text-sm" style="color: var(--text)">Mașină de schimb</h2>
					<p class="text-xs mt-0.5" style="color: var(--muted)">{wo.ms.mesaj_principal}</p>
				</div>

				{#if ms}
					<div class="p-3 rounded-xl flex items-start justify-between gap-3" style="background: #22c55e0d; border:1px solid #22c55e30;">
						<div>
							<p class="font-bold text-base" style="color: var(--text)">{ms.marca ?? ''} {ms.model ?? ''} {ms.an ? `· ${ms.an}` : ''}</p>
							{#if ms.clasa}
								<p class="text-xs mt-0.5" style="color: var(--muted)">Clasă: {ms.clasa}</p>
							{/if}
							{#if ms.numar_inmatriculare}
								<p class="text-xs" style="color: var(--muted)">Nr.: {ms.numar_inmatriculare}</p>
							{/if}
						</div>
						<span class="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
						      style="background:#22c55e20; color:#22c55e">GRATIS</span>
					</div>
				{/if}

				{#if premium.length > 0}
					<div class="space-y-2">
						<p class="text-xs font-semibold uppercase tracking-wide" style="color: var(--muted)">Vrei o gamă superioară? Plătești doar diferența</p>
						{#each premium as p (p.id)}
							<div class="p-3 rounded-xl flex items-start justify-between gap-3"
							     style="background: var(--bg); border:1px solid var(--border);">
								<div class="flex-1 min-w-0">
									<p class="font-bold text-sm" style="color: var(--text)">
										{p.marca ?? ''} {p.model ?? ''} {p.an ? `· ${p.an}` : ''}
									</p>
									<div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-0.5" style="color: var(--muted)">
										{#if p.clasa}<span>Clasă {p.clasa}</span>{/if}
										{#if p.tip_caroserie}<span>{p.tip_caroserie}</span>{/if}
										{#if p.transmisie}<span>{p.transmisie}</span>{/if}
										{#if p.nr_locuri}<span>{p.nr_locuri} locuri</span>{/if}
									</div>
									<p class="text-xs mt-1" style="color: var(--accent); font-weight:600;">
										+{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', minimumFractionDigits: 0 }).format(p.tarif_extra)}/zi extra
									</p>
								</div>
								<button type="button"
								        onclick={() => action(() => api.intrebareDeviz(uid, `Doresc upgrade la mașina premium: ${p.marca ?? ''} ${p.model ?? ''} (nr. ${p.numar_inmatriculare ?? '—'}). Diferența: ${p.tarif_extra} RON/zi.`))}
								        disabled={actionLoading}
								        class="text-xs font-semibold px-3 py-2 rounded-lg shrink-0"
								        style="background: var(--accent); color: white;">
									Cer această mașină
								</button>
							</div>
						{/each}
						<p class="text-xs" style="color: var(--muted)">După solicitare te contactăm pentru confirmare și plata diferenței.</p>
					</div>
				{:else}
					<div class="p-3 rounded-xl" style="background: var(--bg); border:1px dashed var(--border);">
						<p class="text-xs" style="color: var(--text)">Momentan nu sunt mașini premium disponibile peste cea actuală. Pentru cereri speciale contactează-ne pe chat.</p>
					</div>
				{/if}
			</section>
		{/if}

		<!-- ═══════════════════════════════════════
		     DEVIZ — în așteptare
		     ═══════════════════════════════════════ -->
		{#if wo.deviz_trimis_la && !wo.deviz_aprobat_la && !wo.deviz_refuzat_la}
			{@const items = wo.costuri ?? []}

			{#if items.length === 0}
				<!-- Fallback: deviz fără iteme detaliate -->
				<section class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
					<div>
						<h2 class="font-semibold text-sm" style="color: var(--text)">Deviz în așteptare</h2>
						<p class="text-xs mt-0.5" style="color: var(--muted)">
							Aprobă sau refuză devizul de reparație.{wo.deviz_trimis_la ? ` Trimis pe ${new Date(wo.deviz_trimis_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}.` : ''}
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
								class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
								style="background: #22c55e; color: white;">
								{actionLoading ? '...' : 'Aprobă'}
							</button>
							<button onclick={() => confirmRefuz = true} disabled={actionLoading}
								class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
								style="background: var(--surface2); color: #ef4444; border: 1px solid var(--border);">
								Refuză
							</button>
						</div>
					{:else}
						<div class="p-3 rounded-xl space-y-2.5" style="background:#ef444410; border:1px solid #ef444430;">
							<p class="text-xs font-medium text-center" style="color:#ef4444">Confirmi refuzul devizului?</p>
							<div class="flex gap-2">
								<button onclick={() => confirmRefuz = false}
									class="flex-1 py-2 rounded-xl text-sm"
									style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
									Nu, înapoi
								</button>
								<button onclick={() => action(() => api.refuzaDeviz(uid))} disabled={actionLoading}
									class="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
									style="background: #ef4444; color: white;">
									{actionLoading ? '...' : 'Da, refuz'}
								</button>
							</div>
						</div>
					{/if}

					{#if !showIntrebare}
						<button onclick={() => showIntrebare = true} disabled={actionLoading}
							class="w-full py-1.5 text-xs disabled:opacity-40"
							style="color: var(--muted);">Am o întrebare →</button>
					{:else}
						<div class="space-y-2">
							<textarea bind:value={intrebareMesaj} rows="2"
								placeholder="Ce dorești să știi? (opțional)"
								class="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
								style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);"></textarea>
							<div class="flex gap-2">
								<button onclick={() => { showIntrebare = false; intrebareMesaj = ''; }}
									class="py-2 px-4 rounded-xl text-sm"
									style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
									Anulează
								</button>
								<button onclick={() => action(() => api.intrebareDeviz(uid, intrebareMesaj))} disabled={actionLoading}
									class="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
									style="background: var(--accent); color: white;">
									{actionLoading ? '...' : 'Trimite întrebarea'}
								</button>
							</div>
						</div>
					{/if}
				</section>

			{:else}
				<!-- Deviz granular cu iteme individuale -->
				<section class="space-y-3">
					<div>
						<h2 class="font-semibold text-sm" style="color: var(--text)">Deviz în așteptare</h2>
						<p class="text-xs mt-0.5" style="color: var(--muted)">
							Bifează lucrările pe care dorești să le efectuăm.{wo.deviz_trimis_la ? ` Trimis pe ${new Date(wo.deviz_trimis_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}.` : ''}
						</p>
					</div>

					{#if wo.deviz_status === 'question_requested'}
						<div class="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style="background:#3b82f612; border:1px solid #3b82f630;">
							<span class="text-sm shrink-0" style="color:#3b82f6">ℹ</span>
							<p class="text-xs" style="color:#3b82f6">Ai trimis o întrebare echipei. Poți în continuare aproba sau refuza devizul.</p>
						</div>
					{/if}

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

					<!-- Footer sticky -->
					<div class="sticky bottom-20 rounded-2xl border p-4 space-y-3"
						style="background: var(--surface); border-color: var(--border); box-shadow: 0 -4px 24px #0008;">

						<div class="flex justify-between items-center">
							<span class="text-sm" style="color: var(--muted)">{idsAprobate.size} din {items.length} selectate</span>
							<span class="text-lg font-bold" style="color: var(--text)">{totalSelectat.toFixed(2)} RON</span>
						</div>

						{#if actionMsg}
							<p class="text-xs text-center px-3 py-2 rounded-xl" style="background:#22c55e12; color:#22c55e">{actionMsg}</p>
						{/if}
						{#if actionError}
							<p class="text-xs text-center px-3 py-2 rounded-xl" style="background:#ef444412; color:#ef4444">{actionError}</p>
						{/if}

						{#if !confirmRefuz}
							<div class="flex gap-2">
								<button
									onclick={() => action(() => api.aprobaDeviz(uid, [...idsAprobate]))}
									disabled={actionLoading || idsAprobate.size === 0}
									class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
									style="background: #22c55e; color: white;">
									{actionLoading ? '...' : 'Confirmă selecția'}
								</button>
								<button
									onclick={() => { confirmRefuz = true; showIntrebare = false; }}
									disabled={actionLoading}
									class="py-2.5 px-4 rounded-xl text-sm font-semibold disabled:opacity-40"
									style="background: var(--surface2); color: #ef4444; border: 1px solid var(--border);">
									Refuză tot
								</button>
							</div>
						{:else}
							<div class="p-3 rounded-xl space-y-2.5" style="background:#ef444410; border:1px solid #ef444430;">
								<p class="text-xs font-medium text-center" style="color:#ef4444">Confirmi refuzul întregului deviz?</p>
								<div class="flex gap-2">
									<button onclick={() => confirmRefuz = false}
										class="flex-1 py-2 rounded-xl text-sm"
										style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
										Nu, înapoi
									</button>
									<button onclick={() => action(() => api.refuzaDeviz(uid))} disabled={actionLoading}
										class="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
										style="background: #ef4444; color: white;">
										{actionLoading ? '...' : 'Da, refuz totul'}
									</button>
								</div>
							</div>
						{/if}

						{#if !showIntrebare}
							<button onclick={() => { showIntrebare = true; confirmRefuz = false; }} disabled={actionLoading}
								class="w-full py-1.5 text-xs disabled:opacity-40"
								style="color: var(--muted);">Am o întrebare despre deviz →</button>
						{:else}
							<div class="space-y-2 pt-1">
								<textarea bind:value={intrebareMesaj} rows="2"
									placeholder="Ce dorești să știi? (opțional)"
									class="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
									style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);"></textarea>
								<div class="flex gap-2">
									<button onclick={() => { showIntrebare = false; intrebareMesaj = ''; }}
										class="py-2 px-4 rounded-xl text-sm"
										style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
										Anulează
									</button>
									<button onclick={() => action(() => api.intrebareDeviz(uid, intrebareMesaj))} disabled={actionLoading}
										class="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
										style="background: var(--accent); color: white;">
										{actionLoading ? '...' : 'Trimite întrebarea'}
									</button>
								</div>
							</div>
						{/if}

					</div>
				</section>
			{/if}

		<!-- ═══════════════════════════════════════
		     DEVIZ — deja procesat (readonly)
		     ═══════════════════════════════════════ -->
		{:else if wo.deviz_trimis_la && (wo.deviz_aprobat_la || wo.deviz_refuzat_la)}
			{@const items = wo.costuri ?? []}
			{@const aprobat = !!wo.deviz_aprobat_la}
			{#if items.length > 0}
				<section class="space-y-2">
					<div class="flex items-center gap-2 flex-wrap">
						<h2 class="text-xs font-semibold uppercase tracking-widest" style="color: var(--muted)">
							Deviz {aprobat ? 'aprobat' : 'refuzat'}
						</h2>
						<span class="text-xs px-2 py-0.5 rounded-full font-medium"
							style="background:{aprobat ? '#22c55e18' : '#ef444418'}; color:{aprobat ? '#22c55e' : '#ef4444'}">
							{aprobat ? '✓ Aprobat' : '✕ Refuzat'}
						</span>
						{#if aprobat && wo.deviz_aprobat_la}
							<span class="text-xs" style="color: var(--muted)">
								pe {new Date(wo.deviz_aprobat_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
							</span>
						{:else if !aprobat && wo.deviz_refuzat_la}
							<span class="text-xs" style="color: var(--muted)">
								pe {new Date(wo.deviz_refuzat_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
							</span>
						{/if}
					</div>
					{#each items as item}
						<div class="flex items-center gap-3 px-4 py-3 rounded-2xl border"
							style="background: var(--surface); border-color: var(--border); opacity:{item.aprobat_client === false ? '0.4' : '1'};">
							<span class="text-sm shrink-0 w-4 text-center"
								style="color:{item.aprobat_client === true ? '#22c55e' : item.aprobat_client === false ? '#ef4444' : 'var(--muted)'}">
								{#if item.aprobat_client === true}✓{:else if item.aprobat_client === false}✕{:else}–{/if}
							</span>
							<span class="flex-1 text-sm" style="color: var(--text); text-decoration:{item.aprobat_client === false ? 'line-through' : 'none'}">
								{item.descriere}
							</span>
							<span class="text-sm font-medium shrink-0" style="color: var(--muted)">{item.total.toFixed(2)} RON</span>
						</div>
					{/each}
					{#if aprobat}
						<div class="flex justify-between px-4 py-2">
							<span class="text-xs" style="color: var(--muted)">Total aprobat</span>
							<span class="text-sm font-bold" style="color: #22c55e">{totalAprobatDeviz.toFixed(2)} RON</span>
						</div>
					{/if}
				</section>
			{:else}
				<div class="px-4 py-3 rounded-2xl" style="background:{aprobat ? '#22c55e12' : '#ef444412'}; border:1px solid {aprobat ? '#22c55e30' : '#ef444430'};">
					<p class="text-sm font-medium" style="color:{aprobat ? '#22c55e' : '#ef4444'}">
						{aprobat ? '✓ Devizul a fost aprobat' : '✕ Devizul a fost refuzat'}
					</p>
				</div>
			{/if}
		{/if}

		<!-- Feedback form -->
		{#if poateFeedback}
			<section class="p-4 rounded-2xl border space-y-4" style="background: var(--surface); border-color: var(--border);">
				<div>
					<h2 class="font-semibold text-sm" style="color: var(--text)">Cum a fost experiența?</h2>
					<p class="text-xs mt-0.5" style="color: var(--muted)">Feedback-ul tău ne ajută să ne îmbunătățim.</p>
				</div>
				<div class="flex gap-2">
					{#each [1, 2, 3, 4, 5] as s}
						<button
							onclick={() => ratingSelectat = s}
							onmouseenter={() => ratingHover = s}
							onmouseleave={() => ratingHover = 0}
							class="text-3xl transition-transform active:scale-90"
							style="color:{s <= (ratingHover || ratingSelectat) ? '#eab308' : 'var(--border)'}">★</button>
					{/each}
				</div>
				<textarea
					bind:value={comentariu}
					rows="2"
					placeholder="Comentariu opțional..."
					class="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
					style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);"></textarea>
				{#if feedbackError}
					<p class="text-xs text-red-400">{feedbackError}</p>
				{/if}
				<button
					onclick={trimitereFeedback}
					disabled={!ratingSelectat || feedbackSaving}
					class="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
					style="background: var(--accent); color: white;">
					{feedbackSaving ? 'Se trimite...' : 'Trimite feedback'}
				</button>
			</section>
		{/if}

		{#if feedback}
			<section class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
				<h2 class="font-semibold text-sm mb-2" style="color: var(--text)">Feedback-ul tău</h2>
				<div class="flex gap-1 mb-2">
					{#each [1, 2, 3, 4, 5] as s}
						<span class="text-xl" style="color:{s <= feedback.rating ? '#eab308' : 'var(--border)'}">★</span>
					{/each}
				</div>
				{#if feedback.comentariu}
					<p class="text-xs" style="color: var(--muted)">{feedback.comentariu}</p>
				{/if}
			</section>
		{/if}
	</div>
{/if}

<!-- ── Chat flotant ── -->
{#if wo}
	<!-- Panel — mereu montat, ascuns cu CSS când e închis -->
	<div style="
		position:fixed; bottom:148px; right:16px; z-index:200;
		width:min(340px, calc(100vw - 32px)); height:440px;
		border-radius:20px; overflow:hidden;
		box-shadow:0 12px 48px #000a;
		display:{chatOpen ? 'flex' : 'none'}; flex-direction:column;
		border:1px solid var(--border);
	">
		<!-- Header panel -->
		<div style="
			display:flex; align-items:center; justify-content:space-between;
			padding:12px 16px; background:var(--accent); flex-shrink:0;
		">
			<div style="display:flex; align-items:center; gap:8px;">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
					<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
						stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
				<span style="color:white; font-size:13px; font-weight:700;">Chat cu service</span>
			</div>
			<button onclick={() => chatOpen = false}
				aria-label="Închide chat"
				style="color:white; opacity:0.7; background:none; border:none; cursor:pointer;
				       padding:2px; display:flex; align-items:center;">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
					<path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
				</svg>
			</button>
		</div>
		<!-- ChatPortal mereu montat → un singur abonament WebSocket -->
		<div style="flex:1; min-height:0;">
			<ChatPortal woUid={uid} embedded={true} bind:visible={chatOpen} bind:chatUnread />
		</div>
	</div>

	<!-- Buton FAB -->
	<button
		onclick={() => chatOpen = !chatOpen}
		style="
			position:fixed; bottom:88px; right:16px; z-index:200;
			width:52px; height:52px; border-radius:50%;
			background:var(--accent);
			box-shadow:0 4px 24px color-mix(in srgb,var(--accent) 55%,transparent);
			border:none; cursor:pointer;
			display:flex; align-items:center; justify-content:center;
			transition:transform 0.2s cubic-bezier(.34,1.56,.64,1);
			transform:{chatOpen ? 'rotate(45deg)' : 'none'};
		">
		{#if chatOpen}
			<!-- X -->
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
				<path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
			</svg>
		{:else}
			<!-- Bulă chat cu 3 puncte -->
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
				<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
					stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<circle cx="9" cy="11.5" r="1" fill="white"/>
				<circle cx="12" cy="11.5" r="1" fill="white"/>
				<circle cx="15" cy="11.5" r="1" fill="white"/>
			</svg>
			{#if chatUnread > 0}
				<span style="
					position:absolute; top:4px; right:4px;
					min-width:18px; height:18px; border-radius:9px;
					background:#ef4444; color:white; font-size:10px; font-weight:700;
					display:flex; align-items:center; justify-content:center; padding:0 4px;
					border:2px solid var(--accent);
				">{chatUnread > 99 ? '99+' : chatUnread}</span>
			{/if}
		{/if}
	</button>
{/if}
