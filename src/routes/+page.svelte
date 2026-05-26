<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		const token = localStorage.getItem('portal_client');
		goto(token ? '/dashboard' : '/login');
	});
</script>
