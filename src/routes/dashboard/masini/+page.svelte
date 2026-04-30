<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Masina, type MasinaForm } from '$lib/api';

	let masini = $state<Masina[]>([]);
	let loading = $state(true);
	let showForm = $state(false);
	let saving = $state(false);
	let error = $state('');

	let form = $state<MasinaForm>({ numar_inmatriculare: '', marca: '', model: '' });

	onMount(async () => {
		masini = await api.masini();
		loading = false;
	});

	async function addMasina() {
		error = '';
		saving = true;
		try {
			const m = await api.addMasina(form);
			masini = [m, ...masini];
			showForm = false;
			form = { numar_inmatriculare: '', marca: '', model: '' };
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
		<button onclick={() => showForm = !showForm}
			class="text-sm px-4 py-2 rounded-xl font-semibold"
			style="background: var(--accent); color: white;">
			+ Adaugă
		</button>
	</div>

	{#if showForm}
		<div class="p-4 rounded-2xl border space-y-3" style="background: var(--surface); border-color: var(--border);">
			<h2 class="font-semibold text-sm" style="color: var(--text)">Mașină nouă</h2>
			{#each [
				['numar_inmatriculare', 'Nr. înmatriculare *', 'text'],
				['marca', 'Marcă *', 'text'],
				['model', 'Model *', 'text'],
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
		<div class="flex justify-center py-10">
			<div class="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
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
					class="block p-4 rounded-2xl border transition-all hover:border-blue-500/40"
					style="background: var(--surface); border-color: var(--border);">
					<div class="flex items-center justify-between">
						<div>
							<p class="font-semibold text-sm" style="color: var(--text)">{m.numar_inmatriculare}</p>
							<p class="text-xs mt-0.5" style="color: var(--muted)">{m.marca} {m.model} {m.an ? `(${m.an})` : ''}</p>
						</div>
						<button onclick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMasina(m.id); }}
							class="text-xs px-2 py-1 rounded-lg" style="color: var(--red); background: #ef444411;">
							Șterge
						</button>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
