<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, type MasiniMini, type ProgramareForm } from '$lib/api';

	let ore = $state<string[]>([]);
	let masini = $state<MasiniMini[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');

	let form = $state<ProgramareForm>({ data: '', ora: '', nr_inmatriculare: '', notita: '' });

	onMount(async () => {
		const config = await api.programariConfig();
		ore = config.ore; masini = config.masini;
		loading = false;
	});

	async function submit() {
		error = '';
		saving = true;
		try {
			await api.addProgramare(form);
			goto('/dashboard/programari');
		} catch (e: any) { error = e.message; }
		finally { saving = false; }
	}

	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	const minDate = tomorrow.toISOString().split('T')[0];
</script>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a href="/dashboard/programari" class="text-sm" style="color: var(--muted)">← Înapoi</a>
	</div>
	<h1 class="text-xl font-bold" style="color: var(--text)">Programare nouă</h1>

	{#if loading}
		<div class="flex justify-center py-10">
			<div class="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
		</div>
	{:else}
		<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-4">
			<div>
				<label for="f-data" class="text-xs mb-1 block" style="color: var(--muted)">Data *</label>
				<input id="f-data" type="date" bind:value={form.data} min={minDate}
					class="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);" />
			</div>

			<div>
				<label for="f-ora" class="text-xs mb-1 block" style="color: var(--muted)">Ora *</label>
				<select id="f-ora" bind:value={form.ora}
					class="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);">
					<option value="">Selectează ora</option>
					{#each ore as o}<option value={o}>{o}</option>{/each}
				</select>
			</div>

			<div>
				<label for="f-masina" class="text-xs mb-1 block" style="color: var(--muted)">Mașina *</label>
				<select id="f-masina" bind:value={form.nr_inmatriculare}
					class="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);">
					<option value="">Selectează mașina</option>
					{#each masini as m}
						<option value={m.numar_inmatriculare}>{m.numar_inmatriculare} — {m.marca} {m.model}</option>
					{/each}
				</select>
			</div>

			<div>
				<label for="f-notita" class="text-xs mb-1 block" style="color: var(--muted)">Notițe (opțional)</label>
				<textarea id="f-notita" bind:value={form.notita} rows="3" placeholder="Ce probleme are mașina?"
					class="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);"></textarea>
			</div>

			{#if error}<p class="text-sm text-red-400">{error}</p>{/if}

			<button type="submit" disabled={saving || !form.data || !form.ora || !form.nr_inmatriculare}
				class="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
				style="background: var(--accent); color: white;">
				{saving ? 'Se salvează...' : 'Confirmă programarea'}
			</button>
		</form>
	{/if}
</div>
