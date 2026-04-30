<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores';

	let { children } = $props();

	onMount(() => auth.restore());
</script>

<svelte:head>
	<title>NLG Portal</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

{@render children()}
