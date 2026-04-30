<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$lib/stores';
	import { api } from '$lib/api';

	let { children } = $props();
	let client = $derived($auth);

	onMount(async () => {
		if (!auth.token()) { goto('/login'); return; }
		try { await api.me(); }
		catch { auth.logout(); goto('/login'); }
	});

	async function logout() {
		try { await api.logout(); } catch {}
		auth.logout();
		goto('/login');
	}

	const navItems = [
		{ href: '/dashboard', label: 'Acasă', icon: '⌂' },
		{ href: '/dashboard/reparatii', label: 'Reparații', icon: '🔧' },
		{ href: '/dashboard/programari', label: 'Programări', icon: '📅' },
		{ href: '/dashboard/masini', label: 'Mașinile mele', icon: '🚗' },
		{ href: '/dashboard/documente', label: 'Documente', icon: '📄' },
	];

	const currentPath = $derived($page.url.pathname);
</script>

<div class="min-h-screen flex flex-col" style="background: var(--bg)">
	<!-- Header -->
	<header class="sticky top-0 z-50 flex items-center justify-between px-4 h-14 border-b"
		style="background: var(--surface); border-color: var(--border);">
		<span class="font-bold text-base tracking-tight" style="color: var(--text)">NLG Portal</span>
		{#if client}
			<div class="flex items-center gap-3">
				<span class="text-sm" style="color: var(--muted)">{client.nume}</span>
				<button onclick={logout} class="text-xs px-3 py-1.5 rounded-lg transition"
					style="background: var(--surface2); color: var(--muted);">
					Ieși
				</button>
			</div>
		{/if}
	</header>

	<!-- Content -->
	<main class="flex-1 px-4 py-6 max-w-2xl w-full mx-auto pb-24">
		{@render children()}
	</main>

	<!-- Bottom Nav -->
	<nav class="fixed bottom-0 left-0 right-0 border-t flex"
		style="background: var(--surface); border-color: var(--border);">
		{#each navItems as item}
			<a href={item.href}
				class="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors"
				style="color: {currentPath === item.href ? 'var(--accent)' : 'var(--muted)'}">
				<span class="text-lg leading-none">{item.icon}</span>
				<span class="text-[10px]">{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
