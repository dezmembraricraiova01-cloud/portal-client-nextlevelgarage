<script lang="ts">
	import type { AlertSummaryItem } from '$lib/api';
	import AlertSourceHint from './AlertSourceHint.svelte';
	import AlertRecommendation from './AlertRecommendation.svelte';
	import AlertManualOnlyHint from './AlertManualOnlyHint.svelte';
	import { getSeverityCopy } from '$lib/alerts/alert-copy';
	import { EMOJI_SUGGESTII } from '$lib/alerts/emoji-palette';

	const THRESHOLD_OPTIONS = [
		{ value: 30, label: '30 zile înainte' },
		{ value: 10, label: '10 zile înainte' },
		{ value: 1,  label: '1 zi înainte (24h)' },
	];

	let {
		summaryDoc,
		existingData       = '',
		existingZile       = 30,
		existingActiva     = true,
		existingThresholds = null,
		hasExisting        = false,
		isCustom           = false,
		docInfo,
		docLabel           = '',
		docIcon            = '🔔',
		saving             = false,
		toggling           = false,
		error              = '',
		success            = '',
		onSave,
		onApplyRecommendation,
		onDelete,
		onToggleActiva,
		onRenameCustom,
	}: {
		summaryDoc: AlertSummaryItem | null | undefined;
		existingData?: string;
		existingZile?: number;
		existingActiva?: boolean;
		existingThresholds?: number[] | null;
		hasExisting?: boolean;
		isCustom?: boolean;
		docInfo?: { desc: string; motiv: string };
		docLabel?: string;
		docIcon?: string;
		saving?: boolean;
		toggling?: boolean;
		error?: string;
		success?: string;
		onSave: (editData: string, editZile: number, thresholds: number[] | null) => void;
		onApplyRecommendation: (wmsDate: string) => void;
		onDelete: () => void;
		onToggleActiva: (next: boolean) => void;
		onRenameCustom?: (label: string, icon: string) => Promise<void> | void;
	} = $props();

	// Mod rename pentru alertele custom — schimbă doar label/icon, nu și slug-ul
	let renameMode    = $state(false);
	let renameLabel   = $state(docLabel);
	let renameIcon    = $state(docIcon);
	let renameSaving  = $state(false);
	let renameError   = $state('');

	function openRename() {
		renameLabel  = docLabel;
		renameIcon   = docIcon;
		renameError  = '';
		renameMode   = true;
	}

	function cancelRename() {
		renameMode  = false;
		renameError = '';
	}

	async function commitRename() {
		const label = renameLabel.trim();
		const icon  = renameIcon.trim();
		if (label.length < 2) { renameError = 'Numele trebuie să aibă cel puțin 2 caractere.'; return; }
		if (icon.length  < 1) { renameError = 'Alege un emoji.'; return; }
		if (!onRenameCustom)  { renameMode = false; return; }
		renameSaving = true; renameError = '';
		try {
			await onRenameCustom(label, icon);
			renameMode = false;
		} catch (e: any) {
			renameError = e?.message ?? 'Nu am putut salva modificarea.';
		} finally {
			renameSaving = false;
		}
	}

	let editData = $state(existingData);
	let editZile = $state(existingZile);

	// Mod "multiplu" — bifat dacă alerta existentă are thresholds setate
	let useMultiple    = $state(!!(existingThresholds && existingThresholds.length > 0));
	let editThresholds = $state<number[]>(existingThresholds ?? []);

	function toggleThreshold(value: number) {
		if (editThresholds.includes(value)) {
			editThresholds = editThresholds.filter(v => v !== value);
		} else {
			editThresholds = [...editThresholds, value].sort((a, b) => b - a);
		}
	}

	function handleSaveClick() {
		const thresholds = useMultiple && editThresholds.length > 0 ? editThresholds : null;
		onSave(editData, editZile, thresholds);
	}

	const isManualOnly      = $derived(summaryDoc?.source_capability === 'manual_only');
	const hasRecommendation = $derived(!!summaryDoc?.has_conflict && !!summaryDoc?.wms_date && !!summaryDoc?.client_date);
	const severitate        = $derived(summaryDoc?.severitate ?? '');
	const severityCopy      = $derived(getSeverityCopy(severitate));
</script>

<div class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--accent); border-width: 1.5px;">
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-center gap-2 min-w-0">
			<p class="text-sm font-semibold truncate" style="color: var(--text)">{docIcon} {docLabel}</p>
			{#if isCustom && hasExisting && onRenameCustom && !renameMode}
				<button type="button" onclick={openRename}
					class="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-md"
					style="color: var(--accent); background: var(--accent)15;"
					aria-label="Modifică nume și emoji">
					✏️ Modifică
				</button>
			{/if}
		</div>

		{#if hasExisting}
			<!-- Toggle activare/dezactivare notificări -->
			<button
				type="button"
				onclick={() => onToggleActiva(!existingActiva)}
				disabled={toggling}
				class="shrink-0 flex items-center gap-2 text-[11px] font-medium disabled:opacity-50"
				aria-label="{existingActiva ? 'Dezactivează notificările' : 'Activează notificările'}">
				<span style="color: {existingActiva ? '#22c55e' : 'var(--muted)'}">
					{existingActiva ? 'Notificări active' : 'Notificări oprite'}
				</span>
				<span
					class="relative inline-block rounded-full transition-colors"
					style="width: 28px; height: 16px; background: {existingActiva ? '#22c55e' : 'var(--surface2)'}; border: 1px solid {existingActiva ? '#22c55e' : 'var(--border)'};">
					<span
						class="absolute top-0.5 rounded-full bg-white transition-all"
						style="width: 12px; height: 12px; left: {existingActiva ? '13px' : '1px'};">
					</span>
				</span>
			</button>
		{/if}
	</div>

	{#if renameMode}
		<div class="p-3 rounded-xl space-y-2" style="background: var(--surface2); border: 1px solid var(--border);">
			<p class="text-[11px] font-semibold" style="color: var(--muted)">Modifică nume și emoji</p>

			<div class="flex items-center gap-2">
				<input type="text" bind:value={renameIcon}
					maxlength="6"
					class="text-2xl w-12 h-11 rounded-xl text-center outline-none"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);" />
				<input type="text" bind:value={renameLabel}
					maxlength="60"
					placeholder="Nume alertă"
					class="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);" />
			</div>

			<div class="flex flex-wrap gap-1">
				{#each EMOJI_SUGGESTII as e}
					<button type="button" onclick={() => renameIcon = e}
						class="w-8 h-8 rounded-lg text-lg transition-all active:scale-90"
						style="background: {renameIcon === e ? 'var(--accent)20' : 'var(--surface)'}; border: 1px solid {renameIcon === e ? 'var(--accent)' : 'var(--border)'};">
						{e}
					</button>
				{/each}
			</div>

			{#if renameError}<p class="text-xs" style="color: #ef4444">{renameError}</p>{/if}

			<div class="flex gap-2">
				<button type="button" onclick={cancelRename} disabled={renameSaving}
					class="py-1.5 px-3 rounded-lg text-xs font-medium"
					style="background: var(--surface); color: var(--muted); border: 1px solid var(--border);">
					Renunță
				</button>
				<button type="button" onclick={commitRename} disabled={renameSaving}
					class="flex-1 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-all active:scale-[0.98]"
					style="background: var(--accent); color: white;">
					{renameSaving ? 'Se salvează...' : 'Salvează'}
				</button>
			</div>
		</div>
	{/if}

	<!-- Context: sursă, recomandare, manual-only sau descriere document -->
	{#if isCustom}
		<div class="px-3 py-3 rounded-xl" style="background: var(--surface2); border: 1px solid var(--border);">
			<p class="text-xs font-semibold mb-1" style="color: var(--text)">✨ Alertă adăugată de tine</p>
			<p class="text-xs" style="color: var(--muted)">Nu o putem verifica automat — dar te anunțăm din timp, exact înainte să expire.</p>
		</div>

	{:else if isManualOnly}
		<AlertManualOnlyHint />

	{:else if hasRecommendation}
		<AlertRecommendation
			document={summaryDoc!}
			onapply={() => onApplyRecommendation(summaryDoc!.wms_date!)}
			{saving}
		/>

	{:else if hasExisting}
		<AlertSourceHint document={summaryDoc} {hasExisting} />

	{:else if summaryDoc?.severitate === 'missing' || !summaryDoc}
		<!-- Task 4: lipsă date -->
		<div class="px-3 py-3 rounded-xl" style="background: var(--surface2); border: 1px solid var(--border);">
			<p class="text-xs font-semibold mb-1" style="color: var(--text)">Nu avem încă această informație.</p>
			<p class="text-xs" style="color: var(--muted)">O poți adăuga, iar noi te anunțăm din timp.</p>
		</div>

	{:else if docInfo}
		<!-- Descriere document pentru alertă nouă (fără dată în WMS) -->
		<div class="px-3 py-3 rounded-xl" style="background: var(--surface2); border: 1px solid var(--border);">
			<p class="text-xs font-semibold mb-1" style="color: var(--text)">{docInfo.desc}</p>
			<p class="text-xs" style="color: var(--muted)">{docInfo.motiv}</p>
		</div>
	{/if}

	<!-- Mesaj contextual per severitate (Task 5 / Task 6) -->
	{#if severityCopy && hasExisting}
		<p class="text-xs italic px-1" style="color: {severitate === 'critic' ? '#ef4444' : '#f59e0b'}">{severityCopy}</p>
	{/if}

	<div>
		<label class="text-xs mb-1.5 block" style="color: var(--muted)">Data expirare</label>
		<input type="date" bind:value={editData}
			class="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
			style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
	</div>

	<!-- Mod notificare: simplu (zile_inainte) sau multiplu (thresholds) -->
	<div class="space-y-2">
		<label class="text-xs block" style="color: var(--muted)">Cum vrei să te anunțăm?</label>

		<div class="flex gap-2 p-1 rounded-xl" style="background: var(--surface2); border: 1px solid var(--border);">
			<button
				type="button"
				onclick={() => useMultiple = false}
				class="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
				style="background: {!useMultiple ? 'var(--accent)' : 'transparent'}; color: {!useMultiple ? 'white' : 'var(--muted)'};">
				O dată
			</button>
			<button
				type="button"
				onclick={() => useMultiple = true}
				class="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
				style="background: {useMultiple ? 'var(--accent)' : 'transparent'}; color: {useMultiple ? 'white' : 'var(--muted)'};">
				De mai multe ori
			</button>
		</div>

		{#if !useMultiple}
			<select bind:value={editZile}
				class="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
				style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);">
				<option value={7}>7 zile înainte</option>
				<option value={14}>14 zile înainte</option>
				<option value={30}>30 zile înainte</option>
				<option value={60}>60 zile înainte</option>
			</select>
		{:else}
			<div class="space-y-1.5">
				{#each THRESHOLD_OPTIONS as opt}
					{@const checked = editThresholds.includes(opt.value)}
					<button
						type="button"
						onclick={() => toggleThreshold(opt.value)}
						class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all"
						style="background: {checked ? '#3b82f610' : 'var(--surface2)'}; border: 1px solid {checked ? '#3b82f640' : 'var(--border)'};">
						<span
							class="shrink-0 flex items-center justify-center rounded transition-all"
							style="width: 16px; height: 16px; background: {checked ? '#3b82f6' : 'transparent'}; border: 1.5px solid {checked ? '#3b82f6' : 'var(--border)'};">
							{#if checked}<span class="text-white text-[10px] leading-none">✓</span>{/if}
						</span>
						<span style="color: var(--text)">{opt.label}</span>
					</button>
				{/each}
				{#if editThresholds.length === 0}
					<p class="text-[11px] italic px-1" style="color: var(--muted)">Bifează cel puțin un moment.</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if error}<p class="text-xs" style="color: #ef4444">{error}</p>{/if}
	{#if success}<p class="text-xs" style="color: #22c55e">✓ {success}</p>{/if}

	<div class="flex gap-2">
		{#if hasExisting}
			<button onclick={onDelete}
				class="py-2.5 px-4 rounded-xl text-xs font-medium"
				style="background: var(--surface2); color: #f87171; border: 1px solid var(--border);">
				Șterge
			</button>
		{/if}
		<button onclick={handleSaveClick} disabled={saving || (useMultiple && editThresholds.length === 0)}
			class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
			style="background: var(--accent); color: white;">
			{#if saving}
				Se salvează...
			{:else if hasExisting}
				Actualizează
			{:else}
				Adaugă data
			{/if}
		</button>
	</div>
</div>
