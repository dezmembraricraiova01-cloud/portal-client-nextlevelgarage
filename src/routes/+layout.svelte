<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores';
	import { page } from '$app/state';
	import CookieBanner from '$lib/CookieBanner.svelte';

	let { children } = $props();

	const AUTH_PATHS = new Set(['/login', '/register', '/verify']);
	const isAuth = $derived(AUTH_PATHS.has(page.url.pathname as string));

	onMount(() => auth.restore());
</script>

<svelte:head>
	<title>NLG Portal</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

{#if isAuth}
	<div class="auth-shell">
		<!-- Fundalul foto -->
		<div class="auth-bg"></div>
		<!-- Overlay dark + blur -->
		<div class="auth-overlay"></div>
		<!-- Conținut centrat -->
		<div class="auth-content">
			{@render children()}
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<!-- Cookie banner — apare doar la prima vizită; redeschis prin event "open-cookie-banner" -->
<CookieBanner />

<style>
	.auth-shell {
		position: relative;
		min-height: 100dvh;
		overflow: hidden;
	}

	.auth-bg {
		position: absolute;
		inset: 0;
		/* Fundal solid (bg-atelier.jpg eliminat — asset lipsea) */
		background: linear-gradient(135deg, #0a0d14 0%, #131826 50%, #0e1320 100%);
	}

	.auth-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			rgba(8, 10, 18, 0.72) 0%,
			rgba(8, 10, 18, 0.60) 50%,
			rgba(8, 10, 18, 0.82) 100%
		);
	}

	.auth-content {
		position: relative;
		z-index: 10;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
</style>
