<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, type Masina, type WoSummary, type MasinaFoto, type AlertaMasina, type AlertSummary } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';
	import AlertDocumentCard from '$lib/components/alerts/AlertDocumentCard.svelte';

	const id = $derived(Number(page.params.id));
	let masina    = $state<Masina | null>(null);
	let reparatii = $state<WoSummary[]>([]);
	let fotos     = $state<MasinaFoto[]>([]);
	let loading   = $state(true);

	// Foto state
	let uploadLoading = $state(false);
	let uploadError   = $state('');

	// Drag-and-drop reorder
	let dragFromIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function onDragStart(e: DragEvent, index: number) {
		dragFromIndex = index;
		e.dataTransfer!.effectAllowed = 'move';
	}

	function onDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		dragOverIndex = index;
	}

	function onDrop(e: DragEvent, index: number) {
		e.preventDefault();
		if (dragFromIndex === null || dragFromIndex === index) {
			dragFromIndex = dragOverIndex = null;
			return;
		}
		const ordered = [...fotos];
		const [moved] = ordered.splice(dragFromIndex, 1);
		ordered.splice(index, 0, moved);
		fotos = ordered;
		dragFromIndex = dragOverIndex = null;
		api.reorderFotos(id, ordered.map(f => f.id)).catch(() => {});
	}

	function onDragEnd() {
		dragFromIndex = dragOverIndex = null;
	}

	// Alerte state
	let alerte           = $state<AlertaMasina[]>([]);
	let summary          = $state<AlertSummary | null>(null);
	let alertaEditataTip = $state<string | null>(null);
	let alertaSaving     = $state(false);
	let alertaToggling   = $state(false);
	let alertaError      = $state('');
	let alertaSuccess    = $state('');

	const tipuriAlerta = [
		{ tip: 'rovinieta',   icon: '🛡️', label: 'Rovinieta' },
		{ tip: 'rca',         icon: '📋', label: 'Asigurare RCA' },
		{ tip: 'casco',       icon: '🔒', label: 'CASCO' },
		{ tip: 'carte_verde', icon: '🌍', label: 'Carte Verde' },
		{ tip: 'itp',         icon: '🔬', label: 'ITP' },
		{ tip: 'buletin',     icon: '🪪', label: 'Buletin' },
		{ tip: 'permis',      icon: '🚗', label: 'Permis auto' },
		{ tip: 'tahograf',    icon: '📡', label: 'Tahograf' },
	];

	const DOC_INFO: Record<string, { desc: string; motiv: string }> = {
		buletin:     { desc: 'Act de identitate obligatoriu în trafic',         motiv: 'Fără buletin valabil poți fi reținut la orice control rutier.' },
		permis:      { desc: 'Permis de conducere — obligatoriu prin lege',      motiv: 'Conducerea fără permis valid atrage dosar penal.' },
		rovinieta:   { desc: 'Taxă de drum obligatorie pe rețeaua națională',    motiv: 'Amenda ajunge la 4.000 lei și poate fi aplicată automat.' },
		rca:         { desc: 'Asigurare obligatorie de răspundere civilă',       motiv: 'Fără RCA, daunele produse terților cad integral în sarcina ta.' },
		casco:       { desc: 'Asigurare facultativă pentru mașina ta',           motiv: 'Te protejează la avarii, furt și accidente în care ești vinovat.' },
		carte_verde: { desc: 'Dovada asigurării valabilă în toată Europa',       motiv: 'Obligatorie la orice traversare a frontierei cu mașina.' },
		itp:         { desc: 'Inspecție tehnică periodică impusă de lege',       motiv: 'Mașina fără ITP valid nu poate circula legal și poate fi reținută.' },
		tahograf:    { desc: 'Aparat de înregistrare pentru transport',          motiv: 'Obligatoriu pentru vehicule comerciale și transport persoane.' },
	};

	// Edit state
	let editOpen  = $state(false);
	let saving    = $state(false);
	let saveError = $state('');
	let saveOk    = $state(false);
	let kmInput        = $state<string>('');
	let itpInput       = $state<string>('');
	let observatiiInput = $state<string>('');

	onMount(async () => {
		const [res, alerteRes, summaryRes] = await Promise.all([
			api.masina(id),
			api.alerte(id).catch(() => [] as AlertaMasina[]),
			api.alertSummary().catch(() => null as AlertSummary | null),
		]);
		masina    = res.masina;
		reparatii = res.reparatii;
		fotos     = res.fotos ?? [];
		alerte    = alerteRes;
		summary   = summaryRes;
		loading   = false;
	});

	function deschideAlerta(tip: string) {
		alertaEditataTip = tip;
		alertaError      = '';
		alertaSuccess    = '';
	}

	async function handleSaveAlerta(data: string, zile: number, thresholds: number[] | null) {
		if (!alertaEditataTip) return;
		alertaSaving = true; alertaError = ''; alertaSuccess = '';
		try {
			const saved = await api.saveAlerta(id, {
				tip:           alertaEditataTip,
				data_expirare: data || null,
				zile_inainte:  zile,
				thresholds,
			});
			alerte = [...alerte.filter(a => a.tip !== alertaEditataTip), saved];
			summary = await api.alertSummary().catch(() => summary);
			alertaSuccess = 'Salvat. Te anunțăm la timp.';
			const tipSalvat = alertaEditataTip;
			setTimeout(() => {
				if (alertaEditataTip === tipSalvat) {
					alertaEditataTip = null; alertaSuccess = '';
				}
			}, 1200);
		} catch (e: any) {
			alertaError = e.message ?? 'Eroare la salvare.';
		} finally {
			alertaSaving = false;
		}
	}

	async function handleDeleteAlerta() {
		if (!alertaEditataTip) return;
		const existing = alerte.find(a => a.tip === alertaEditataTip);
		if (!existing) { alertaEditataTip = null; return; }
		try {
			await api.deleteAlerta(id, existing.id);
			alerte = alerte.filter(a => a.tip !== alertaEditataTip);
			summary = await api.alertSummary().catch(() => summary);
			alertaEditataTip = null;
		} catch (e: any) {
			alertaError = e.message ?? 'Nu am putut șterge alerta. Încearcă din nou.';
		}
	}

	async function handleToggleActiva(next: boolean) {
		if (!alertaEditataTip) return;
		const existing = alerte.find(a => a.tip === alertaEditataTip);
		if (!existing) return;
		alertaToggling = true; alertaError = ''; alertaSuccess = '';
		try {
			const updated = await api.updateAlertaSettings(id, existing.id, { activa: next });
			alerte = alerte.map(a => a.tip === alertaEditataTip ? { ...a, ...updated } : a);
			summary = await api.alertSummary().catch(() => summary);
			alertaSuccess = next ? 'Notificări activate.' : 'Notificări oprite.';
			setTimeout(() => { alertaSuccess = ''; }, 1500);
		} catch (e: any) {
			alertaError = e.message ?? 'Nu am putut actualiza setarea.';
		} finally {
			alertaToggling = false;
		}
	}

	async function handleAcceptRec(wmsDate: string) {
		if (!alertaEditataTip) return;
		alertaSaving = true; alertaError = ''; alertaSuccess = '';
		try {
			const existing = alerte.find(a => a.tip === alertaEditataTip);
			const saved = await api.saveAlerta(id, {
				tip:           alertaEditataTip,
				data_expirare: wmsDate || null,
				zile_inainte:  existing?.zile_inainte ?? 30,
				thresholds:    existing?.thresholds ?? null,
			});
			alerte = [...alerte.filter(a => a.tip !== alertaEditataTip), saved];
			summary = await api.alertSummary().catch(() => summary);
			alertaSuccess = 'Recomandare aplicată.';
			const tipSalvat = alertaEditataTip;
			setTimeout(() => {
				if (alertaEditataTip === tipSalvat) {
					alertaEditataTip = null; alertaSuccess = '';
				}
			}, 1200);
		} catch (e: any) {
			alertaError = e.message ?? 'Eroare la actualizare.';
		} finally {
			alertaSaving = false;
		}
	}

	async function handleFotoUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		uploadError   = '';
		uploadLoading = true;
		try {
			const foto = await api.uploadMasinaFoto(id, file);
			fotos = [...fotos, foto];
			if (masina) masina = { ...masina, foto_url: fotos[0]?.url ?? null };
		} catch (err: any) {
			uploadError = err.message ?? 'Eroare la încărcare.';
		} finally {
			uploadLoading = false;
			(e.target as HTMLInputElement).value = '';
		}
	}

	async function handleFotoDelete(foto: MasinaFoto) {
		try {
			await api.deleteMasinaFoto(id, foto.id);
			fotos = fotos.filter(f => f.id !== foto.id);
			if (masina) masina = { ...masina, foto_url: fotos[0]?.url ?? null };
		} catch { /* ignoră */ }
	}

	function deschideEdit() {
		if (!masina) return;
		kmInput         = masina.km_actuali != null ? String(masina.km_actuali) : '';
		itpInput        = masina.itp_valabil_pana ? masina.itp_valabil_pana.split('T')[0] : '';
		observatiiInput = masina.observatii ?? '';
		saveError = '';
		saveOk    = false;
		editOpen  = true;
	}

	async function salveaza() {
		if (!masina) return;
		saveError = '';
		saveOk    = false;
		saving    = true;
		try {
			masina = await api.updateMasina(id, {
				km_actuali:       kmInput ? Number(kmInput) : null,
				itp_valabil_pana: itpInput || null,
				observatii:       observatiiInput || null,
			});
			saveOk   = true;
			editOpen = false;
		} catch (e: any) {
			saveError = e.message ?? 'Eroare la salvare.';
		} finally {
			saving = false;
		}
	}

	const statusLabel: Record<string, string> = {
		receptie:    'Recepție',
		in_receptie: 'Recepție',
		in_lucru:    'În lucru',
		finalizat:   'Finalizat',
		livrat:      'Predată',
	};

	function formatData(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
	}
</script>

{#if loading}
	<div class="space-y-4">
		<div class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
			<Skeleton height="h-5" class="w-32 mb-2" />
			<Skeleton height="h-3" class="w-48 mb-1" />
			<Skeleton height="h-3" class="w-24" />
		</div>
		<div class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
			{#each Array(4) as _}
				<div class="flex justify-between">
					<Skeleton height="h-3" class="w-24" />
					<Skeleton height="h-3" class="w-28" />
				</div>
			{/each}
		</div>
	</div>
{:else if masina}
	<div class="pb-4">
		<div class="space-y-5">
			<a href="/dashboard/masini" class="text-sm" style="color: var(--muted)">← Înapoi</a>

			<!-- Header mașină -->
			<div class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="font-bold text-xl" style="color: var(--text)">{masina.numar_inmatriculare}</p>
						<p class="text-sm mt-1" style="color: var(--muted)">
							{masina.marca} {masina.model}{masina.an ? ` · ${masina.an}` : ''}
						</p>
						{#if masina.combustibil}
							<p class="text-xs mt-1 capitalize" style="color: var(--muted)">{masina.combustibil}</p>
						{/if}
						{#if masina.vin}
							<p class="text-xs mt-1 font-mono" style="color: var(--muted)">VIN: {masina.vin}</p>
						{/if}
					</div>
					<button
						onclick={deschideEdit}
						class="shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium"
						style="background: var(--surface2); color: var(--accent); border: 1px solid var(--border);">
						Editează
					</button>
				</div>

				{#if masina.km_actuali != null || masina.itp_valabil_pana || masina.observatii}
					<div class="mt-3 pt-3 border-t space-y-1.5" style="border-color: var(--border)">
						{#if masina.km_actuali != null}
							<p class="text-xs" style="color: var(--muted)">
								🔢 <span style="color: var(--text)">{masina.km_actuali.toLocaleString('ro-RO')} km</span>
							</p>
						{/if}
						{#if masina.itp_valabil_pana}
							<p class="text-xs" style="color: var(--muted)">
								🔬 ITP valabil până la <span style="color: var(--text)">{formatData(masina.itp_valabil_pana)}</span>
							</p>
						{/if}
						{#if masina.observatii}
							<p class="text-xs italic" style="color: var(--muted)">{masina.observatii}</p>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Form alertă — apare când e selectat un chip -->
			{#if alertaEditataTip}
				{@const tipActiv     = tipuriAlerta.find(t => t.tip === alertaEditataTip)}
				{@const existing     = alerte.find(a => a.tip === alertaEditataTip)}
				{@const summaryDoc   = summary?.documents?.find(d => d.tip === alertaEditataTip && (d.masina_id === id || d.masina_id === null))}

				<AlertDocumentCard
					{summaryDoc}
					existingData={existing?.data_expirare?.split('T')[0] ?? ''}
					existingZile={existing?.zile_inainte ?? 30}
					existingActiva={existing?.activa ?? true}
					existingThresholds={existing?.thresholds ?? null}
					hasExisting={!!existing}
					docInfo={DOC_INFO[alertaEditataTip]}
					docLabel={tipActiv?.label ?? alertaEditataTip}
					docIcon={tipActiv?.icon ?? '🔔'}
					saving={alertaSaving}
					toggling={alertaToggling}
					error={alertaError}
					success={alertaSuccess}
					onSave={handleSaveAlerta}
					onApplyRecommendation={handleAcceptRec}
					onDelete={handleDeleteAlerta}
					onToggleActiva={handleToggleActiva}
				/>
			{/if}

		<!-- Poze mașină -->
		<section>
			<h2 class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--muted)">
				Poza mașinii
			</h2>

			{#if fotos.length > 0}
				<div class="grid grid-cols-3 gap-2 mb-3">
					{#each fotos as foto, i}
						<div
							role="button"
							tabindex={i}
							draggable="true"
							ondragstart={(e) => onDragStart(e, i)}
							ondragover={(e) => onDragOver(e, i)}
							ondrop={(e) => onDrop(e, i)}
							ondragend={onDragEnd}
							class="relative rounded-xl overflow-hidden aspect-square transition-opacity"
							style="opacity: {dragFromIndex === i ? '0.4' : '1'}; outline: {dragOverIndex === i && dragFromIndex !== i ? '2px solid var(--accent)' : 'none'};">
							<img src={foto.url} alt="Poza mașină" class="w-full h-full object-cover" />
							<!-- Grip handle — puncte 2×3 -->
							<div class="absolute top-1 left-1 cursor-grab p-1 rounded-lg"
								style="background: rgba(0,0,0,0.55);">
								<div style="display:grid; grid-template-columns: repeat(2, 4px); gap: 3px;">
									{#each Array(6) as _}
										<div style="width:3px; height:3px; border-radius:50%; background:white;"></div>
									{/each}
								</div>
							</div>
							<!-- Buton ștergere -->
							<button
								onclick={() => handleFotoDelete(foto)}
								class="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
								style="background: rgba(0,0,0,0.6); color: white;">
								×
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<label class="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium cursor-pointer transition-all active:scale-[0.98]"
				style="background: var(--surface); border: 1px dashed var(--border); color: {uploadLoading ? 'var(--muted)' : 'var(--accent)'};">
				{#if uploadLoading}
					<span>Se încarcă...</span>
				{:else}
					<span>📷</span>
					<span>{fotos.length > 0 ? 'Adaugă altă poză' : 'Adaugă poza mașinii'}</span>
				{/if}
				<input type="file" accept="image/*" class="hidden" disabled={uploadLoading} onchange={handleFotoUpload} />
			</label>

			{#if uploadError}
				<p class="text-xs mt-2" style="color: var(--red)">{uploadError}</p>
			{/if}
		</section>

		<!-- Formular editare (inline, expandabil) -->
		{#if editOpen}
			<div class="p-4 rounded-2xl border space-y-4" style="background: var(--surface); border-color: var(--accent);">
				<h2 class="font-semibold text-sm" style="color: var(--text)">Actualizează informații</h2>

				<div>
					<label for="km" class="text-xs mb-1 block font-medium" style="color: var(--muted)">Kilometraj actual</label>
					<input
						id="km"
						type="number"
						bind:value={kmInput}
						min="0"
						max="9999999"
						placeholder="ex: 125000"
						class="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
				</div>

				<div>
					<label for="itp" class="text-xs mb-1 block font-medium" style="color: var(--muted)">ITP valabil până la</label>
					<input
						id="itp"
						type="date"
						bind:value={itpInput}
						class="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
				</div>

				<div>
					<label for="obs" class="text-xs mb-1 block font-medium" style="color: var(--muted)">Observații</label>
					<textarea
						id="obs"
						bind:value={observatiiInput}
						rows="2"
						placeholder="Note personale despre mașină..."
						class="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);"></textarea>
				</div>

				{#if saveError}
					<p class="text-xs text-red-400">{saveError}</p>
				{/if}

				<div class="flex gap-2">
					<button
						onclick={() => editOpen = false}
						class="flex-1 py-2.5 rounded-xl text-sm font-medium"
						style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
						Anulează
					</button>
					<button
						onclick={salveaza}
						disabled={saving}
						class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
						style="background: var(--accent); color: white;">
						{saving ? 'Se salvează...' : 'Salvează'}
					</button>
				</div>
			</div>
		{/if}

		{#if saveOk}
			<p class="text-xs text-center" style="color: #22c55e">✓ Informații actualizate.</p>
		{/if}

		<!-- Istoric reparații -->
		{#if reparatii.length > 0}
			<section>
				<h2 class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--muted)">
					Istoric reparații
				</h2>
				<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border)">
					{#each reparatii as r, i}
						<a href="/dashboard/reparatii/{r.uid}"
							class="flex items-center justify-between px-4 py-3 {i > 0 ? 'border-t' : ''} transition-all"
							style="background: var(--surface); border-color: var(--border);">
							<div>
								<span class="text-xs" style="color: var(--muted)">
									{r.reception_at ? new Date(r.reception_at).toLocaleDateString('ro-RO') : '—'}
								</span>
								{#if r.predare_la}
									<span class="text-xs ml-1" style="color: var(--muted)">
										→ {new Date(r.predare_la).toLocaleDateString('ro-RO')}
									</span>
								{/if}
							</div>
							<span class="text-xs font-medium" style="color: var(--accent)">
								{statusLabel[r.status] ?? r.status}
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		</div>
	</div>
{/if}
