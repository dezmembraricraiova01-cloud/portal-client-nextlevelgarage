<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gsap } from 'gsap';
	import { api, type MarcaAuto, type ModelAuto } from '$lib/api';

	// ── Date personale ────────────────────────────────────────────────────────
	let prenume  = $state('');
	let nume     = $state('');
	let telefon  = $state('');

	// ── Mașină — marcă ────────────────────────────────────────────────────────
	let marci       = $state<MarcaAuto[]>([]);
	let marcaId     = $state<number | null>(null);
	let marcaManual = $state(false);
	let marcaText   = $state('');

	// ── Mașină — model ───────────────────────────────────────────────────────
	let modele        = $state<ModelAuto[]>([]);
	let modelId       = $state<number | null>(null);
	let modelManual   = $state(false);
	let modelText     = $state('');
	let loadingModele = $state(false);

	// ── Mașină — an + firmă ──────────────────────────────────────────────────
	let an      = $state<number | ''>('');
	let peFirma = $state(false);

	// ── GDPR ─────────────────────────────────────────────────────────────────
	let acordPolitica  = $state(false);
	let acordMarketing = $state(false);

	// ── UI ───────────────────────────────────────────────────────────────────
	let step    = $state<1 | 2>(1);
	let loading = $state(false);
	let error   = $state('');
	let cardEl  = $state<HTMLElement | undefined>();
	let pageEl  = $state<HTMLElement | undefined>();

	const anCurent = new Date().getFullYear();
	const ani = Array.from({ length: anCurent - 1989 }, (_, i) => anCurent - i);

	const marcaFinala = $derived(
		marcaManual ? marcaText.trim() : (marci.find(m => m.id === marcaId)?.nume ?? '')
	);
	const modelFinal = $derived(
		modelManual ? modelText.trim() : (modele.find(m => m.id === modelId)?.denumire ?? '')
	);

	const step1Valid = $derived(
		prenume.trim().length >= 2 &&
		nume.trim().length >= 2 &&
		/^07\d{8}$/.test(telefon)
	);

	const step2Valid = $derived(
		marcaFinala.length >= 1 &&
		modelFinal.length >= 1 &&
		an !== '' &&
		acordPolitica
	);

	const preNumeDisplay = $derived(prenume.trim() ? prenume.trim().split(' ')[0] : '');

	onMount(async () => {
		// Telefon pre-completat din /login (numar fara cont → "Creează cont cu acest număr").
		const t = page.url.searchParams.get('t');
		if (t && /^07\d{8}$/.test(t)) telefon = t;

		if (pageEl) {
			gsap.fromTo(pageEl,
				{ opacity: 0, y: 28, scale: 0.97 },
				{ opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' }
			);
		}
		try { marci = await api.marci(); } catch {}
	});

	$effect(() => {
		if (marcaId && !marcaManual) {
			modele = []; modelId = null; loadingModele = true;
			api.modele(marcaId)
				.then(m => { modele = m; })
				.catch(() => {})
				.finally(() => { loadingModele = false; });
		}
	});

	function toggleMarcaManual() {
		marcaManual = !marcaManual; marcaText = ''; marcaId = null;
		modele = []; modelId = null; modelManual = false; modelText = '';
	}

	function toggleModelManual() {
		modelManual = !modelManual; modelText = ''; modelId = null;
	}

	async function nextStep() {
		if (!step1Valid || !cardEl) return;
		await gsap.to(cardEl, { x: -48, opacity: 0, duration: 0.22, ease: 'power2.in' });
		step = 2;
		await tick();
		gsap.fromTo(cardEl, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, ease: 'power3.out' });
	}

	async function prevStep() {
		if (!cardEl) return;
		await gsap.to(cardEl, { x: 48, opacity: 0, duration: 0.22, ease: 'power2.in' });
		step = 1;
		await tick();
		gsap.fromTo(cardEl, { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.32, ease: 'power3.out' });
	}

	async function submit() {
		error = ''; loading = true;
		try {
			await api.register({
				prenume:  prenume.trim(),
				nume:     nume.trim(),
				telefon,
				marca:    marcaFinala,
				model:    modelFinal,
				an:       Number(an),
				pe_firma: peFirma,
				acord_politica:    acordPolitica,
				acord_marketing:   acordMarketing,
				politica_versiune: '1.0',
			});
			if (cardEl) await gsap.to(cardEl, { opacity: 0, y: -24, scale: 1.02, duration: 0.28, ease: 'power2.in' });
			goto(`/verify?t=${encodeURIComponent(telefon)}`);
		} catch (e: any) {
			if (e.status === 409) {
				const n = e.prenume ? `&n=${encodeURIComponent(e.prenume)}` : '';
				goto(`/login?t=${encodeURIComponent(telefon)}&auto=1${n}`);
				return;
			}
			error = e.message ?? 'Eroare. Încearcă din nou.';
			if (cardEl) {
				gsap.fromTo(cardEl, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.3)',
					keyframes: [{ x: -6 }, { x: 6 }, { x: -4 }, { x: 4 }, { x: 0 }] });
			}
		} finally { loading = false; }
	}
</script>

<div class="min-h-screen flex flex-col items-center justify-center px-4 py-8" style="background: transparent">

	<!-- Logo -->
	<div class="mb-6 text-center">
		<div class="text-2xl font-black tracking-tight" style="color: var(--text)">NLG Portal</div>
	</div>

	<!-- Progress bar -->
	<div class="w-full max-w-sm mb-4">
		<div class="flex items-center gap-2 mb-1.5">
			<span class="text-xs font-semibold" style="color: var(--accent)">Pasul {step} din 2</span>
			<span class="text-xs" style="color: var(--muted)">{step === 1 ? '— Date personale' : '— Mașina ta'}</span>
		</div>
		<div class="h-1 rounded-full overflow-hidden" style="background: var(--surface2)">
			<div
				class="h-full rounded-full transition-all duration-500"
				style="width: {step === 1 ? '50%' : '100%'}; background: var(--accent);">
			</div>
		</div>
	</div>

	<!-- Card -->
	<div bind:this={pageEl} class="w-full max-w-sm" style="opacity: 0">
		<div bind:this={cardEl} class="rounded-3xl overflow-hidden"
			style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.25);">

			{#if step === 1}
				<!-- ══ PASUL 1: Date personale ══ -->
				<div class="px-6 pt-7 pb-6">
					<div class="mb-6">
						<div class="text-3xl mb-3">👋</div>
						<h1 class="text-xl font-bold leading-tight mb-1" style="color: var(--text)">
							Hai să ne cunoaștem
						</h1>
						<p class="text-sm" style="color: var(--muted)">
							Câteva detalii și contul tău e gata în 60 de secunde.
						</p>
					</div>

					<div class="space-y-3">
						<div class="grid grid-cols-2 gap-2">
							<div>
								<label for="prenume" class="block text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">Prenume</label>
								<input
									id="prenume"
									type="text"
									bind:value={prenume}
									placeholder="Ion"
									autocomplete="given-name"
									class="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-all"
									style="background: var(--surface2); border: 1.5px solid {prenume.trim().length >= 2 ? 'var(--accent)' : 'var(--border)'}; color: var(--text);"
								/>
							</div>
							<div>
								<label for="nume" class="block text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">Nume</label>
								<input
									id="nume"
									type="text"
									bind:value={nume}
									placeholder="Popescu"
									autocomplete="family-name"
									class="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-all"
									style="background: var(--surface2); border: 1.5px solid {nume.trim().length >= 2 ? 'var(--accent)' : 'var(--border)'}; color: var(--text);"
								/>
							</div>
						</div>

						<div>
							<label for="telefon" class="block text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">Telefon</label>
							<input
								id="telefon"
								type="tel"
								bind:value={telefon}
								placeholder="07XXXXXXXX"
								maxlength="10"
								autocomplete="tel"
								class="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-all"
								style="background: var(--surface2); border: 1.5px solid {/^07\d{8}$/.test(telefon) ? 'var(--accent)' : 'var(--border)'}; color: var(--text);"
							/>
						</div>
					</div>
				</div>

				<!-- Footer pasul 1 -->
				<div class="px-6 pb-6 space-y-3">
					<button
						type="button"
						onclick={nextStep}
						disabled={!step1Valid}
						class="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-35 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
						style="background: var(--accent); color: white;">
						Continuă
						<span class="text-base leading-none">→</span>
					</button>
					<a href="/login" class="block text-center text-xs" style="color: var(--muted)">
						← Ai deja cont? Autentifică-te
					</a>
					<div class="flex justify-center gap-3 pt-1 text-[10px]" style="color: var(--muted)">
						<a href="/legal/privacy" style="color: inherit">Confidențialitate</a>
						<span>·</span>
						<a href="/legal/terms" style="color: inherit">Termeni</a>
					</div>
				</div>

			{:else}
				<!-- ══ PASUL 2: Mașina ══ -->
				<div class="px-6 pt-7 pb-6">
					<div class="mb-6">
						<div class="text-3xl mb-3">🚗</div>
						<h1 class="text-xl font-bold leading-tight mb-1" style="color: var(--text)">
							{preNumeDisplay ? `Perfect, ${preNumeDisplay}!` : 'Aproape gata!'}
						</h1>
						<p class="text-sm" style="color: var(--muted)">
							Spune-ne ce mașină ai — îți personalizăm experiența.
						</p>
					</div>

					<div class="space-y-3">
						<!-- Marcă -->
						{#if marcaManual}
							<div>
								<label for="marca-manual" class="block text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">Marcă</label>
								<div class="flex gap-2">
									<input
										id="marca-manual"
										type="text"
										bind:value={marcaText}
										placeholder="Ex: Dacia, BMW..."
										class="flex-1 px-3.5 py-3 rounded-xl text-sm outline-none"
										style="background: var(--surface2); border: 1.5px solid var(--accent); color: var(--text);"
									/>
									<button type="button" onclick={toggleMarcaManual}
										class="px-3 py-2 rounded-xl text-xs font-semibold"
										style="background: var(--surface2); color: var(--muted); border: 1.5px solid var(--border);">
										Listă
									</button>
								</div>
							</div>
						{:else}
							<div>
								<label for="marca-select" class="block text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">Marcă</label>
								<div class="flex gap-2">
									<select id="marca-select" bind:value={marcaId}
										class="flex-1 px-3.5 py-3 rounded-xl text-sm outline-none"
										style="background: var(--surface2); border: 1.5px solid {marcaId ? 'var(--accent)' : 'var(--border)'}; color: {marcaId ? 'var(--text)' : 'var(--muted)'};">
										<option value={null} disabled selected>Selectează marca</option>
										{#each marci as m}
											<option value={m.id}>{m.nume}</option>
										{/each}
									</select>
									<button type="button" onclick={toggleMarcaManual}
										class="px-3 py-2 rounded-xl text-xs font-semibold"
										style="background: var(--surface2); color: var(--muted); border: 1.5px solid var(--border);">
										+ Alta
									</button>
								</div>
							</div>
						{/if}

						<!-- Model -->
						{#if modelManual}
							<div>
								<label for="model-manual" class="block text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">Model</label>
								<div class="flex gap-2">
									<input
										id="model-manual"
										type="text"
										bind:value={modelText}
										placeholder="Ex: Logan, Seria 3..."
										class="flex-1 px-3.5 py-3 rounded-xl text-sm outline-none"
										style="background: var(--surface2); border: 1.5px solid var(--accent); color: var(--text);"
									/>
									<button type="button" onclick={toggleModelManual}
										class="px-3 py-2 rounded-xl text-xs font-semibold"
										style="background: var(--surface2); color: var(--muted); border: 1.5px solid var(--border);">
										Listă
									</button>
								</div>
							</div>
						{:else}
							<div>
								<label for="model-select" class="block text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">Model</label>
								<div class="flex gap-2">
									<select id="model-select" bind:value={modelId}
										disabled={!marcaId && !marcaManual}
										class="flex-1 px-3.5 py-3 rounded-xl text-sm outline-none disabled:opacity-40"
										style="background: var(--surface2); border: 1.5px solid {modelId ? 'var(--accent)' : 'var(--border)'}; color: {modelId ? 'var(--text)' : 'var(--muted)'};">
										<option value={null} disabled selected>
											{loadingModele ? 'Se încarcă...' : 'Selectează modelul'}
										</option>
										{#each modele as m}
											<option value={m.id}>{m.denumire}</option>
										{/each}
									</select>
									<button type="button" onclick={toggleModelManual}
										disabled={!marcaId && !marcaManual}
										class="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
										style="background: var(--surface2); color: var(--muted); border: 1.5px solid var(--border);">
										+ Alt
									</button>
								</div>
							</div>
						{/if}

						<!-- An + pe firmă pe același rând -->
						<div class="grid grid-cols-2 gap-2 items-end">
							<div>
								<label for="an" class="block text-[11px] font-semibold uppercase tracking-wider mb-1" style="color: var(--muted)">An fabricație</label>
								<select id="an" bind:value={an}
									class="w-full px-3.5 py-3 rounded-xl text-sm outline-none"
									style="background: var(--surface2); border: 1.5px solid {an !== '' ? 'var(--accent)' : 'var(--border)'}; color: {an !== '' ? 'var(--text)' : 'var(--muted)'};">
									<option value="" disabled selected>An</option>
									{#each ani as a}
										<option value={a}>{a}</option>
									{/each}
								</select>
							</div>
							<label
								class="flex items-center gap-2.5 px-3.5 py-3 rounded-xl cursor-pointer transition-all h-[46px]"
								style="background: var(--surface2); border: 1.5px solid {peFirma ? 'var(--accent)' : 'var(--border)'};">
								<input type="checkbox" bind:checked={peFirma} class="w-4 h-4 rounded accent-blue-500 shrink-0" />
								<div>
									<div class="text-xs font-semibold" style="color: var(--text)">Pe firmă</div>
									<div class="text-[10px] leading-tight" style="color: var(--muted)">PJ</div>
								</div>
							</label>
						</div>

						<!-- GDPR — consimțăminte -->
						<div class="space-y-2 pt-2">
							<label class="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all"
								style="background: var(--surface2); border: 1.5px solid {acordPolitica ? 'var(--accent)' : 'var(--border)'};">
								<input type="checkbox" bind:checked={acordPolitica}
									class="w-4 h-4 mt-0.5 rounded accent-blue-500 shrink-0" />
								<div class="flex-1 min-w-0">
									<div class="text-[12px] font-semibold leading-snug" style="color: var(--text)">
										Sunt de acord cu
										<a href="/legal/privacy" target="_blank" style="color: var(--accent); text-decoration: underline;">politica de confidențialitate</a>
										și
										<a href="/legal/terms" target="_blank" style="color: var(--accent); text-decoration: underline;">termenii</a>
										<span style="color: #ef4444">*</span>
									</div>
								</div>
							</label>

							<label class="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all"
								style="background: var(--surface2); border: 1.5px solid {acordMarketing ? 'var(--accent)' : 'var(--border)'};">
								<input type="checkbox" bind:checked={acordMarketing}
									class="w-4 h-4 mt-0.5 rounded accent-blue-500 shrink-0" />
								<div class="flex-1 min-w-0">
									<div class="text-[12px] font-semibold leading-snug" style="color: var(--text)">
										Doresc să primesc oferte și promoții prin SMS / email
										<span class="text-[10px] font-normal" style="color: var(--muted)">(opțional)</span>
									</div>
								</div>
							</label>
						</div>
					</div>
				</div>

				<!-- Eroare -->
				{#if error}
					<div class="mx-6 mb-3 px-4 py-3 rounded-xl text-sm" style="background: #ef444415; color: #ef4444; border: 1px solid #ef444430;">
						{error}
					</div>
				{/if}

				<!-- Footer pasul 2 -->
				<div class="px-6 pb-6 space-y-2.5">
					<button
						type="button"
						onclick={submit}
						disabled={loading || !step2Valid}
						class="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-35 transition-all active:scale-[0.98]"
						style="background: var(--accent); color: white;">
						{loading ? 'Se creează contul...' : '✓ Creează contul'}
					</button>
					<button type="button" onclick={prevStep}
						class="w-full text-center text-xs py-2 transition-opacity active:opacity-50"
						style="color: var(--muted); background: none; border: none; cursor: pointer;">
						← Înapoi
					</button>
				</div>
			{/if}

		</div>
	</div>
</div>
