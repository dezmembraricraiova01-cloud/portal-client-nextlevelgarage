<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { cookies } from '$lib/cookies';

	let visible    = $state(false);
	let panelEl    = $state<HTMLElement | undefined>();
	let backdropEl = $state<HTMLElement | undefined>();

	// Mod customize
	let customize  = $state(false);
	let functionale = $state(false);
	let analytics   = $state(false);
	let marketing   = $state(false);

	onMount(() => {
		if (!cookies.hasDecided()) {
			visible = true;
			// Permite afișare cu mic delay (după montare layout)
			setTimeout(() => animateIn(), 200);
		}

		// Permite redeschidere din alt loc (linkul „Setări cookies")
		const onOpen = () => {
			const cur = cookies.get();
			if (cur) { functionale = cur.functionale; analytics = cur.analytics; marketing = cur.marketing; }
			customize = true;
			visible = true;
			setTimeout(() => animateIn(), 50);
		};
		window.addEventListener('open-cookie-banner', onOpen);
		return () => window.removeEventListener('open-cookie-banner', onOpen);
	});

	function animateIn() {
		if (panelEl) {
			gsap.fromTo(panelEl,
				{ y: 100, opacity: 0 },
				{ y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
		}
		if (backdropEl && customize) {
			gsap.fromTo(backdropEl, { opacity: 0 }, { opacity: 1, duration: 0.3 });
		}
	}

	async function close() {
		if (panelEl) await gsap.to(panelEl, { y: 100, opacity: 0, duration: 0.3, ease: 'power2.in' });
		if (backdropEl) gsap.to(backdropEl, { opacity: 0, duration: 0.2 });
		visible = false;
		customize = false;
	}

	function acceptAll()   { cookies.acceptAll();   close(); }
	function rejectAll()   { cookies.rejectAll();   close(); }
	function saveCustom()  { cookies.saveCustom({ functionale, analytics, marketing }); close(); }

	function openCustomize() { customize = true; }
</script>

{#if visible}
	{#if customize}
		<div bind:this={backdropEl}
			class="fixed inset-0 z-[180]"
			style="background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);">
		</div>
	{/if}

	<div bind:this={panelEl}
		class="fixed left-2 right-2 sm:left-4 sm:right-4 z-[181] rounded-2xl overflow-hidden"
		style="
			bottom: 8px;
			max-width: {customize ? '480px' : '720px'};
			margin: 0 auto;
			background: var(--surface, #0b0d16);
			color: var(--text, #fff);
			border: 1px solid var(--border, rgba(255,255,255,0.12));
			box-shadow: 0 24px 64px rgba(0,0,0,0.55);
			max-height: calc(100dvh - 16px);
			display: flex;
			flex-direction: column;
		">

		{#if !customize}
			<!-- ── Banner compact ──────────────────────────────────── -->
			<div class="px-4 py-3.5 sm:px-5 sm:py-4">
				<div class="flex items-start gap-3 mb-3">
					<span class="text-2xl shrink-0">🍪</span>
					<div class="flex-1 min-w-0">
						<p class="text-sm font-bold mb-1">Folosim cookies</p>
						<p class="text-[12px] leading-relaxed" style="color: var(--muted, rgba(255,255,255,0.6))">
							Folosim cookies strict necesare pentru ca aplicația să funcționeze. Cu acordul tău,
							putem folosi și cookies pentru a-ți reține preferințele și pentru a îmbunătăți serviciul.
							<a href="/legal/cookies" target="_blank" style="color: var(--accent, #3b82f6); text-decoration: underline;">
								Detalii
							</a>
						</p>
					</div>
				</div>

				<div class="flex flex-wrap gap-2">
					<button onclick={rejectAll}
						class="flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
						style="background: var(--surface2, rgba(255,255,255,0.08)); color: var(--text, #fff); border: 1px solid var(--border, rgba(255,255,255,0.12));">
						Refuză tot
					</button>
					<button onclick={openCustomize}
						class="flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
						style="background: var(--surface2, rgba(255,255,255,0.08)); color: var(--text, #fff); border: 1px solid var(--border, rgba(255,255,255,0.12));">
						Personalizează
					</button>
					<button onclick={acceptAll}
						class="flex-1 min-w-[120px] py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
						style="background: var(--accent, #3b82f6); color: white; border: none;">
						Accept tot
					</button>
				</div>
			</div>
		{:else}
			<!-- ── Mod customize ───────────────────────────────────── -->
			<div class="px-5 pt-5 pb-3 shrink-0">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-base font-bold">Preferințe cookies</h2>
					<button onclick={close}
						class="w-7 h-7 rounded-full flex items-center justify-center"
						style="background: var(--surface2, rgba(255,255,255,0.08)); color: var(--muted); font-size: 16px; border: none;">×</button>
				</div>
				<p class="text-[11px] leading-relaxed" style="color: var(--muted)">
					Alegi tu ce cookies acceptăm. Poți schimba oricând setările.
					<a href="/legal/cookies" target="_blank" style="color: var(--accent); text-decoration: underline;">Vezi politica</a>
				</p>
			</div>

			<div class="px-5 py-2 space-y-2 overflow-y-auto flex-1">

				<!-- Necesare — disabled -->
				<div class="rounded-xl px-3.5 py-3 flex items-start gap-3"
					style="background: var(--surface2, rgba(255,255,255,0.04)); border: 1px solid var(--border);">
					<input type="checkbox" checked disabled class="w-4 h-4 mt-0.5 shrink-0 accent-blue-500 opacity-60" />
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold">Strict necesare</div>
						<p class="text-[11px] mt-0.5" style="color: var(--muted)">
							Autentificare, securitate, salvarea preferințelor de bază. Fără ele aplicația nu funcționează.
						</p>
					</div>
				</div>

				<!-- Functionale -->
				<label class="rounded-xl px-3.5 py-3 flex items-start gap-3 cursor-pointer"
					style="background: var(--surface2, rgba(255,255,255,0.04)); border: 1.5px solid {functionale ? 'var(--accent)' : 'var(--border)'};">
					<input type="checkbox" bind:checked={functionale} class="w-4 h-4 mt-0.5 shrink-0 accent-blue-500" />
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold">Funcționale</div>
						<p class="text-[11px] mt-0.5" style="color: var(--muted)">
							Reține tema (light/dark), preferințele de afișare, ultima mașină vizualizată.
						</p>
					</div>
				</label>

				<!-- Analytics -->
				<label class="rounded-xl px-3.5 py-3 flex items-start gap-3 cursor-pointer"
					style="background: var(--surface2, rgba(255,255,255,0.04)); border: 1.5px solid {analytics ? 'var(--accent)' : 'var(--border)'};">
					<input type="checkbox" bind:checked={analytics} class="w-4 h-4 mt-0.5 shrink-0 accent-blue-500" />
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold">Analiză anonimă</div>
						<p class="text-[11px] mt-0.5" style="color: var(--muted)">
							Statistici agregate despre utilizare (ex: ce pagini se folosesc cel mai mult). Fără identificare.
						</p>
					</div>
				</label>

				<!-- Marketing -->
				<label class="rounded-xl px-3.5 py-3 flex items-start gap-3 cursor-pointer"
					style="background: var(--surface2, rgba(255,255,255,0.04)); border: 1.5px solid {marketing ? 'var(--accent)' : 'var(--border)'};">
					<input type="checkbox" bind:checked={marketing} class="w-4 h-4 mt-0.5 shrink-0 accent-blue-500" />
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold">Marketing</div>
						<p class="text-[11px] mt-0.5" style="color: var(--muted)">
							Cookies pentru a-ți afișa oferte relevante. În prezent NU folosim cookies de tracking publicitar.
						</p>
					</div>
				</label>
			</div>

			<div class="px-5 pt-3 pb-5 shrink-0 flex flex-wrap gap-2">
				<button onclick={rejectAll}
					class="flex-1 min-w-[100px] py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
					style="background: var(--surface2, rgba(255,255,255,0.08)); color: var(--text); border: 1px solid var(--border);">
					Refuză tot
				</button>
				<button onclick={saveCustom}
					class="flex-1 min-w-[100px] py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
					style="background: var(--accent); color: white; border: none;">
					Salvează preferințele
				</button>
				<button onclick={acceptAll}
					class="flex-1 min-w-[100px] py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
					style="background: var(--accent); color: white; border: none;">
					Accept tot
				</button>
			</div>
		{/if}
	</div>
{/if}
