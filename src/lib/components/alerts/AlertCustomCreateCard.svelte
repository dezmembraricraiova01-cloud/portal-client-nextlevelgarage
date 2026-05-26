<script lang="ts">
	import { EMOJI_SUGGESTII } from '$lib/alerts/emoji-palette';

	const THRESHOLD_OPTIONS = [
		{ value: 30, label: '30 zile înainte' },
		{ value: 10, label: '10 zile înainte' },
		{ value: 1,  label: '1 zi înainte (24h)' },
	];

	let {
		saving  = false,
		error   = '',
		success = '',
		onSave,
		onCancel,
	}: {
		saving?: boolean;
		error?: string;
		success?: string;
		onSave: (label: string, icon: string, data: string, zile: number, thresholds: number[] | null) => void;
		onCancel: () => void;
	} = $props();

	let label          = $state('');
	let icon           = $state('🔔');
	let data           = $state('');
	let zile           = $state(30);
	let useMultiple    = $state(false);
	let thresholds     = $state<number[]>([]);

	function toggleThreshold(value: number) {
		if (thresholds.includes(value)) {
			thresholds = thresholds.filter(v => v !== value);
		} else {
			thresholds = [...thresholds, value].sort((a, b) => b - a);
		}
	}

	function pickEmoji(e: string) {
		icon = e;
	}

	function handleSaveClick() {
		const t = useMultiple && thresholds.length > 0 ? thresholds : null;
		onSave(label.trim(), icon.trim(), data, zile, t);
	}

	const valid = $derived(
		label.trim().length >= 2 &&
		icon.trim().length >= 1 &&
		(!useMultiple || thresholds.length > 0)
	);
</script>

<div class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--accent); border-width: 1.5px;">
	<div class="flex items-start justify-between gap-3">
		<p class="text-sm font-semibold" style="color: var(--text)">✨ Alertă personalizată</p>
		<button type="button" onclick={onCancel}
			class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm"
			style="background: var(--surface2); color: var(--muted);">×</button>
	</div>

	<div class="px-3 py-3 rounded-xl" style="background: var(--surface2); border: 1px solid var(--border);">
		<p class="text-xs font-semibold mb-1" style="color: var(--text)">Creează propria alertă</p>
		<p class="text-xs" style="color: var(--muted)">
			Nu o putem verifica automat — dar te anunțăm din timp, exact înainte să expire.
		</p>
	</div>

	<div>
		<label class="text-xs mb-1.5 block" style="color: var(--muted)">Nume alertă</label>
		<input type="text" bind:value={label}
			placeholder="Ex: Extinctor, Trusă medicală, Revizie personală"
			maxlength="60"
			class="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
			style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
	</div>

	<div>
		<label class="text-xs mb-1.5 block" style="color: var(--muted)">Emoji</label>
		<div class="flex items-center gap-2 mb-2">
			<input type="text" bind:value={icon}
				maxlength="6"
				class="text-2xl w-14 h-12 rounded-xl text-center outline-none"
				style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
			<p class="text-[11px] flex-1" style="color: var(--muted)">
				Lipește orice emoji sau alege unul din lista de jos.
			</p>
		</div>
		<div class="flex flex-wrap gap-1.5">
			{#each EMOJI_SUGGESTII as e}
				<button type="button" onclick={() => pickEmoji(e)}
					class="w-9 h-9 rounded-lg text-xl transition-all active:scale-90"
					style="background: {icon === e ? 'var(--accent)20' : 'var(--surface2)'}; border: 1px solid {icon === e ? 'var(--accent)' : 'var(--border)'};">
					{e}
				</button>
			{/each}
		</div>
	</div>

	<div>
		<label class="text-xs mb-1.5 block" style="color: var(--muted)">Data expirare</label>
		<input type="date" bind:value={data}
			class="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
			style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
	</div>

	<div class="space-y-2">
		<label class="text-xs block" style="color: var(--muted)">Cum vrei să te anunțăm?</label>

		<div class="flex gap-2 p-1 rounded-xl" style="background: var(--surface2); border: 1px solid var(--border);">
			<button type="button" onclick={() => useMultiple = false}
				class="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
				style="background: {!useMultiple ? 'var(--accent)' : 'transparent'}; color: {!useMultiple ? 'white' : 'var(--muted)'};">
				O dată
			</button>
			<button type="button" onclick={() => useMultiple = true}
				class="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
				style="background: {useMultiple ? 'var(--accent)' : 'transparent'}; color: {useMultiple ? 'white' : 'var(--muted)'};">
				De mai multe ori
			</button>
		</div>

		{#if !useMultiple}
			<select bind:value={zile}
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
					{@const checked = thresholds.includes(opt.value)}
					<button type="button" onclick={() => toggleThreshold(opt.value)}
						class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all"
						style="background: {checked ? '#3b82f610' : 'var(--surface2)'}; border: 1px solid {checked ? '#3b82f640' : 'var(--border)'};">
						<span class="shrink-0 flex items-center justify-center rounded transition-all"
							style="width: 16px; height: 16px; background: {checked ? '#3b82f6' : 'transparent'}; border: 1.5px solid {checked ? '#3b82f6' : 'var(--border)'};">
							{#if checked}<span class="text-white text-[10px] leading-none">✓</span>{/if}
						</span>
						<span style="color: var(--text)">{opt.label}</span>
					</button>
				{/each}
				{#if thresholds.length === 0}
					<p class="text-[11px] italic px-1" style="color: var(--muted)">Bifează cel puțin un moment.</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if error}<p class="text-xs" style="color: #ef4444">{error}</p>{/if}
	{#if success}
		<div class="flex items-start gap-2 px-3 py-2.5 rounded-xl" style="background: #22c55e10; border: 1px solid #22c55e30;">
			<span class="text-xs shrink-0 mt-0.5">✓</span>
			<div class="flex-1">
				<p class="text-xs font-semibold" style="color: #22c55e">Alertă adăugată</p>
				<p class="text-[11px]" style="color: var(--muted)">Te anunțăm înainte să expire.</p>
			</div>
		</div>
	{/if}

	<div class="flex gap-2">
		<button type="button" onclick={onCancel}
			class="py-2.5 px-4 rounded-xl text-xs font-medium"
			style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
			Renunță
		</button>
		<button type="button" onclick={handleSaveClick} disabled={saving || !valid || !!success}
			class="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
			style="background: var(--accent); color: white;">
			{saving ? 'Se salvează...' : 'Creează alerta'}
		</button>
	</div>
</div>
