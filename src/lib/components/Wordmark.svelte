<script lang="ts">
	// Marca scrisa exact ca in magazin: „Piesa" pe culoarea textului, „365" pe
	// accent. Pentru NLG nu se coloreaza nimic (accentDeLa e null).
	import { marca } from '$lib/brand.svelte';

	let { class: clasa = '', style = '' }: { class?: string; style?: string } = $props();

	const inainte = $derived(
		marca.val.accentDeLa === null ? marca.val.nume : marca.val.nume.slice(0, marca.val.accentDeLa)
	);
	const dupa = $derived(
		marca.val.accentDeLa === null ? '' : marca.val.nume.slice(marca.val.accentDeLa)
	);
</script>

<span class={clasa} {style}>{inainte}{#if dupa}<span style="color: var(--accent)">{dupa}</span>{/if}</span>
