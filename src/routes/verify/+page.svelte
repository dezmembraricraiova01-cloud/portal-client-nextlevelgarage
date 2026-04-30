<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { api } from '$lib/api';
	import { auth } from '$lib/stores';

	const telefon = $derived($page.url.searchParams.get('t') ?? '');
	let cod = $state('');
	let loading = $state(false);
	let error = $state('');

	async function submit() {
		error = '';
		loading = true;
		try {
			const res = await api.verifyOtp(telefon, cod);
			auth.login(res.client, res.token);
			goto('/dashboard');
		} catch (e: any) {
			error = e.message ?? 'Cod incorect sau expirat.';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center px-4" style="background: var(--bg)">
	<div class="w-full max-w-sm">
		<div class="mb-10 text-center">
			<div class="text-2xl font-bold tracking-tight mb-1" style="color: var(--text)">Verificare cod</div>
			<div style="color: var(--muted)" class="text-sm">Cod trimis la <span style="color: var(--text)">{telefon}</span></div>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-4">
			<input
				type="text"
				bind:value={cod}
				placeholder="000000"
				maxlength="6"
				inputmode="numeric"
				autocomplete="one-time-code"
				class="w-full px-4 py-3 rounded-xl text-sm text-center tracking-widest text-xl outline-none"
				style="background: var(--surface); border: 1px solid var(--border); color: var(--text);"
			/>

			{#if error}
				<p class="text-sm text-red-400 text-center">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={loading || cod.length < 6}
				class="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
				style="background: var(--accent); color: white;"
			>
				{loading ? 'Se verifică...' : 'Verifică'}
			</button>

			<a href="/login" class="block text-center text-sm" style="color: var(--muted)">
				← Înapoi
			</a>
		</form>
	</div>
</div>
