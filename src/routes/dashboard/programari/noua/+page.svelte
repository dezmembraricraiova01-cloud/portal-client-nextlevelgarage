<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, type MasiniMini, type TipServiciu, type ZiBlocata } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';
	import { sortable } from '$lib/sortable';

	// Reprogramare: vine din /programari prin query ?reprogramare={id}&nr={plate}&tip={cod}
	const reprogramareId = $derived(Number(page.url.searchParams.get('reprogramare')) || null);
	const reprogramareNr  = $derived(page.url.searchParams.get('nr') ?? '');
	const reprogramareTip = $derived(page.url.searchParams.get('tip') ?? '');

	// Config
	let ore             = $state<string[]>([]);
	let oreOcupate      = $state<string[]>([]);
	let masini          = $state<MasiniMini[]>([]);
	let tipuriServiciu  = $state<TipServiciu[]>([]);
	let maxFutureDays   = $state(90);
	let loading         = $state(true);
	let loadingSloturi  = $state(false);
	let saving          = $state(false);
	let error           = $state('');

	// Form state
	let pas              = $state<1 | 2 | 3>(1);
	let tipSelectat      = $state('');
	let masinaSelectata  = $state('');
	let dataSelectata    = $state('');
	let oraSelectata     = $state('');
	let notita           = $state('');

	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	const minDate = tomorrow.toISOString().split('T')[0];

	const maxDate = $derived.by(() => {
		const d = new Date();
		d.setDate(d.getDate() + maxFutureDays);
		return d.toISOString().split('T')[0];
	});

	// ── Calendar carduri-zi ──────────────────────────────────────────────
	const today0 = new Date(); today0.setHours(0, 0, 0, 0);
	let lunaCursor = $state(new Date(today0.getFullYear(), today0.getMonth(), 1));
	let zileBlocate = $state<Map<string, ZiBlocata>>(new Map());
	let ocupare = $state<Record<string, number>>({});
	let totalSloturi = $state(19);
	let modalOreOpen = $state(false);

	const lunaLabel = $derived(
		lunaCursor.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })
	);

	function isoDate(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// Grid de zile pentru luna curentă, aliniat la luni
	const zileLuna = $derived.by(() => {
		const y = lunaCursor.getFullYear();
		const m = lunaCursor.getMonth();
		const prima = new Date(y, m, 1);
		const ultima = new Date(y, m + 1, 0);
		// JS: Sun=0..Sat=6 → vrem Lun=0..Dum=6
		const offsetLuni = (prima.getDay() + 6) % 7;
		const total = offsetLuni + ultima.getDate();
		const sloturi: Array<{ data: string; zi: number; inLuna: boolean; date: Date } | null> = [];
		for (let i = 0; i < offsetLuni; i++) sloturi.push(null);
		for (let zi = 1; zi <= ultima.getDate(); zi++) {
			const d = new Date(y, m, zi);
			sloturi.push({ data: isoDate(d), zi, inLuna: true, date: d });
		}
		while (sloturi.length % 7 !== 0) sloturi.push(null);
		return sloturi;
	});

	const lunaMin = $derived(new Date(today0.getFullYear(), today0.getMonth(), 1));
	const lunaMax = $derived.by(() => {
		const d = new Date(today0); d.setDate(d.getDate() + maxFutureDays);
		return new Date(d.getFullYear(), d.getMonth(), 1);
	});

	const potRetro = $derived(lunaCursor.getTime() > lunaMin.getTime());
	const potInainte = $derived(lunaCursor.getTime() < lunaMax.getTime());

	async function incarcaZileBlocate() {
		const y = lunaCursor.getFullYear();
		const m = lunaCursor.getMonth();
		const from = isoDate(new Date(y, m, 1));
		const to   = isoDate(new Date(y, m + 1, 0));
		try {
			const res = await api.programariZileBlocate(from, to);
			const map = new Map<string, ZiBlocata>();
			for (const z of res.zile) map.set(z.data, z);
			zileBlocate = map;
			ocupare = res.ocupare ?? {};
			totalSloturi = res.total_sloturi || 19;
		} catch { /* nefatal */ }
	}

	function schimbaLuna(delta: number) {
		const d = new Date(lunaCursor.getFullYear(), lunaCursor.getMonth() + delta, 1);
		if (d.getTime() < lunaMin.getTime() || d.getTime() > lunaMax.getTime()) return;
		lunaCursor = d;
		incarcaZileBlocate();
	}

	function selecteazaZi(iso: string) {
		dataSelectata = iso;
		oraSelectata = '';
		onDataSchimbata();
		modalOreOpen = true;
	}

	function alegeOra(o: string, ocupat: boolean) {
		if (ocupat) return;
		oraSelectata = o;
		modalOreOpen = false;
	}

	function inchideModalOre() {
		modalOreOpen = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && modalOreOpen) {
			e.preventDefault();
			inchideModalOre();
		}
	}

	type StareZi = 'past' | 'far' | 'weekend' | 'sarbatoare' | 'liber';
	function stareZi(iso: string, date: Date): { stare: StareZi; label?: string } {
		if (iso < minDate) return { stare: 'past' };
		if (iso > maxDate) return { stare: 'far' };
		const blocat = zileBlocate.get(iso);
		if (blocat) return { stare: blocat.motiv === 'weekend' ? 'weekend' : 'sarbatoare', label: blocat.label };
		// Fallback local pentru weekend (înainte ca API-ul să răspundă)
		const dow = date.getDay();
		if (dow === 0 || dow === 6) return { stare: 'weekend', label: 'Weekend' };
		return { stare: 'liber' };
	}

	onMount(async () => {
		try {
			const cfg = await api.programariConfig();
			ore            = cfg.ore;
			masini         = cfg.masini;
			tipuriServiciu = cfg.tipuri_serviciu;
			maxFutureDays  = cfg.max_future_days;
			// Pre-selecteaza prima masina daca exista una singura
			if (masini.length === 1) masinaSelectata = masini[0].numar_inmatriculare;

			// Prefill pentru reprogramare — sări direct la pasul 2
			if (reprogramareId) {
				if (reprogramareNr && masini.some(m => m.numar_inmatriculare === reprogramareNr)) {
					masinaSelectata = reprogramareNr;
				}
				if (reprogramareTip && tipuriServiciu.some(t => t.cod === reprogramareTip)) {
					tipSelectat = reprogramareTip;
					pas = 2;
					incarcaZileBlocate();
				}
			}
		} catch { error = 'Eroare la încărcare.'; }
		finally { loading = false; }
	});

	// La schimbarea datei → cere sloturile ocupate ca sa marcam butoanele ca disabled
	async function onDataSchimbata() {
		oraSelectata = '';
		oreOcupate   = [];
		if (!dataSelectata) return;
		loadingSloturi = true;
		try {
			const cfg = await api.programariConfig(dataSelectata);
			oreOcupate = cfg.ore_ocupate;
		} catch {
			// Esecul aici nu e fatal — utilizatorul va primi 409 la submit daca slotul e luat
		} finally {
			loadingSloturi = false;
		}
	}

	function selectTip(cod: string) {
		tipSelectat = cod;
		pas = 2;
		incarcaZileBlocate();
	}

	function inapoiLaPas1() {
		pas = 1;
		dataSelectata = '';
		oraSelectata  = '';
	}

	function continuaLaPas3() {
		if (!dataSelectata || !oraSelectata || !masinaSelectata) return;
		pas = 3;
	}

	async function confirma() {
		error = '';
		saving = true;
		try {
			await api.addProgramare({
				data:             dataSelectata,
				ora:              oraSelectata,
				nr_inmatriculare: masinaSelectata,
				tip_serviciu:     tipSelectat,
				notita:           notita || undefined,
			});
			// La reprogramare → anulează programarea veche după ce noua e creată cu succes
			if (reprogramareId) {
				try { await api.anulareProgramare(reprogramareId); } catch { /* nefatal — userul vede ambele în listă */ }
			}
			goto('/dashboard/programari');
		} catch (e: any) {
			error = e.message ?? 'Eroare la salvare.';
			// 409 = slot ocupat intre timp → reincarca sloturile si trimite-l inapoi la pas 2
			if (e.status === 409) {
				oraSelectata = '';
				try {
					const cfg = await api.programariConfig(dataSelectata);
					oreOcupate = cfg.ore_ocupate;
				} catch {}
			}
			pas = 2;
		} finally {
			saving = false;
		}
	}

	const tipLabel     = $derived(tipuriServiciu.find(t => t.cod === tipSelectat)?.label ?? '');
	const masinaNume   = $derived(masini.find(m => m.numar_inmatriculare === masinaSelectata));
	const dataFormatat = $derived(dataSelectata
		? new Date(dataSelectata + 'T00:00:00').toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })
		: '');
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		{#if pas === 1}
			<a href="/dashboard/programari" class="text-sm" style="color: var(--muted)">← Înapoi</a>
		{:else}
			<button onclick={() => pas === 2 ? inapoiLaPas1() : (pas = 2)}
				class="text-sm" style="color: var(--muted)">← Înapoi</button>
		{/if}
	</div>

	<!-- Banner reprogramare -->
	{#if reprogramareId}
		<div class="px-4 py-3 rounded-2xl border flex items-center gap-3"
			style="background: #3b82f612; border-color: #3b82f640;">
			<span class="text-xl shrink-0">📆</span>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-semibold" style="color: var(--text)">Reprogramare</p>
				<p class="text-xs mt-0.5" style="color: var(--muted)">Programarea veche pentru {reprogramareNr} se anulează automat la confirmare.</p>
			</div>
		</div>
	{/if}

	<!-- Progress indicator -->
	<div class="flex items-center gap-2">
		{#each [1, 2, 3] as nr}
			<div class="flex-1 h-1 rounded-full transition-all"
				style="background: {pas >= nr ? 'var(--accent)' : 'var(--border)'}"></div>
		{/each}
	</div>

	{#if loading}
		<div class="space-y-3">
			{#each Array(4) as _}
				<div class="p-3 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
					<Skeleton height="h-3" class="w-24 mb-2" />
					<Skeleton height="h-10" class="w-full" rounded="rounded-xl" />
				</div>
			{/each}
		</div>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- PAS 1 — Ce serviciu? -->
	<!-- ═══════════════════════════════════════════════════ -->
	{:else if pas === 1}
		<div>
			<h1 class="text-xl font-bold" style="color: var(--text)">Cu ce te putem ajuta?</h1>
			<p class="text-sm mt-1" style="color: var(--muted)">Alege tipul de serviciu</p>
		</div>

		<div class="grid grid-cols-3 gap-3" use:sortable={{ key: 'programari-tip-serviciu', idAttr: 'data-sort-id' }}>
			{#each tipuriServiciu as tip}
				<button
					data-sort-id={tip.cod}
					onclick={() => selectTip(tip.cod)}
					class="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all active:scale-95 text-center"
					style="background: var(--surface); border-color: {tipSelectat === tip.cod ? 'var(--accent)' : 'var(--border)'};">
					<span class="text-2xl">{tip.icon}</span>
					<span class="text-xs font-medium leading-tight" style="color: var(--text)">{tip.label}</span>
				</button>
			{/each}
		</div>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- PAS 2 — Când și cu ce mașină? -->
	<!-- ═══════════════════════════════════════════════════ -->
	{:else if pas === 2}
		<div class="flex items-start justify-between gap-4 flex-wrap">
			<div>
				<h1 class="text-xl font-bold" style="color: var(--text)">{tipLabel}</h1>
				<p class="text-sm mt-1" style="color: var(--muted)">Alege data și ora</p>
			</div>
			{#if masini.length === 1}
				<div class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border shrink-0"
					style="background: var(--surface); border-color: var(--border);">
					<span class="text-lg">🚗</span>
					<div class="leading-tight">
						<p class="text-sm font-semibold" style="color: var(--text)">{masini[0].numar_inmatriculare}</p>
						<p class="text-[11px]" style="color: var(--muted)">{masini[0].marca} {masini[0].model}</p>
					</div>
				</div>
			{/if}
		</div>

		<div class="space-y-4">
			<!-- Selector mașină când există mai multe -->
			{#if masini.length > 1}
				<div>
					<p class="text-xs mb-2 font-medium" style="color: var(--muted)">Mașina</p>
					<div class="space-y-2">
						{#each masini as m}
							<button
								onclick={() => masinaSelectata = m.numar_inmatriculare}
								class="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left"
								style="background: var(--surface); border-color: {masinaSelectata === m.numar_inmatriculare ? 'var(--accent)' : 'var(--border)'};">
								<div>
									<p class="text-sm font-semibold" style="color: var(--text)">{m.numar_inmatriculare}</p>
									<p class="text-xs" style="color: var(--muted)">{m.marca} {m.model}</p>
								</div>
								{#if masinaSelectata === m.numar_inmatriculare}
									<span style="color: var(--accent)">✓</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{:else if masini.length === 0}
				<div class="p-4 rounded-xl border text-center" style="border-color: var(--border)">
					<p class="text-sm" style="color: var(--muted)">Nu ai nicio mașină înregistrată.</p>
					<a href="/dashboard/masini" class="text-sm mt-1 block" style="color: var(--accent)">
						Adaugă o mașină →
					</a>
				</div>
			{/if}

			<!-- Data — grid de carduri-zi -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<p class="text-xs font-medium" style="color: var(--muted)">Alege ziua</p>
					<div class="flex items-center gap-1">
						<button type="button" onclick={() => schimbaLuna(-1)} disabled={!potRetro}
							class="w-8 h-8 rounded-lg text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
							style="background: var(--surface); border: 1px solid var(--border); color: var(--text);">‹</button>
						<span class="text-xs font-semibold capitalize px-2 min-w-[120px] text-center" style="color: var(--text)">{lunaLabel}</span>
						<button type="button" onclick={() => schimbaLuna(1)} disabled={!potInainte}
							class="w-8 h-8 rounded-lg text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
							style="background: var(--surface); border: 1px solid var(--border); color: var(--text);">›</button>
					</div>
				</div>

				<!-- Cap săptămână -->
				<div class="grid grid-cols-7 gap-1 mb-1.5">
					{#each ['Lu','Ma','Mi','Jo','Vi','Sâ','Du'] as zi, i}
						<div class="text-center text-[10px] font-semibold tracking-wide"
							style="color: {i >= 5 ? '#ef444499' : 'var(--muted)'}">{zi}</div>
					{/each}
				</div>

				<!-- Grid zile — wow cards compact -->
				<div class="grid grid-cols-7 gap-1">
					{#each zileLuna as cell}
						{#if cell === null}
							<div></div>
						{:else}
							{@const s = stareZi(cell.data, cell.date)}
							{@const selectata = dataSelectata === cell.data}
							{@const indisponibila = s.stare !== 'liber'}
							{@const azi = cell.data === isoDate(today0)}
							{@const ocup = ocupare[cell.data] ?? 0}
							{@const procent = Math.min(100, Math.round((ocup / totalSloturi) * 100))}
							{@const aglomerat = procent >= 80}
							<button
								type="button"
								onclick={() => !indisponibila && selecteazaZi(cell.data)}
								disabled={indisponibila}
								title={s.label ?? (ocup ? `${ocup}/${totalSloturi} sloturi ocupate` : 'Liber')}
								class="zi-card relative overflow-hidden flex flex-col items-center justify-center rounded-lg border transition-all disabled:cursor-not-allowed"
								class:zi-selectata={selectata}
								class:zi-blocata={indisponibila}
								class:zi-azi={azi}
								class:zi-aglomerat={aglomerat && !indisponibila}>
								{#if indisponibila && s.stare !== 'past' && s.stare !== 'far'}
									<span class="absolute top-0.5 right-1 text-[8px] opacity-55">🔒</span>
								{/if}
								{#if azi}
									<span class="zi-azi-badge absolute top-0.5 left-0.5">AZI</span>
								{/if}

								<span class="text-sm font-bold leading-none tabular-nums">{cell.zi}</span>

								{#if s.stare === 'weekend'}
									<span class="zi-meta">Weekend</span>
								{:else if s.stare === 'sarbatoare'}
									<span class="zi-meta zi-meta-rosu">Sărb.</span>
								{:else if !indisponibila && ocup > 0}
									<span class="zi-meta">{ocup}/{totalSloturi}</span>
								{/if}

								{#if !indisponibila}
									<div class="zi-bar-wrap">
										<div class="zi-bar" style="width: {Math.max(procent, 4)}%; opacity: {procent === 0 ? 0.3 : 1}"></div>
									</div>
								{/if}
							</button>
						{/if}
					{/each}
				</div>

				<!-- Legendă -->
				<div class="flex items-center justify-center gap-3 mt-2 text-[10px] flex-wrap" style="color: var(--muted)">
					<span class="flex items-center gap-1"><span class="legend-bar legend-low"></span>Liber</span>
					<span class="flex items-center gap-1"><span class="legend-bar legend-mid"></span>Parțial</span>
					<span class="flex items-center gap-1"><span class="legend-bar legend-high"></span>Aglomerat</span>
					<span class="flex items-center gap-1">🔒 Nelucrătoare</span>
				</div>
			</div>

			<!-- Chip cu ora aleasă -->
			{#if dataSelectata && oraSelectata}
				<button type="button" onclick={() => modalOreOpen = true}
					class="ora-chip flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all">
					<span class="flex items-center gap-2">
						<span class="text-base">⏰</span>
						<span class="text-sm font-semibold" style="color: var(--text)">{oraSelectata}</span>
						<span class="text-xs" style="color: var(--muted)">· schimbă</span>
					</span>
					<span style="color: var(--muted)">›</span>
				</button>
			{/if}

			<!-- Notita -->
			<div>
				<p class="text-xs mb-2 font-medium" style="color: var(--muted)">Notițe (opțional)</p>
				<textarea
					bind:value={notita}
					rows="2"
					placeholder="Descrie pe scurt problema sau ce dorești..."
					class="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);"></textarea>
			</div>

			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}

			<button
				onclick={continuaLaPas3}
				disabled={!dataSelectata || !oraSelectata || !masinaSelectata}
				class="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
				style="background: var(--accent); color: white;">
				Continuă →
			</button>
		</div>

	<!-- ═══════════════════════════════════════════════════ -->
	<!-- PAS 3 — Confirmare -->
	<!-- ═══════════════════════════════════════════════════ -->
	{:else if pas === 3}
		<div>
			<h1 class="text-xl font-bold" style="color: var(--text)">Confirmare</h1>
			<p class="text-sm mt-1" style="color: var(--muted)">Verifică detaliile programării</p>
		</div>

		<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border)">
			{#each [
				{ label: 'Serviciu',  value: tipLabel },
				{ label: 'Mașina',   value: masinaNume ? `${masinaNume.numar_inmatriculare} — ${masinaNume.marca} ${masinaNume.model}` : masinaSelectata },
				{ label: 'Data',     value: dataFormatat },
				{ label: 'Ora',      value: oraSelectata },
				...(notita ? [{ label: 'Notițe', value: notita }] : []),
			] as row, i}
				<div class="flex gap-4 px-4 py-3 {i > 0 ? 'border-t' : ''}"
					style="background: var(--surface); border-color: var(--border);">
					<span class="text-xs w-16 shrink-0 font-medium pt-0.5" style="color: var(--muted)">{row.label}</span>
					<span class="text-sm" style="color: var(--text)">{row.value}</span>
				</div>
			{/each}
		</div>

		{#if error}
			<p class="text-sm text-red-400 text-center">{error}</p>
		{/if}

		<button
			onclick={confirma}
			disabled={saving}
			class="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
			style="background: var(--accent); color: white;">
			{saving ? 'Se salvează...' : '✓ Confirmă programarea'}
		</button>
	{/if}
</div>

<svelte:window onkeydown={onKeydown} />

<!-- ═══════════════════════════════════════════════════ -->
<!-- Modal alegere oră -->
<!-- ═══════════════════════════════════════════════════ -->
{#if modalOreOpen && dataSelectata}
	<div
		class="ore-overlay"
		role="presentation"
		onclick={inchideModalOre}>
	</div>
	<div class="ore-modal" role="dialog" aria-modal="true" aria-label="Alege ora">
		<div class="flex items-center justify-between px-4 pt-4 pb-3">
			<div>
				<p class="text-[10px] uppercase tracking-widest font-semibold" style="color: var(--muted)">Alege ora</p>
				<p class="text-base font-bold capitalize" style="color: var(--text)">{dataFormatat}</p>
				{#if loadingSloturi}
					<p class="text-xs mt-0.5" style="color: var(--muted)">verifică disponibilitatea...</p>
				{:else}
					<p class="text-xs mt-0.5" style="color: var(--muted)">
						{ore.length - oreOcupate.length} libere · {oreOcupate.length} ocupate
					</p>
				{/if}
			</div>
			<button type="button" onclick={inchideModalOre}
				class="w-8 h-8 rounded-full flex items-center justify-center transition-all"
				style="background: var(--surface); border: 1px solid var(--border); color: var(--muted)"
				aria-label="Închide">✕</button>
		</div>

		<div class="px-4 pb-4 grid grid-cols-4 gap-2 overflow-y-auto">
			{#each ore as o}
				{@const ocupat = oreOcupate.includes(o)}
				{@const selectata = oraSelectata === o}
				<button
					type="button"
					onclick={() => alegeOra(o, ocupat)}
					disabled={ocupat}
					title={ocupat ? 'Slot ocupat' : ''}
					class="ora-cell py-2.5 rounded-xl text-sm font-semibold border transition-all disabled:cursor-not-allowed"
					class:ora-selectata={selectata}
					class:ora-ocupata={ocupat}>
					<span>{o}</span>
					{#if ocupat}
						<span class="block text-[8px] mt-0.5 uppercase tracking-wider opacity-70">Ocupat</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	/* === Carduri-zi premium compact === */
	.zi-card {
		font-feature-settings: 'tnum';
		height: 56px;
		padding: 4px 2px 6px;
		gap: 2px;
		background:
			linear-gradient(160deg, rgba(99,102,241,0.06) 0%, transparent 60%),
			var(--surface);
		border-color: var(--border);
		color: var(--text);
		isolation: isolate;
	}

	.zi-meta {
		font-size: 8px;
		line-height: 1;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.6;
	}
	.zi-meta-rosu {
		color: #ef4444;
		opacity: 0.85;
	}
	.zi-selectata .zi-meta { opacity: 0.85; }
	.zi-card:not(:disabled):hover {
		transform: translateY(-2px);
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		background:
			linear-gradient(160deg, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%),
			var(--surface);
		box-shadow:
			0 8px 18px -8px color-mix(in srgb, var(--accent) 60%, transparent),
			0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent);
	}
	.zi-card:not(:disabled):active { transform: scale(0.96); }

	/* AZI — badge text + ring subtil */
	.zi-azi {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent) inset;
	}
	.zi-azi-badge {
		font-size: 7px;
		font-weight: 800;
		letter-spacing: 0.06em;
		padding: 1px 3px;
		border-radius: 3px;
		background: var(--accent);
		color: #fff;
		line-height: 1;
		box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 70%, transparent);
		animation: ziAziPulse 2.2s ease-in-out infinite;
		z-index: 2;
	}
	@keyframes ziAziPulse {
		0%, 100% { box-shadow: 0 0 8px  color-mix(in srgb, var(--accent) 60%, transparent); }
		50%      { box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 90%, transparent); }
	}
	.zi-selectata .zi-azi-badge {
		background: rgba(255,255,255,0.95);
		color: var(--accent);
		box-shadow: 0 0 8px rgba(255,255,255,0.55);
	}

	/* Selectată — gradient accent + glow + animație pop */
	.zi-selectata {
		background: linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 75%, #6366f1) 100%) !important;
		border-color: var(--accent) !important;
		color: #fff !important;
		box-shadow:
			0 1px 0 rgba(255,255,255,0.22) inset,
			0 8px 22px -6px color-mix(in srgb, var(--accent) 80%, transparent),
			0 0 0 3px color-mix(in srgb, var(--accent) 28%, transparent);
		animation: ziPop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.zi-selectata::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%);
		transform: translateX(-100%);
		animation: ziShimmer 1.4s ease-out;
		pointer-events: none;
	}
	@keyframes ziPop {
		0%   { transform: scale(0.88); }
		55%  { transform: scale(1.06); }
		100% { transform: scale(1); }
	}
	@keyframes ziShimmer {
		0%   { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}

	/* Aglomerat (>=80%) — accent subtil de avertizare */
	.zi-aglomerat {
		background:
			linear-gradient(160deg, rgba(234,179,8,0.10) 0%, transparent 60%),
			var(--surface);
	}

	/* Blocată — textură diagonală + dim */
	.zi-blocata {
		opacity: 0.55;
		background:
			repeating-linear-gradient(135deg, transparent 0 5px, rgba(255,255,255,0.035) 5px 6px),
			var(--surface);
		color: var(--muted);
	}

	/* Progress bar ocupare — pinned bottom */
	.zi-bar-wrap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 3px;
		background: rgba(255,255,255,0.08);
		overflow: hidden;
	}
	.zi-bar {
		height: 100%;
		background: linear-gradient(90deg, #22c55e 0%, #22c55e 55%, #eab308 78%, #ef4444 100%);
		background-size: 167% 100%;
		background-position: 0 0;
		border-radius: 0 2px 2px 0;
		transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), background-position 0.4s ease;
	}
	.zi-aglomerat .zi-bar {
		background-position: 100% 0;
		box-shadow: 0 0 8px rgba(239,68,68,0.45);
	}
	.zi-selectata .zi-bar-wrap { background: rgba(255,255,255,0.22); }
	.zi-selectata .zi-bar {
		background: rgba(255,255,255,0.95);
		box-shadow: 0 0 10px rgba(255,255,255,0.6);
	}

	/* Legendă */
	.legend-bar {
		display: inline-block;
		width: 14px;
		height: 3px;
		border-radius: 2px;
	}
	.legend-low  { background: #22c55e; }
	.legend-mid  { background: #eab308; }
	.legend-high { background: #ef4444; }

	@media (prefers-reduced-motion: reduce) {
		.zi-dot-azi, .zi-selectata, .zi-selectata::after { animation: none; }
	}

	/* === Chip cu ora aleasă === */
	.ora-chip {
		background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, transparent) 0%, transparent 70%), var(--surface);
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
		box-shadow: 0 4px 14px -8px color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.ora-chip:hover {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
		transform: translateY(-1px);
	}

	/* === Bottom sheet alegere oră (nu acoperă calendarul) === */
	.ore-overlay {
		position: fixed;
		inset: 0;
		background: rgba(8, 8, 18, 0.18);
		z-index: 60;
		animation: oreFadeIn 0.18s ease-out;
	}
	.ore-modal {
		position: fixed;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: min(560px, 100vw);
		max-height: 50vh;
		overflow: hidden;
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 35%),
			var(--surface);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
		border-bottom: none;
		border-radius: 22px 22px 0 0;
		box-shadow:
			0 1px 0 rgba(255,255,255,0.06) inset,
			0 -16px 40px -12px rgba(0,0,0,0.55);
		z-index: 61;
		animation: oreSheetIn 0.32s cubic-bezier(0.32, 1.4, 0.5, 1);
		display: flex;
		flex-direction: column;
		padding-bottom: env(safe-area-inset-bottom);
	}
	.ore-modal::before {
		content: '';
		display: block;
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: rgba(255,255,255,0.18);
		margin: 8px auto 0;
	}
	@keyframes oreFadeIn {
		from { opacity: 0; }
		to   { opacity: 1; }
	}
	@keyframes oreSheetIn {
		from { transform: translate(-50%, 100%); }
		to   { transform: translate(-50%, 0); }
	}

	@media (min-width: 900px) {
		/* Pe desktop — card lateral dreapta, calendarul rămâne neacoperit */
		.ore-overlay { background: transparent; }
		.ore-modal {
			left: auto;
			right: 24px;
			bottom: 24px;
			top: 50%;
			transform: translateY(-50%);
			width: 360px;
			max-height: min(80vh, 620px);
			border-radius: 22px;
			border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
			animation: oreCardIn 0.3s cubic-bezier(0.32, 1.4, 0.5, 1);
		}
		.ore-modal::before { display: none; }
		@keyframes oreCardIn {
			from { opacity: 0; transform: translate(20px, -50%); }
			to   { opacity: 1; transform: translate(0, -50%); }
		}
	}

	.ora-cell {
		background: var(--surface);
		border-color: var(--border);
		color: var(--text);
		font-feature-settings: 'tnum';
		line-height: 1;
	}
	.ora-cell:not(:disabled):hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
		box-shadow: 0 4px 12px -6px color-mix(in srgb, var(--accent) 60%, transparent);
	}
	.ora-cell:not(:disabled):active { transform: scale(0.96); }
	.ora-selectata {
		background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 75%, #6366f1)) !important;
		color: #fff !important;
		border-color: var(--accent) !important;
		box-shadow: 0 6px 18px -6px color-mix(in srgb, var(--accent) 70%, transparent);
	}
	.ora-ocupata {
		opacity: 0.4;
		text-decoration: line-through;
		background:
			repeating-linear-gradient(135deg, transparent 0 5px, rgba(255,255,255,0.04) 5px 6px),
			var(--surface);
	}
</style>
