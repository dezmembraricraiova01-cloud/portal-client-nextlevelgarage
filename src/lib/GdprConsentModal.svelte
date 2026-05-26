<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { api, type ConsimtaminteStatus } from '$lib/api';

	let { onAccepted = () => {} }: { onAccepted?: () => void } = $props();

	let visible    = $state(false);
	let loading    = $state(true);
	let saving     = $state(false);
	let error      = $state('');
	let status     = $state<ConsimtaminteStatus | null>(null);

	let politica   = $state(false);
	let marketing  = $state(false);
	let panelEl    = $state<HTMLElement | undefined>();
	let backdropEl = $state<HTMLElement | undefined>();

	onMount(async () => {
		try {
			const s = await api.consimtaminteStatus();
			status = s;
			if (s.necesita_acceptare) {
				visible = true;
				marketing = s.marketing;
			}
		} catch {
		} finally {
			loading = false;
		}
	});

	$effect(() => {
		if (visible && panelEl && backdropEl) {
			gsap.fromTo(backdropEl, { opacity: 0 }, { opacity: 1, duration: 0.25 });
			gsap.fromTo(panelEl,
				{ y: 60, opacity: 0, scale: 0.95 },
				{ y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' });
		}
	});

	async function accepta() {
		if (!politica || !status) return;
		saving = true; error = '';
		try {
			await api.acceptaConsimtamant({
				versiune:  status.versiune_curenta,
				politica:  true,
				marketing: marketing,
			});
			if (panelEl)    await gsap.to(panelEl,    { y: -30, opacity: 0, scale: 0.96, duration: 0.25, ease: 'power2.in' });
			if (backdropEl) await gsap.to(backdropEl, { opacity: 0, duration: 0.2 });
			visible = false;
			onAccepted();
		} catch (e: any) {
			error = e.message ?? 'Eroare. Încearcă din nou.';
		} finally {
			saving = false;
		}
	}
</script>

{#if visible && status}
	<div bind:this={backdropEl}
		class="fixed inset-0 z-[200]"
		style="background: rgba(0,0,0,0.78); backdrop-filter: blur(6px);">
	</div>

	<div class="fixed inset-0 z-[201] flex items-end sm:items-center justify-center px-3 py-3 overflow-y-auto">
		<div bind:this={panelEl}
			class="w-full max-w-md rounded-3xl overflow-hidden flex flex-col"
			style="background: var(--surface); border: 1px solid var(--border); box-shadow: 0 24px 64px rgba(0,0,0,0.55); max-height: calc(100dvh - 24px);">

			<!-- Header -->
			<div class="px-5 pt-5 pb-3 shrink-0">
				<div class="text-3xl mb-2">🔒</div>
				<h2 class="text-lg font-bold leading-tight" style="color: var(--text)">
					{status.versiune_acceptata ? 'Politica a fost actualizată' : 'Câteva detalii despre datele tale'}
				</h2>
				<p class="text-xs mt-1" style="color: var(--muted)">
					{status.versiune_acceptata
						? `Am actualizat politica de la versiunea ${status.versiune_acceptata} la ${status.versiune_curenta}. Confirmă pentru a continua.`
						: 'Pentru a folosi NLG Portal, te rugăm să confirmi acordul cu politica noastră.'}
				</p>
			</div>

			<!-- Body -->
			<div class="px-5 py-2 space-y-3 overflow-y-auto flex-1">
				<div class="rounded-2xl px-4 py-3 text-xs leading-relaxed"
					style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);">
					<p class="mb-2"><strong>Pe scurt:</strong></p>
					<ul class="space-y-1 pl-4 list-disc" style="color: var(--muted)">
						<li>Datele tale sunt folosite pentru prestarea serviciilor de service auto</li>
						<li>Le păstrăm doar cât e necesar (10 ani pentru facturi, conform legii)</li>
						<li>Nu le vindem și nu le transferăm în afara UE</li>
						<li>Ai oricând dreptul de acces, rectificare, ștergere — direct din profil</li>
					</ul>
					<p class="mt-2 text-[11px]" style="color: var(--muted)">
						Versiune politică: <strong>{status.versiune_curenta}</strong>
					</p>
				</div>

				<!-- Checkbox 1 — obligatoriu -->
				<label class="flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
					style="background: var(--surface2); border: 1.5px solid {politica ? 'var(--accent)' : 'var(--border)'};">
					<input type="checkbox" bind:checked={politica}
						class="w-5 h-5 mt-0.5 shrink-0 accent-blue-500" />
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold" style="color: var(--text)">
							Sunt de acord cu Politica de confidențialitate
							<span style="color: #ef4444">*</span>
						</div>
						<p class="text-[11px] mt-0.5 leading-relaxed" style="color: var(--muted)">
							Citește
							<a href="/legal/privacy" target="_blank" style="color: var(--accent); text-decoration: underline;">politica completă</a>
							·
							<a href="/legal/terms" target="_blank" style="color: var(--accent); text-decoration: underline;">termenii</a>.
							Obligatoriu pentru a folosi aplicația.
						</p>
					</div>
				</label>

				<!-- Checkbox 2 — opțional marketing -->
				<label class="flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
					style="background: var(--surface2); border: 1.5px solid {marketing ? 'var(--accent)' : 'var(--border)'};">
					<input type="checkbox" bind:checked={marketing}
						class="w-5 h-5 mt-0.5 shrink-0 accent-blue-500" />
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold" style="color: var(--text)">
							Doresc oferte și promoții
							<span class="text-[10px] ml-1 px-1.5 py-0.5 rounded"
								style="background: rgba(255,255,255,0.06); color: var(--muted)">opțional</span>
						</div>
						<p class="text-[11px] mt-0.5" style="color: var(--muted)">
							Primesc SMS / email cu oferte. Mă pot dezabona oricând din profil.
						</p>
					</div>
				</label>

				{#if error}
					<p class="text-xs px-2" style="color: #ef4444">{error}</p>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-5 pt-3 pb-5 shrink-0">
				<button onclick={accepta}
					disabled={!politica || saving}
					class="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all active:scale-[0.98]"
					style="background: var(--accent); color: white;">
					{saving ? 'Se salvează...' : 'Continuă'}
				</button>
				<p class="text-[10px] text-center mt-2.5 leading-relaxed" style="color: var(--muted)">
					Răspundem la cereri în max. 30 zile · ANSPDCP — dataprotection.ro
				</p>
			</div>
		</div>
	</div>
{/if}
