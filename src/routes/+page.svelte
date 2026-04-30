<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		const token = localStorage.getItem('portal_token');
		goto(token ? '/dashboard' : '/login');
	});
</script>
