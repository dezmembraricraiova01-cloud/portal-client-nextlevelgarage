<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gsap } from 'gsap';
	import { api } from '$lib/api';
	import { auth } from '$lib/stores';

	let telefon = $state('');
	let loading = $state(false);
	let error   = $state('');
	let isAuto  = $state(false);
	let needsRegistration = $state(false);

	// Numarul editat → ascunde panoul "nu ai cont" ramas de la o incercare veche.
	$effect(() => { telefon; needsRegistration = false; });

	// DOM refs — nu au nevoie de reactivitate, sunt folosite doar în GSAP
	let cardEl:      HTMLElement | undefined;
	let formEl:      HTMLElement | undefined;
	let submitBtn:   HTMLElement | undefined;
	let registerBtn: HTMLElement | undefined;
	let charEls:     (HTMLElement | undefined)[] = $state([]);

	const TITLE = 'NLG Portal';
	const cleanups: (() => void)[] = [];

	const telefonValid = $derived(/^07\d{8}$/.test(telefon));

	// Pulse pe buton când numărul devine valid
	$effect(() => {
		if (telefonValid && submitBtn) {
			gsap.fromTo(submitBtn,
				{ scale: 0.96 },
				{ scale: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' }
			);
		}
	});

	onMount(() => {
		const touch = window.matchMedia('(pointer: coarse)').matches;
		const bg    = document.querySelector<HTMLElement>('.auth-bg');

		// ── 1. Reveal sequence ────────────────────────────────────────────────
		const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

		// Background: scale 1.08 → 1.03 la intrare (adâncime)
		if (bg) {
			gsap.set(bg, { scale: 1.08 });
			tl.to(bg, { scale: 1.03, duration: 1.6, ease: 'power2.out' }, 0);
		}

		// Titlu: litere cad cu rotație 3D
		const chars = charEls.filter(Boolean) as HTMLElement[];
		if (chars.length) {
			gsap.set(chars, { rotationX: -90, opacity: 0, y: 14, transformOrigin: '50% 50% -20px' });
			tl.to(chars, { rotationX: 0, opacity: 1, y: 0, duration: 0.55, stagger: 0.05, ease: 'back.out(2.2)' }, 0.1);
		}

		// Card apare din jos
		if (cardEl) {
			gsap.set(cardEl, { opacity: 0, y: 36, scale: 0.96 });
			tl.to(cardEl, { opacity: 1, y: 0, scale: 1, duration: 0.52 }, 0.45);
		}

		// ── 3. Parallax cu mousemove ──────────────────────────────────────────
		if (!touch) {
			const onParallax = (e: MouseEvent) => {
				const nx = (e.clientX / window.innerWidth  - 0.5); // -0.5 to 0.5
				const ny = (e.clientY / window.innerHeight - 0.5);
				if (bg) gsap.to(bg, { x: nx * 18, y: ny * 12, duration: 1.4, ease: 'power2.out' });
				// Card se mișcă ușor invers — efect de profunzime
				if (cardEl) gsap.to(cardEl, { x: nx * -7, y: ny * -5, duration: 1.1, ease: 'power2.out' });
			};
			window.addEventListener('mousemove', onParallax);
			cleanups.push(() => window.removeEventListener('mousemove', onParallax));
		}

		// ── 4. Magnetic buttons ───────────────────────────────────────────────
		if (!touch) {
			[submitBtn, registerBtn].filter(Boolean).forEach(btn => {
				const onMove = (e: MouseEvent) => {
					const r  = btn!.getBoundingClientRect();
					const dx = (e.clientX - (r.left + r.width  / 2)) * 0.28;
					const dy = (e.clientY - (r.top  + r.height / 2)) * 0.28;
					gsap.to(btn!, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
				};
				const onLeave = () => gsap.to(btn!, { x: 0, y: 0, duration: 0.65, ease: 'elastic.out(1, 0.4)' });
				btn!.addEventListener('mousemove', onMove);
				btn!.addEventListener('mouseleave', onLeave);
				cleanups.push(() => {
					btn!.removeEventListener('mousemove', onMove);
					btn!.removeEventListener('mouseleave', onLeave);
				});
			});
		}

		// Dev shortcut: Ctrl+Shift+X. Plus URL ?dev=1 ca fallback fara tastatura.
		// (Ctrl+Shift+<cifra> e prins de Windows pentru switch keyboard layout — nu ajunge la browser.)
		const triggerDevLogin = () => {
			api.devLogin().then(r => { auth.login(r.client); goto('/dashboard'); }).catch(() => {});
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && (e.key === 'X' || e.key === 'x' || e.code === 'KeyX')) {
				e.preventDefault();
				triggerDevLogin();
			}
		};
		window.addEventListener('keydown', onKey);
		cleanups.push(() => window.removeEventListener('keydown', onKey));

		if (page.url.searchParams.get('dev') === '1') {
			triggerDevLogin();
		}

		// URL params
		const t = page.url.searchParams.get('t');
		if (t) {
			telefon = decodeURIComponent(t);
			if (page.url.searchParams.get('auto') === '1') {
				isAuto = true;
				tick().then(() => submit());
			}
		}

		return () => cleanups.forEach(fn => fn());
	});

	async function submit() {
		error = ''; needsRegistration = false; loading = true;
		try {
			const res = await api.sendOtp(telefon);
			if (res.needs_registration) {
				needsRegistration = true;
				if (formEl) gsap.fromTo(formEl,
					{ x: -8 },
					{ x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)',
					  keyframes: [{ x: -8 }, { x: 8 }, { x: -4 }, { x: 4 }, { x: 0 }] }
				);
				return;
			}
			const n = page.url.searchParams.get('n') ?? '';
			const ret = page.url.searchParams.get('return') ?? '';
			const url = `/verify?t=${encodeURIComponent(telefon)}${isAuto ? '&auto=1' : ''}${n ? '&n=' + encodeURIComponent(n) : ''}${ret ? '&return=' + encodeURIComponent(ret) : ''}`;
			if (cardEl) await gsap.to(cardEl, { opacity: 0, y: -28, scale: 1.02, duration: 0.28, ease: 'power2.in' });
			goto(url);
		} catch (e: any) {
			error = e.message ?? 'Eroare. Încearcă din nou.';
			// Shake animat pe eroare
			if (formEl) gsap.fromTo(formEl,
				{ x: -10 },
				{ x: 0, duration: 0.55, ease: 'elastic.out(1, 0.25)',
				  keyframes: [{ x: -10 }, { x: 10 }, { x: -7 }, { x: 7 }, { x: -3 }, { x: 3 }, { x: 0 }] }
			);
		} finally { loading = false; }
	}
</script>

<div class="min-h-screen flex flex-col items-center justify-center px-4 py-10">

	<!-- Titlu split-text -->
	<div class="mb-8 text-center" style="perspective: 600px">
		<h1 class="flex items-center justify-center text-3xl font-black tracking-tight mb-1.5"
			style="text-shadow: 0 2px 18px rgba(0,0,0,0.65);">
			{#each TITLE.split('') as char, i}
				<span
					bind:this={charEls[i]}
					class="inline-block"
					style="color: white; white-space: pre;"
				>{char}</span>
			{/each}
		</h1>
		<p class="text-sm font-medium" style="color: rgba(255,255,255,0.55)">
			Servicii auto premium — la un SMS distanță
		</p>
	</div>

	<!-- Card glassmorphism -->
	<div bind:this={cardEl} class="w-full max-w-sm">
		<div class="rounded-3xl overflow-hidden"
			style="background: rgba(11,13,22,0.84); border: 1px solid rgba(255,255,255,0.10); backdrop-filter: blur(20px); box-shadow: 0 28px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);">

			<!-- Login -->
			<div class="px-6 pt-7 pb-2">
				<p class="text-base font-bold mb-0.5" style="color: white">Bine ai venit</p>
				<p class="text-xs mb-5" style="color: rgba(255,255,255,0.42)">
					Autentifică-te cu numărul de telefon
				</p>

				<form bind:this={formEl} onsubmit={(e) => { e.preventDefault(); submit(); }} class="space-y-3">
					<input
						type="tel"
						bind:value={telefon}
						placeholder="07XXXXXXXX"
						maxlength="10"
						autocomplete="tel"
						class="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
						style="background: rgba(255,255,255,0.07); border: 1.5px solid {/^07\d{8}$/.test(telefon) ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}; color: white;"
					/>
					{#if error}
						<p class="text-xs" style="color: #f87171">{error}</p>
					{/if}

					{#if needsRegistration}
						<div class="rounded-xl p-3.5"
							style="background: rgba(59,130,246,0.10); border: 1px solid rgba(59,130,246,0.28);">
							<p class="text-xs mb-2.5" style="color: rgba(255,255,255,0.78)">
								Numărul <span class="font-semibold" style="color: white">{telefon}</span>
								nu are încă un cont. Îți poți crea unul în mai puțin de un minut.
							</p>
							<a href="/register?t={encodeURIComponent(telefon)}"
								class="block w-full py-2.5 rounded-lg text-sm font-bold text-center active:scale-[0.98]"
								style="background: var(--accent); color: white; text-decoration: none;">
								Creează cont cu acest număr
							</a>
						</div>
					{:else}
						<button bind:this={submitBtn}
							type="submit"
							disabled={loading || !telefonValid}
							class="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-colors active:scale-[0.98]"
							style="background: var(--accent); color: white;">
							{loading ? 'Se trimite...' : 'Trimite cod SMS'}
						</button>
					{/if}
				</form>
			</div>

			<!-- Divider -->
			<div class="mx-6 my-5 flex items-center gap-3">
				<div class="flex-1 h-px" style="background: rgba(255,255,255,0.07)"></div>
				<span class="text-[11px] font-medium" style="color: rgba(255,255,255,0.22)">sau</span>
				<div class="flex-1 h-px" style="background: rgba(255,255,255,0.07)"></div>
			</div>

			<!-- Register CTA -->
			<div class="px-6 pb-6">
				<a bind:this={registerBtn}
					href="/register"
					class="group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all active:scale-[0.98]"
					style="background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.09); text-decoration: none; display: flex;">
					<span class="text-2xl leading-none">✨</span>
					<div class="flex-1">
						<p class="text-sm font-semibold" style="color: white">Vreau să devin client</p>
						<p class="text-xs mt-0.5" style="color: rgba(255,255,255,0.38)">Înregistrare rapidă — 1 minut</p>
					</div>
					<span class="text-base" style="color: rgba(255,255,255,0.22)">›</span>
				</a>
			</div>
		</div>

		<p class="text-center text-[11px] mt-5" style="color: rgba(255,255,255,0.22)">
			Next Level Garage · Servicii auto Cluj-Napoca
		</p>
		<div class="flex justify-center gap-3 mt-2 text-[10px]" style="color: rgba(255,255,255,0.32)">
			<a href="/legal/privacy" style="color: inherit">Confidențialitate</a>
			<span>·</span>
			<a href="/legal/terms" style="color: inherit">Termeni</a>
			<span>·</span>
			<a href="/legal/cookies" style="color: inherit">Cookies</a>
		</div>
	</div>
</div>

