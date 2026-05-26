<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import type { TimelineStep } from '$lib/api';

	let { steps }: { steps: TimelineStep[] } = $props();

	let wrapperEl = $state<HTMLElement>();

	// Ultimul pas marcat active (backend poate marca mai mulți active simultan)
	const lastActiveIndex = $derived(
		steps.reduce((last, s, i) => s.active ? i : last, -1)
	);

	onMount(() => {
		if (!wrapperEl || steps.length === 0) return;

		const activeEl = wrapperEl.querySelector('.ps-active') as HTMLElement | null;
		if (activeEl) {
			setTimeout(() => {
				activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
			}, 800);
		}

		const ctx = gsap.context(() => {

			gsap.from('.ps-line-filled', {
				scaleX: 0, transformOrigin: 'left center',
				duration: 0.4, stagger: 0.1, ease: 'power2.out', delay: 0.1,
			});

			gsap.from('.ps-circle', {
				scale: 0, opacity: 0,
				duration: 0.3, stagger: 0.08, ease: 'back.out(2)', delay: 0.15,
			});

			gsap.to('.ps-pulse', {
				scale: 2.8, opacity: 0,
				duration: 1.6, repeat: -1, ease: 'power1.out', transformOrigin: 'center',
			});

		}, wrapperEl);

		return () => ctx.revert();
	});
</script>

<div bind:this={wrapperEl} class="overflow-x-auto" style="scrollbar-width:none">
	<div class="flex items-start" style="min-width:max-content; padding: 16px 20px 8px">

		{#each steps as step, i}
			{@const done     = step.done && !step.declined && i !== lastActiveIndex}
			{@const declined = !!step.declined}
			{@const active   = i === lastActiveIndex && step.active}
			{@const next     = !step.done && !step.active && !step.declined && i === lastActiveIndex + 1}

			<div class="flex flex-col items-center {active ? 'ps-active' : ''}" style="min-width:80px">

				<!-- Conectori + Cerc -->
				<div class="flex items-center w-full">

					<!-- Linie stânga -->
					<div style="flex:1; min-width:0;">
						{#if i > 0}
							{#if done}
								<div class="ps-line-filled" style="height:2px; background:#22c55e;"></div>
							{:else if declined}
								<div class="ps-line-filled" style="height:2px; background:#ef4444;"></div>
							{:else if active}
								<div class="ps-line-filled" style="height:2px; background:var(--accent);"></div>
							{:else}
								<div style="height:0; border-top:2px dashed {next ? 'color-mix(in srgb,var(--accent) 40%,transparent)' : 'var(--border)'};"></div>
							{/if}
						{/if}
					</div>

					<!-- Cerc -->
					{#if active}
						<div class="ps-circle" style="
							flex-shrink:0; position:relative;
							display:flex; align-items:center; justify-content:center;
							width:44px; height:44px; border-radius:50%;
							background:var(--accent);
							box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent);
						">
							<div class="ps-pulse" style="
								position:absolute; inset:0; border-radius:50%;
								background:var(--accent); opacity:0.4; pointer-events:none;
							"></div>
							<span style="position:relative; z-index:1; font-size:15px; font-weight:800; color:white; line-height:1;">
								{i + 1}
							</span>
						</div>

					{:else if done}
						<div class="ps-circle" style="
							flex-shrink:0; position:relative;
							display:flex; align-items:center; justify-content:center;
							width:22px; height:22px; border-radius:50%;
							background:#22c55e;
						">
							<span style="font-size:11px; font-weight:700; color:white; line-height:1;">✓</span>
						</div>

					{:else if declined}
						<div class="ps-circle" style="
							flex-shrink:0; position:relative;
							display:flex; align-items:center; justify-content:center;
							width:22px; height:22px; border-radius:50%;
							background:#ef4444;
						">
							<span style="font-size:11px; font-weight:700; color:white; line-height:1;">✕</span>
						</div>

					{:else if next}
						<div class="ps-circle" style="
							flex-shrink:0; position:relative;
							display:flex; align-items:center; justify-content:center;
							width:28px; height:28px; border-radius:50%;
							background:transparent;
							border:2px solid var(--accent);
						">
							<span style="font-size:11px; font-weight:700; color:var(--accent); line-height:1;">{i + 1}</span>
						</div>

					{:else}
						<div class="ps-circle" style="
							flex-shrink:0; position:relative;
							display:flex; align-items:center; justify-content:center;
							width:22px; height:22px; border-radius:50%;
							background:transparent;
							border:2px solid var(--border);
						">
							<span style="font-size:10px; font-weight:500; color:var(--muted); line-height:1;">{i + 1}</span>
						</div>
					{/if}

					<!-- Linie dreapta -->
					<div style="flex:1; min-width:0;">
						{#if i < steps.length - 1}
							{#if steps[i+1]?.done && !steps[i+1]?.declined}
								<div class="ps-line-filled" style="height:2px; background:#22c55e;"></div>
							{:else if steps[i+1]?.declined}
								<div class="ps-line-filled" style="height:2px; background:#ef4444;"></div>
							{:else if active}
								<div style="height:0; border-top:2px dashed color-mix(in srgb,var(--accent) 40%,transparent);"></div>
							{:else}
								<div style="height:0; border-top:2px dashed var(--border);"></div>
							{/if}
						{/if}
					</div>

				</div>

				<!-- Etichetă -->
				<div class="text-center" style="margin-top:9px; width:80px; padding:0 2px;">
					<p style="
						font-size:{active ? '10.5px' : '9px'};
						font-weight:{active ? 700 : done ? 500 : 400};
						line-height:1.3;
						color:{active ? 'var(--accent)' : done ? 'var(--text)' : declined ? '#ef4444' : 'var(--muted)'};
					">{step.label}</p>
					{#if step.sublabel}
						<p style="font-size:8px; color:var(--muted); margin-top:3px; line-height:1.2;">{step.sublabel}</p>
					{/if}
				</div>

			</div>
		{/each}

	</div>
</div>

<style>
	div::-webkit-scrollbar { display:none }
</style>
