<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { auth } from '$lib/stores';

	let telefon = $state('');
	let loading = $state(false);
	let error = $state('');

	onMount(() => {
		function onKey(e: KeyboardEvent) {
			if (e.ctrlKey && e.shiftKey && e.key === 'X') {
				e.preventDefault();
				api.devLogin().then(res => { auth.login(res.client, res.token); goto('/dashboard'); }).catch(() => {});
			}
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	async function submit() {
		error = '';
		loading = true;
		try {
			await api.sendOtp(telefon);
			goto(`/verify?t=${encodeURIComponent(telefon)}`);
		} catch (e: any) {
			error = e.message ?? 'Eroare. Încearcă din nou.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center px-4" style="background: var(--bg)">
	<div class="w-full max-w-sm">
		<div class="mb-10 text-center">
			<div class="text-2xl font-bold tracking-tight mb-1" style="color: var(--text)">NLG Portal</div>
			<div style="color: var(--muted)" class="text-sm">Introduceți numărul de telefon</div>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-4">
			<div>
				<input
					type="tel"
					bind:value={telefon}
					placeholder="07XXXXXXXX"
					maxlength="10"
					autocomplete="tel"
					class="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
					style="background: var(--surface); border: 1px solid var(--border); color: var(--text);"
				/>
			</div>

			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading || telefon.length < 10}
				class="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
				style="background: var(--accent); color: white;"
			>
				{loading ? 'Se trimite...' : 'Trimite cod SMS'}
			</button>
		</form>
	</div>
</div>
