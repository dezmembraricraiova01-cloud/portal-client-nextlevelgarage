<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Masina, type MasinaForm, type MarcaAuto, type ModelAuto } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';
	import Combobox from '$lib/components/Combobox.svelte';

	let masini = $state<Masina[]>([]);
	let loading = $state(true);
	let showForm = $state(false);
	let saving = $state(false);
	let error = $state('');

	let form = $state<MasinaForm>({ numar_inmatriculare: '', marca: '', model: '' });

	// Marcă/Model din nomenclatorul WMS, cu fallback manual „+ Alta"
	let marci       = $state<MarcaAuto[]>([]);
	let marcaId     = $state<number | null>(null);
	let marcaManual = $state(false);
	let marcaText   = $state('');

	let modele        = $state<ModelAuto[]>([]);
	let modelId       = $state<number | null>(null);
	let modelManual   = $state(false);
	let modelText     = $state('');
	let loadingModele = $state(false);

	const marcaFinala = $derived(
		marcaManual ? marcaText.trim() : (marci.find(m => m.id === marcaId)?.nume ?? '')
	);
	const modelFinal = $derived(
		modelManual ? modelText.trim() : (modele.find(m => m.id === modelId)?.denumire ?? '')
	);

	// Combobox lucrează cu {id, nume}; modelele vin cu `denumire`.
	const modeleOptiuni = $derived(modele.map(m => ({ id: m.id, nume: m.denumire })));

	onMount(async () => {
		masini = await api.masini();
		loading = false;
	});

	function toggleForm() {
		showForm = !showForm;
		if (showForm && marci.length === 0) {
			api.marci().then(m => { marci = m; }).catch(() => {});
		}
	}

	$effect(() => {
		if (marcaId && !marcaManual) {
			modele = []; modelId = null; loadingModele = true;
			api.modele(marcaId)
				.then(m => { modele = m; })
				.catch(() => {})
				.finally(() => { loadingModele = false; });
		}
	});

	function toggleMarcaManual() {
		marcaManual = !marcaManual; marcaText = ''; marcaId = null;
		modele = []; modelId = null; modelManual = false; modelText = '';
	}

	function toggleModelManual() {
		modelManual = !modelManual; modelText = ''; modelId = null;
	}

	async function addMasina() {
		error = '';
		if (!marcaFinala) { error = 'Selectează marca.'; return; }
		if (!modelFinal)  { error = 'Selectează modelul.'; return; }
		saving = true;
		try {
			const m = await api.addMasina({ ...form, marca: marcaFinala, model: modelFinal });
			masini = [m, ...masini];
			showForm = false;
			form = { numar_inmatriculare: '', marca: '', model: '' };
			marcaId = null; marcaManual = false; marcaText = '';
			modele = []; modelId = null; modelManual = false; modelText = '';
		} catch (e: any) { error = e.message; }
		finally { saving = false; }
	}

	async function deleteMasina(id: number) {
		if (!confirm('Ești sigur că vrei să ștergi mașina?')) return;
		try {
			await api.deleteMasina(id);
			masini = masini.filter(m => m.id !== id);
		} catch (e: any) { alert(e.message); }
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold" style="color: var(--text)">Mașinile mele</h1>
		<button onclick={toggleForm}
			class="text-sm px-4 py-2 rounded-xl font-semibold"
			style="background: var(--accent); color: white;">
			+ Adaugă
		</button>
	</div>

	{#if showForm}
		<div class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
			<h2 class="font-semibold text-sm" style="color: var(--text)">Mașină nouă</h2>
			<div>
				<label class="text-xs mb-1 block" style="color: var(--muted)">Nr. înmatriculare *</label>
				<input type="text" bind:value={form.numar_inmatriculare}
					class="w-full px-3 py-2 rounded-xl text-sm outline-none"
					style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
			</div>

			<!-- Marcă — dropdown din nomenclatorul WMS, cu fallback manual -->
			<div>
				<label class="text-xs mb-1 block" style="color: var(--muted)">Marcă *</label>
				<div class="flex gap-2">
					{#if marcaManual}
						<input type="text" bind:value={marcaText} placeholder="Ex: Dacia, BMW..."
							class="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
							style="background: var(--surface2); border: 1px solid var(--accent); color: var(--text);" />
						<button type="button" onclick={toggleMarcaManual}
							class="px-3 py-2 rounded-xl text-xs font-semibold"
							style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
							Listă
						</button>
					{:else}
						<div class="flex-1">
							<Combobox
								optiuni={marci}
								bind:value={marcaId}
								placeholder="Scrie marca (ex: Opel)"
								golText="Nicio marcă găsită — apasă + Alta" />
						</div>
						<button type="button" onclick={toggleMarcaManual}
							class="px-3 py-2 rounded-xl text-xs font-semibold"
							style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
							+ Alta
						</button>
					{/if}
				</div>
			</div>

			<!-- Model — dependent de marca aleasă -->
			<div>
				<label class="text-xs mb-1 block" style="color: var(--muted)">Model *</label>
				<div class="flex gap-2">
					{#if modelManual}
						<input type="text" bind:value={modelText} placeholder="Ex: Logan, Seria 3..."
							class="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
							style="background: var(--surface2); border: 1px solid var(--accent); color: var(--text);" />
						<button type="button" onclick={toggleModelManual}
							class="px-3 py-2 rounded-xl text-xs font-semibold"
							style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
							Listă
						</button>
					{:else}
						<div class="flex-1">
							<Combobox
								optiuni={modeleOptiuni}
								bind:value={modelId}
								disabled={!marcaId && !marcaManual}
								loading={loadingModele}
								placeholder="Scrie modelul (ex: Astra)"
								golText="Niciun model găsit — apasă + Alt" />
						</div>
						<button type="button" onclick={toggleModelManual} disabled={!marcaId && !marcaManual}
							class="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
							style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
							+ Alt
						</button>
					{/if}
				</div>
			</div>

			{#each [
				['an', 'An fabricație', 'number'],
				['vin', 'VIN (17 caractere)', 'text'],
			] as [key, label, type]}
				<div>
					<label class="text-xs mb-1 block" style="color: var(--muted)">{label}</label>
					<input {type} bind:value={form[key as keyof MasinaForm]}
						class="w-full px-3 py-2 rounded-xl text-sm outline-none"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);" />
				</div>
			{/each}
			<div>
				<label class="text-xs mb-1 block" style="color: var(--muted)">Combustibil</label>
				<select bind:value={form.combustibil}
					class="w-full px-3 py-2 rounded-xl text-sm outline-none"
					style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);">
					<option value="">—</option>
					{#each ['benzina','motorina','hibrid','electric','gpl'] as c}
						<option value={c}>{c}</option>
					{/each}
				</select>
			</div>
			{#if error}<p class="text-xs text-red-400">{error}</p>{/if}
			<button onclick={addMasina} disabled={saving}
				class="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
				style="background: var(--accent); color: white;">
				{saving ? 'Se salvează...' : 'Salvează'}
			</button>
		</div>
	{/if}

	{#if loading}
		<div class="space-y-3">
			{#each Array(2) as _}
				<div class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
					<div class="flex items-center justify-between">
						<div class="space-y-1.5">
							<Skeleton height="h-4" class="w-24" />
							<Skeleton height="h-3" class="w-36" />
						</div>
						<Skeleton height="h-6" class="w-12" rounded="rounded-lg" />
					</div>
				</div>
			{/each}
		</div>
	{:else if masini.length === 0}
		<div class="text-center py-10" style="color: var(--muted)">
			<p class="text-3xl mb-2">🚗</p>
			<p class="text-sm">Nu ai mașini înregistrate.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each masini as m}
				<a href="/dashboard/masini/{m.id}"
					class="block rounded-2xl border overflow-hidden transition-all hover:border-blue-500/40"
					style="background: var(--surface); border-color: var(--border);">
					{#if m.foto_url}
						<div class="relative h-28 overflow-hidden">
							<img src={m.foto_url} alt="{m.marca} {m.model}" class="w-full h-full object-cover" style="opacity: 0.85;" />
							<div class="absolute inset-0" style="background: linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.65) 100%)"></div>
							<div class="absolute bottom-0 left-0 right-0 flex items-end justify-between px-4 py-2.5">
								<div>
									<p class="font-bold text-sm text-white leading-tight">{m.numar_inmatriculare}</p>
									<p class="text-xs text-white/70">{m.marca} {m.model} {m.an ? `(${m.an})` : ''}</p>
								</div>
								<button onclick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMasina(m.id); }}
									class="text-xs px-2 py-1 rounded-lg font-medium"
									style="background: rgba(239,68,68,0.25); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4);">
									Șterge
								</button>
							</div>
						</div>
					{:else}
						<div class="flex items-center justify-between p-4">
							<div>
								<p class="font-semibold text-sm" style="color: var(--text)">{m.numar_inmatriculare}</p>
								<p class="text-xs mt-0.5" style="color: var(--muted)">{m.marca} {m.model} {m.an ? `(${m.an})` : ''}</p>
							</div>
							<button onclick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMasina(m.id); }}
								class="text-xs px-2 py-1 rounded-lg" style="color: var(--red); background: #ef444411;">
								Șterge
							</button>
						</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>
