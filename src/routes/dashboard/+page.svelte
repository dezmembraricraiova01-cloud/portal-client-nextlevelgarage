<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { gsap } from 'gsap';
	import { api, formatActualizare, type GarajDashboard, type TimelineStep, type AlertaMasinaFull } from '$lib/api';
	import { bindReveal } from '$lib/smooth';
	import Skeleton from '$lib/Skeleton.svelte';
	import ProgressStepper from '$lib/ProgressStepper.svelte';
	import { startTour } from '$lib/tour';
	import { activeWoUid } from '$lib/stores';

	let data          = $state<GarajDashboard | null>(null);
	let timeline      = $state<TimelineStep[]>([]);
	let loading       = $state(true);
	let alerteUrgente = $state<AlertaMasinaFull[]>([]);

	function zileRamase(iso: string | null): number {
		if (!iso) return 999;
		return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
	}

	onMount(async () => {
		try {
			const [dashRes, alerteRes] = await Promise.all([
				api.dashboard(),
				api.toateAlertele().catch(() => [] as AlertaMasinaFull[]),
			]);
			data = dashRes;
			alerteUrgente = alerteRes.filter(a => zileRamase(a.data_expirare) <= 30);
			if (data.masina_activa) {
				activeWoUid.set(data.masina_activa.wo_uid);
				try {
					const res = await api.reparatie(data.masina_activa.wo_uid);
					timeline = res.timeline;
				} catch { /* timeline opțional */ }
			}
		}
		catch { goto('/login'); }
		finally {
			loading = false;
			await tick();
			startTour();
			if (data) {
				gsap.from('.dash-salut', { opacity: 0, y: 12, duration: 0.35, ease: 'power2.out' });
				gsap.from('.hero-zone', { opacity: 0, y: 10, duration: 0.4, delay: 0.08, ease: 'power2.out' });
				bindReveal();
			}
		}
	});

	const colorStyle = (c: string) => ({
		green:  { bg: '#22c55e18', text: '#22c55e', border: '#22c55e40' },
		blue:   { bg: '#3b82f618', text: '#3b82f6', border: '#3b82f640' },
		yellow: { bg: '#eab30818', text: '#eab308', border: '#eab30840' },
		red:    { bg: '#ef444418', text: '#ef4444', border: '#ef444440' },
		gray:   { bg: 'var(--surface2)', text: 'var(--muted)', border: 'var(--border)' },
	})[c] ?? { bg: 'var(--surface2)', text: 'var(--muted)', border: 'var(--border)' };

	const urgentaColor = (u: string) => ({
		high:   { bg: '#ef444418', text: '#ef4444', border: '#ef444440' },
		medium: { bg: '#eab30818', text: '#eab308', border: '#eab30840' },
		low:    { bg: '#3b82f618', text: '#3b82f6', border: '#3b82f640' },
	})[u] ?? { bg: 'var(--surface2)', text: 'var(--muted)', border: 'var(--border)' };

	const tipActiuneIcon: Record<string, string> = {
		deviz:      '📋',
		ridicare:   '🚗',
		rca:        '🛡️',
		casco:      '🔒',
		itp:        '🔬',
		carte_verde:'🌍',
		programare: '📅',
	};

	const tipActiuneIconExpirare: Record<string, string> = {
		rca:        '🛡️',
		casco:      '🔒',
		carte_verde:'🌍',
		itp:        '🔬',
		buletin:    '🪪',
		permis:     '🚗',
		tahograf:   '📡',
		rovinieta:  '🛡️',
	};

</script>

{#if loading}
	<div class="space-y-4 pb-4">
		<!-- Salut -->
		<div class="pt-1 space-y-1.5">
			<Skeleton height="h-7" class="w-48" rounded="rounded-xl" />
			<Skeleton height="h-3" class="w-32" />
		</div>
		<!-- Hero card -->
		<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border);">
			<div class="px-5 pt-4 pb-3 border-b" style="border-color: var(--border); background: var(--surface);">
				<Skeleton height="h-5" class="w-36 mb-2" />
				<Skeleton height="h-3" class="w-24 mb-3" />
				<Skeleton height="h-4" class="w-28" />
			</div>
			<div class="px-5 py-3.5" style="background: var(--surface);">
				<Skeleton height="h-4" class="w-32" />
			</div>
		</div>
		<!-- Quick actions 2x2 -->
		<div class="grid grid-cols-2 gap-3">
			{#each Array(4) as _}
				<div class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
					<Skeleton height="h-6" class="w-6 mb-2" rounded="rounded-lg" />
					<Skeleton height="h-4" class="w-20 mb-1" />
					<Skeleton height="h-3" class="w-28" />
				</div>
			{/each}
		</div>
		<!-- Activitate -->
		<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border);">
			{#each Array(3) as _, i}
				<div class="flex items-center gap-3 px-4 py-3 {i > 0 ? 'border-t' : ''}" style="background: var(--surface); border-color: var(--border);">
					<Skeleton height="h-5" class="w-5 shrink-0" rounded="rounded" />
					<Skeleton height="h-3" class="flex-1" />
					<Skeleton height="h-3" class="w-12 shrink-0" />
				</div>
			{/each}
		</div>
	</div>
{:else if data}
	<div class="content-outer space-y-4 pb-4">

		<!-- HERO ZONE — full bleed -->
		<div data-tour="masina" class="hero-zone -mx-6 pt-2 pb-3" style="background: linear-gradient(180deg, #0d0d22 0%, #131328 55%, transparent 100%)">

			<!-- ① Salut -->
			<div class="px-4 pb-2">
				<div class="dash-salut">
					<h1 class="text-lg font-bold tracking-tight" style="color: var(--text)">
						{data.salut} 👋
					</h1>
					<p class="text-xs mt-0.5" style="color: var(--muted)">Garajul tău NLG</p>
				</div>
			</div>

			{#snippet programareChip(overlay: boolean)}
				{#if data.urmatoarea_programare}
					{@const p = data.urmatoarea_programare}
					<a href="/dashboard/programari"
						class="hero-pill {overlay ? 'is-overlay' : ''} group inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full">
						<span class="hero-pill-icon">📅</span>
						<span style="color: var(--text)">{new Date(p.start_at).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
						<span class="hero-pill-accent">· {new Date(p.start_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</span>
						<span class="hero-pill-arrow">→</span>
					</a>
				{:else}
					<a href="/dashboard/programari/noua"
						class="hero-pill hero-pill--cta {overlay ? 'is-overlay' : ''} group relative inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-full overflow-hidden">
						<span class="hero-pill-shimmer absolute inset-0 pointer-events-none"></span>
						<span class="relative">📅</span>
						<span class="relative">Programează-te</span>
						<span class="relative hero-pill-arrow">→</span>
					</a>
				{/if}
			{/snippet}

			{#snippet showroomBg()}
				<!-- Fundal showroom: reflector + dâre de lumină + siluetă mașină (fallback fără poză) -->
				<div class="sh-bg absolute inset-0"></div>
				<div class="sh-spot absolute inset-0 pointer-events-none"></div>
				<div class="sh-streaks absolute inset-0 pointer-events-none"></div>
				<div class="sh-floor absolute inset-x-0 bottom-0 pointer-events-none"></div>
				<svg class="sh-car" viewBox="0 0 640 240" aria-hidden="true">
					<defs>
						<linearGradient id="shCarGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stop-color="#33407a" />
							<stop offset="1" stop-color="#141a38" />
						</linearGradient>
					</defs>
					<path class="body" d="M28 176 C 78 176 96 172 128 156 C 168 128 214 112 300 110 C 372 109 420 120 452 140 C 470 151 486 156 512 158 L 566 162 C 596 165 612 172 612 182 L 612 190 C 612 196 607 200 600 200 L 40 200 C 32 200 26 194 26 186 Z" />
					<path class="glass" d="M150 150 C 182 124 222 112 292 111 C 336 111 366 118 388 130 L 372 150 Z" />
					<path class="glass" d="M300 111 C 356 112 398 121 430 138 L 452 150 L 320 150 Z" opacity=".7" />
					<circle class="glow" cx="596" cy="176" r="6" opacity=".9" />
					<circle class="wheel" cx="180" cy="196" r="30" />
					<circle class="hub" cx="180" cy="196" r="11" />
					<circle class="wheel" cx="486" cy="196" r="30" />
					<circle class="hub" cx="486" cy="196" r="11" />
				</svg>
			{/snippet}

			{#snippet photoFrame(masinaId: number)}
				<!-- Chenarul e chiar butonul de upload — duce la fișa mașinii unde se adaugă pozele -->
				<a href="/dashboard/masini/{masinaId}" class="sh-frame" aria-label="Adaugă o poză cu mașina ta">
					<span class="sh-corner sh-c1"></span><span class="sh-corner sh-c2"></span>
					<span class="sh-corner sh-c3"></span><span class="sh-corner sh-c4"></span>
					<span class="sh-cam">📷</span>
					<span class="sh-lbl">Adaugă o poză</span>
					<span class="sh-sub">apasă aici</span>
				</a>
			{/snippet}

			<!-- ② Banner mașină activă -->
			{#if data.masina_activa}
				{@const m = data.masina_activa}
				{@const cs = colorStyle(m.portal_color)}

				{#if m.foto_url}
					<!-- Banner cu imagine + dock premium -->
					<div class="relative overflow-hidden hero-banner" style="height: 240px; border-top: 2px solid {cs.text}; --ac: {cs.text};">
						<img src={m.foto_url} alt="{m.marca} {m.model}"
							class="absolute inset-0 w-full h-full object-cover kb-img"
							style="opacity: 0.6; object-position: center 65%;" />
						<div class="absolute inset-0" style="background: linear-gradient(180deg, rgba(13,13,34,0.7) 0%, rgba(13,13,34,0.15) 35%, rgba(13,13,34,0.9) 100%)"></div>

						<!-- Top: identity -->
						<div class="absolute left-0 right-0 top-0 px-5 pt-4">
							<p class="text-xs font-medium mb-1" style="color: var(--muted)">Mașina ta este în service</p>
							<p class="font-bold text-xl leading-tight" style="color: var(--text)">{m.marca} {m.model}{m.an ? ` (${m.an})` : ''}</p>
							<p class="text-sm font-mono mt-0.5" style="color: var(--muted)">{m.numar_inmatriculare}</p>
						</div>

						<!-- Bottom dock -->
						<div class="hero-dock absolute left-0 right-0 bottom-0">
							<div class="hero-dock-aurora absolute inset-0 pointer-events-none"></div>
							<div class="relative px-4 py-3 flex items-center gap-3">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-1.5 flex-wrap">
										<span class="hero-status-dot" style="background: {cs.text}"></span>
										<span class="text-sm font-bold leading-none" style="color: {cs.text}">{m.status_label}</span>
										{#if m.ultima_actualizare}
											<span class="text-[11px] leading-none" style="color: var(--muted)">· {formatActualizare(m.ultima_actualizare)}</span>
										{/if}
									</div>
									{#if m.eta}
										<p class="text-[11px] mt-1" style="color: var(--muted)">
											⏱ Gata: <span style="color: var(--text); font-weight: 600">{new Date(m.eta).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
										</p>
									{/if}
									{#if m.deviz_pending}
										<a href="/dashboard/reparatii/{m.wo_uid}/deviz" class="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full font-semibold transition-opacity active:opacity-70" style="background: #eab30828; color: #eab308; border: 1px solid #eab30850; text-decoration: none;">
											⚠️ Deviz în așteptare →
										</a>
									{/if}
								</div>
								<div class="shrink-0">
									{@render programareChip(true)}
								</div>
							</div>
						</div>
					</div>
				{:else}
					<!-- Banner showroom (fără poză) — chenarul e butonul de adăugat poză -->
					<div class="relative overflow-hidden hero-banner" style="height: 240px; border-top: 2px solid {cs.text}; --ac: {cs.text};">
						{@render showroomBg()}

						<div class="absolute left-0 right-0 top-0 px-5 pt-4 z-10">
							<p class="text-xs font-medium mb-1" style="color: var(--muted)">Mașina ta este în service</p>
							<p class="font-bold text-xl leading-tight" style="color: var(--text)">{m.marca} {m.model}{m.an ? ` (${m.an})` : ''}</p>
							<p class="text-sm font-mono mt-0.5" style="color: var(--muted)">{m.numar_inmatriculare}</p>
						</div>

						{@render photoFrame(m.masina_id)}

						<div class="hero-dock absolute left-0 right-0 bottom-0 z-10">
							<div class="hero-dock-aurora absolute inset-0 pointer-events-none"></div>
							<div class="relative px-4 py-3 flex items-center gap-3">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-1.5 flex-wrap">
										<span class="hero-status-dot" style="background: {cs.text}"></span>
										<span class="text-sm font-bold leading-none" style="color: {cs.text}">{m.status_label}</span>
										{#if m.ultima_actualizare}
											<span class="text-[11px] leading-none" style="color: var(--muted)">· {formatActualizare(m.ultima_actualizare)}</span>
										{/if}
									</div>
									{#if m.eta}
										<p class="text-[11px] mt-1" style="color: var(--muted)">
											⏱ Gata: <span style="color: var(--text); font-weight: 600">{new Date(m.eta).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
										</p>
									{/if}
									{#if m.deviz_pending}
										<a href="/dashboard/reparatii/{m.wo_uid}/deviz" class="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full font-semibold transition-opacity active:opacity-70" style="background: #eab30828; color: #eab308; border: 1px solid #eab30850; text-decoration: none;">
											⚠️ Deviz în așteptare →
										</a>
									{/if}
								</div>
								<div class="shrink-0">
									{@render programareChip(true)}
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Progress stepper -->
				{#if timeline.length > 0}
					<div class="pt-4">
						<p class="text-xs font-semibold uppercase tracking-widest mb-2 px-4" style="color: var(--muted)">Progres</p>
						<ProgressStepper steps={timeline} />
					</div>
				{/if}

				<!-- CTA detalii reparație -->
				<div data-tour="status" class="px-4 pt-4">
					<a href="/dashboard/reparatii/{m.wo_uid}"
						class="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
						style="background: #ffffff14; color: var(--text); border: 1px solid #ffffff20;">
						<span>Toate detaliile reparației</span>
						<span style="color: var(--muted)">→</span>
					</a>
				</div>
			{:else if data.masina_principala}
				<!-- Fallback: nu există WO activ → afișăm mașina principală cu același tratament vizual -->
				{@const mp = data.masina_principala}
				{#if mp.foto_url}
					<div class="relative overflow-hidden hero-banner" style="height: 240px; border-top: 2px solid #22c55e; --ac: #22c55e;">
						<img src={mp.foto_url} alt="{mp.marca} {mp.model}"
							class="absolute inset-0 w-full h-full object-cover kb-img"
							style="opacity: 0.6; object-position: center 65%;" />
						<div class="absolute inset-0" style="background: linear-gradient(180deg, rgba(13,13,34,0.7) 0%, rgba(13,13,34,0.15) 35%, rgba(13,13,34,0.9) 100%)"></div>

						<!-- Top: identity -->
						<div class="absolute left-0 right-0 top-0 px-5 pt-4">
							<p class="text-xs font-medium mb-1" style="color: var(--muted)">Mașina ta</p>
							<p class="font-bold text-xl leading-tight" style="color: var(--text)">{mp.marca} {mp.model}{mp.an ? ` (${mp.an})` : ''}</p>
							<p class="text-sm font-mono mt-0.5" style="color: var(--muted)">{mp.numar_inmatriculare}</p>
						</div>

						<!-- Bottom dock -->
						<div class="hero-dock absolute left-0 right-0 bottom-0">
							<div class="hero-dock-aurora absolute inset-0 pointer-events-none"></div>
							<div class="relative px-4 py-3 flex items-center gap-3">
								<div class="flex-1 min-w-0 flex items-center gap-1.5">
									<span class="hero-status-dot" style="background: #22c55e"></span>
									<span class="text-sm font-bold leading-none" style="color: #22c55e">În regulă</span>
									<span class="text-[11px] leading-none" style="color: var(--muted)">· niciun service activ</span>
								</div>
								<div class="shrink-0">
									{@render programareChip(true)}
								</div>
							</div>
						</div>
					</div>
				{:else}
					<!-- Banner showroom (fără poză) — chenarul e butonul de adăugat poză -->
					<div class="relative overflow-hidden hero-banner" style="height: 240px; border-top: 2px solid #22c55e; --ac: #22c55e;">
						{@render showroomBg()}

						<div class="absolute left-0 right-0 top-0 px-5 pt-4 z-10">
							<p class="text-xs font-medium mb-1" style="color: var(--muted)">Mașina ta</p>
							<p class="font-bold text-xl leading-tight" style="color: var(--text)">{mp.marca} {mp.model}{mp.an ? ` (${mp.an})` : ''}</p>
							<p class="text-sm font-mono mt-0.5" style="color: var(--muted)">{mp.numar_inmatriculare}</p>
						</div>

						{@render photoFrame(mp.masina_id)}

						<div class="hero-dock absolute left-0 right-0 bottom-0 z-10">
							<div class="hero-dock-aurora absolute inset-0 pointer-events-none"></div>
							<div class="relative px-4 py-3 flex items-center gap-3">
								<div class="flex-1 min-w-0 flex items-center gap-1.5">
									<span class="hero-status-dot" style="background: #22c55e"></span>
									<span class="text-sm font-bold leading-none" style="color: #22c55e">În regulă</span>
									<span class="text-[11px] leading-none" style="color: var(--muted)">· niciun service activ</span>
								</div>
								<div class="shrink-0">
									{@render programareChip(true)}
								</div>
							</div>
						</div>
					</div>
				{/if}

				<div class="px-4 pt-4">
					<a href="/dashboard/masini/{mp.masina_id}"
						class="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
						style="background: #ffffff14; color: var(--text); border: 1px solid #ffffff20;">
						<span>Vezi detalii mașină</span>
						<span style="color: var(--muted)">→</span>
					</a>
				</div>
			{/if}

		</div><!-- /hero-zone -->

			<!-- ③ Acțiunea principală — eliminata (redundant cu hero status) -->

		<!-- ④ CTA închiriere — buton "Ce mașină vrei să închiriezi?" -->
		<a href="/dashboard/inchirieri" data-tour="inchirieri" data-reveal data-delay="0.1"
			class="rental-cta group relative block rounded-2xl overflow-hidden transition-all active:scale-[0.985]">
			<div class="rental-aurora absolute inset-0 pointer-events-none"></div>
			<div class="rental-shimmer absolute inset-0 pointer-events-none"></div>

			<div class="relative px-4 py-3.5 flex items-center gap-3">
				<div class="rental-orb shrink-0 flex items-center justify-center text-2xl">🚙</div>
				<div class="flex-1 min-w-0">
					<p class="font-bold text-[15px] leading-tight tracking-tight" style="color: #fff">
						Ai nevoie de o mașină?
					</p>
					<p class="text-xs mt-0.5 leading-snug" style="color: rgba(255,255,255,0.78)">
						Vezi flota și rezervă rapid — te sunăm pentru confirmare.
					</p>
				</div>
				<span class="shrink-0 inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-xl"
					style="background: rgba(255,255,255,0.18); color: #fff; border: 1px solid rgba(255,255,255,0.28); backdrop-filter: blur(6px);">
					<span>Vezi flota</span>
					<span class="rental-arrow">→</span>
				</span>
			</div>
		</a>

		<!-- ⑤ Alerte mașină urgente -->
		{#if alerteUrgente.length > 0}
			<section data-reveal data-delay="0.15">
				<div class="flex items-center justify-between mb-2">
					<h2 class="text-xs font-semibold uppercase tracking-widest" style="color: var(--muted)">Alerte Mașină</h2>
					<a href="/dashboard/remindere" class="text-xs" style="color: var(--accent)">Vezi toate →</a>
				</div>
				<div class="rounded-2xl border overflow-hidden" style="border-color: var(--border)">
					{#each alerteUrgente as a, i}
						{@const zile = zileRamase(a.data_expirare)}
						{@const expirat = zile <= 0}
						<a href="/dashboard/masini/{a.masina_id}"
							class="flex items-center justify-between px-4 py-3 {i > 0 ? 'border-t' : ''} transition-all active:scale-[0.98]"
							style="background: {expirat ? '#ef444408' : 'var(--surface)'}; border-color: var(--border);">
							<div class="flex items-center gap-3">
								<span class="text-lg">{tipActiuneIconExpirare[a.tip] ?? '🔔'}</span>
								<div>
									<p class="text-sm font-medium" style="color: var(--text)">
										{({ rovinieta:'Rovinieta', rca:'Asigurare RCA', casco:'CASCO', carte_verde:'Carte Verde', itp:'ITP', buletin:'Buletin', permis:'Permis auto', tahograf:'Tahograf' })[a.tip] ?? a.tip}
									</p>
									<p class="text-xs" style="color: var(--muted)">{a.numar_inmatriculare ?? '—'} · {a.marca ?? ''} {a.model ?? ''}</p>
								</div>
							</div>
							<span class="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full"
								style="background:{expirat ? '#ef444420' : '#eab30820'}; color:{expirat ? '#ef4444' : '#eab308'};">
								{expirat ? 'Posibil expirat' : zile === 1 ? 'Mâine' : `${zile}z`}
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

	</div>
{/if}

<style>
	@media (max-width: 480px) {
		.hero-zone {
			padding-top: 8px;
			padding-bottom: 8px;
		}
	}

	.kb-img {
		animation: kenBurns 22s ease-in-out infinite alternate;
		transform-origin: center center;
	}

	@keyframes kenBurns {
		0%   { transform: scale(1)    translateX(0); }
		100% { transform: scale(1.07) translateX(-1.5%); }
	}

	/* Premium action card */
	.action-card {
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--ac) 14%, transparent) 0%, color-mix(in srgb, var(--ac) 4%, transparent) 60%, transparent 100%),
			var(--surface);
		border: 1px solid color-mix(in srgb, var(--ac) 32%, var(--border));
		box-shadow:
			0 1px 0 color-mix(in srgb, var(--ac) 18%, transparent) inset,
			0 8px 24px -12px color-mix(in srgb, var(--ac) 50%, transparent);
		isolation: isolate;
	}
	.action-card::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		padding: 1px;
		background: linear-gradient(135deg, color-mix(in srgb, var(--ac) 60%, transparent), transparent 40%, color-mix(in srgb, var(--ac) 30%, transparent));
		-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
		-webkit-mask-composite: xor;
		        mask-composite: exclude;
		pointer-events: none;
		opacity: 0.8;
	}

	.action-aurora {
		background:
			radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--ac) 22%, transparent) 0%, transparent 55%),
			radial-gradient(90%  70% at 100% 100%, color-mix(in srgb, var(--ac) 18%, transparent) 0%, transparent 60%);
		animation: aurora 6s ease-in-out infinite alternate;
		opacity: 0.9;
	}
	@keyframes aurora {
		0%   { transform: translate3d(0, 0, 0)     scale(1); }
		100% { transform: translate3d(2%, -2%, 0)  scale(1.05); }
	}

	.action-shimmer {
		background: linear-gradient(110deg, transparent 35%, color-mix(in srgb, var(--ac) 28%, #fff 4%) 50%, transparent 65%);
		transform: translateX(-100%);
		mix-blend-mode: overlay;
		animation: shimmer 3.6s ease-in-out infinite;
	}
	@keyframes shimmer {
		0%, 30%  { transform: translateX(-100%); }
		70%,100% { transform: translateX(100%); }
	}

	.action-orb {
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: linear-gradient(135deg, color-mix(in srgb, var(--ac) 30%, transparent), color-mix(in srgb, var(--ac) 12%, transparent));
		border: 1px solid color-mix(in srgb, var(--ac) 40%, transparent);
		box-shadow: 0 4px 14px -4px color-mix(in srgb, var(--ac) 55%, transparent);
	}
	.action-orb-pulse {
		background: color-mix(in srgb, var(--ac) 35%, transparent);
		animation: orbPulse 2.4s ease-out infinite;
	}
	@keyframes orbPulse {
		0%   { transform: scale(1);    opacity: 0.55; }
		70%  { transform: scale(1.35); opacity: 0; }
		100% { transform: scale(1.35); opacity: 0; }
	}

	.action-cta {
		background: linear-gradient(135deg, var(--ac), color-mix(in srgb, var(--ac) 78%, #000));
		color: #0b0b1a;
		border: 1px solid color-mix(in srgb, var(--ac) 70%, #fff 10%);
		box-shadow:
			0 1px 0 rgba(255,255,255,0.18) inset,
			0 6px 16px -6px color-mix(in srgb, var(--ac) 70%, transparent);
		letter-spacing: 0.01em;
		transition: transform 0.25s ease, box-shadow 0.25s ease;
	}
	.action-card:hover .action-cta {
		transform: translateY(-1px);
		box-shadow:
			0 1px 0 rgba(255,255,255,0.22) inset,
			0 10px 22px -6px color-mix(in srgb, var(--ac) 80%, transparent);
	}
	.action-arrow {
		display: inline-block;
		transition: transform 0.25s ease;
	}
	.action-card:hover .action-arrow {
		transform: translateX(3px);
	}

	@media (prefers-reduced-motion: reduce) {
		.action-aurora, .action-shimmer, .action-orb-pulse { animation: none; }
	}

	/* Hero photo banner — premium glass dock */
	.hero-dock {
		background:
			linear-gradient(180deg, transparent 0%, rgba(13,13,34,0.55) 30%, rgba(13,13,34,0.92) 100%);
		backdrop-filter: blur(10px) saturate(140%);
		-webkit-backdrop-filter: blur(10px) saturate(140%);
		border-top: 1px solid color-mix(in srgb, var(--ac, #3b82f6) 35%, rgba(255,255,255,0.08));
		box-shadow: 0 -10px 24px -12px color-mix(in srgb, var(--ac, #3b82f6) 35%, transparent);
	}
	.hero-dock-aurora {
		background:
			radial-gradient(60% 120% at 100% 100%, color-mix(in srgb, var(--ac, #3b82f6) 28%, transparent) 0%, transparent 60%),
			radial-gradient(40% 100% at 0% 100%, color-mix(in srgb, var(--ac, #3b82f6) 16%, transparent) 0%, transparent 70%);
		opacity: 0.85;
		animation: dockAurora 7s ease-in-out infinite alternate;
	}
	@keyframes dockAurora {
		0%   { transform: translateX(0); }
		100% { transform: translateX(-3%); }
	}

	.hero-status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		display: inline-block;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac, #22c55e) 22%, transparent);
		animation: heroDotPulse 2.2s ease-out infinite;
	}
	@keyframes heroDotPulse {
		0%, 100% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ac, #22c55e) 22%, transparent); }
		50%      { box-shadow: 0 0 0 6px color-mix(in srgb, var(--ac, #22c55e) 8%,  transparent); }
	}

	/* Hero pill — programare existentă (subtilă) */
	.hero-pill {
		text-decoration: none;
		background: rgba(59,130,246,0.18);
		border: 1px solid rgba(59,130,246,0.45);
		color: #93c5fd;
		transition: transform 0.25s ease, background 0.25s ease, box-shadow 0.25s ease;
	}
	.hero-pill.is-overlay {
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
	}
	.hero-pill:hover {
		transform: translateY(-1px);
		background: rgba(59,130,246,0.28);
		box-shadow: 0 6px 16px -8px rgba(59,130,246,0.6);
	}
	.hero-pill-accent { color: #93c5fd; }
	.hero-pill-arrow {
		display: inline-block;
		transition: transform 0.25s ease;
	}
	.hero-pill:hover .hero-pill-arrow { transform: translateX(3px); }

	/* Hero pill — CTA wow (fără programare) */
	.hero-pill--cta {
		background: linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%);
		border: 1px solid rgba(255,255,255,0.22);
		color: #fff;
		box-shadow:
			0 1px 0 rgba(255,255,255,0.22) inset,
			0 8px 22px -6px rgba(99,102,241,0.7),
			0 0 0 0 rgba(99,102,241,0.55);
		animation: ctaGlow 2.6s ease-in-out infinite;
	}
	.hero-pill--cta:hover {
		transform: translateY(-1px);
		background: linear-gradient(135deg, #4f8cff 0%, #7c7cff 50%, #9d6dff 100%);
	}
	@keyframes ctaGlow {
		0%, 100% { box-shadow: 0 1px 0 rgba(255,255,255,0.22) inset, 0 8px 22px -6px rgba(99,102,241,0.7), 0 0 0 0 rgba(99,102,241,0.0); }
		50%      { box-shadow: 0 1px 0 rgba(255,255,255,0.22) inset, 0 10px 26px -6px rgba(99,102,241,0.85), 0 0 0 6px rgba(99,102,241,0.0); }
	}
	.hero-pill-shimmer {
		background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%);
		transform: translateX(-100%);
		animation: pillShimmer 3.2s ease-in-out infinite;
		mix-blend-mode: overlay;
	}
	@keyframes pillShimmer {
		0%, 25%   { transform: translateX(-100%); }
		70%, 100% { transform: translateX(100%); }
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-dock-aurora, .hero-status-dot, .hero-pill--cta, .hero-pill-shimmer { animation: none; }
	}

	/* ===== Showroom — hero fallback fără poză ===== */
	.sh-bg {
		background: radial-gradient(120% 95% at 50% 30%, #1b2350 0%, #131328 46%, #0d0d22 100%);
	}
	.sh-spot {
		background:
			radial-gradient(46% 40% at 50% 46%, rgba(59,130,246,0.34), transparent 72%),
			radial-gradient(40% 30% at 18% 6%, rgba(120,160,255,0.12), transparent 70%);
		animation: shSpot 7s ease-in-out infinite alternate;
	}
	@keyframes shSpot { from { opacity: 0.82; } to { opacity: 1; } }
	.sh-streaks {
		opacity: 0.45;
		background:
			linear-gradient(105deg, transparent 44%, rgba(255,255,255,0.06) 48%, transparent 52%),
			linear-gradient(105deg, transparent 62%, rgba(120,160,255,0.10) 66%, transparent 70%);
	}
	.sh-floor {
		height: 48%;
		background: linear-gradient(180deg, transparent, rgba(6,7,20,0.88));
	}
	.sh-car {
		position: absolute;
		z-index: 0;
		right: -4px;
		bottom: 30px;
		width: 92%;
		opacity: 0.32;
		filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));
		animation: shDrift 9s ease-in-out infinite alternate;
	}
	@keyframes shDrift { from { transform: translateX(0); } to { transform: translateX(-2.5%); } }
	.sh-car .body  { fill: url(#shCarGrad); }
	.sh-car .glass { fill: rgba(150,180,255,0.18); }
	.sh-car .wheel { fill: #0b0b18; stroke: rgba(150,180,255,0.30); stroke-width: 3; }
	.sh-car .hub   { fill: rgba(150,180,255,0.28); }
	.sh-car .glow  { fill: #8fb4ff; }

	.sh-frame {
		position: absolute;
		z-index: 5;
		left: 50%;
		top: 51%;
		transform: translate(-50%, -50%);
		width: 170px;
		height: 106px;
		border-radius: 15px;
		border: 1.5px dashed rgba(150,180,255,0.5);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background: rgba(59,130,246,0.08);
		text-decoration: none;
		transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
	}
	.sh-frame:hover {
		background: rgba(59,130,246,0.15);
		border-color: rgba(150,180,255,0.85);
		box-shadow: 0 0 0 4px rgba(59,130,246,0.10);
	}
	.sh-frame:active { transform: translate(-50%, -50%) scale(0.97); }
	.sh-frame:focus-visible { outline: 2px solid #93c5fd; outline-offset: 3px; }
	.sh-cam { font-size: 25px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.45)); }
	.sh-lbl { font-size: 12.5px; font-weight: 800; color: #c3d1f2; letter-spacing: 0.01em; }
	.sh-sub { font-size: 10.5px; font-weight: 500; color: #8fa0c8; margin-top: -3px; }
	.sh-corner { position: absolute; width: 15px; height: 15px; border: 2px solid rgba(150,180,255,0.85); }
	.sh-c1 { top: -1px; left: -1px;  border-right: 0; border-bottom: 0; border-radius: 5px 0 0 0; }
	.sh-c2 { top: -1px; right: -1px; border-left: 0;  border-bottom: 0; border-radius: 0 5px 0 0; }
	.sh-c3 { bottom: -1px; left: -1px;  border-right: 0; border-top: 0; border-radius: 0 0 0 5px; }
	.sh-c4 { bottom: -1px; right: -1px; border-left: 0;  border-top: 0; border-radius: 0 0 5px 0; }

	@media (prefers-reduced-motion: reduce) {
		.sh-car, .sh-spot { animation: none; }
	}

	/* Rental CTA card — distinct gradient (teal/violet) ca să nu se confunde cu acțiunea principală */
	.rental-cta {
		background: linear-gradient(135deg, #0e766e 0%, #1d4ed8 50%, #6d28d9 100%);
		border: 1px solid rgba(255,255,255,0.18);
		text-decoration: none;
		box-shadow:
			0 1px 0 rgba(255,255,255,0.18) inset,
			0 10px 28px -10px rgba(99,102,241,0.55);
		isolation: isolate;
	}
	.rental-aurora {
		background:
			radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.16) 0%, transparent 55%),
			radial-gradient(90% 70% at 100% 100%, rgba(255,255,255,0.10) 0%, transparent 60%);
		opacity: 0.9;
		animation: aurora 6s ease-in-out infinite alternate;
	}
	.rental-shimmer {
		background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%);
		transform: translateX(-100%);
		animation: shimmer 4.2s ease-in-out infinite;
		mix-blend-mode: overlay;
	}
	.rental-orb {
		width: 44px;
		height: 44px;
		border-radius: 14px;
		background: rgba(255,255,255,0.18);
		border: 1px solid rgba(255,255,255,0.28);
		backdrop-filter: blur(6px);
		box-shadow: 0 4px 14px -4px rgba(0,0,0,0.4);
	}
	.rental-arrow {
		display: inline-block;
		transition: transform 0.25s ease;
	}
	.rental-cta:hover .rental-arrow { transform: translateX(3px); }

	@media (prefers-reduced-motion: reduce) {
		.rental-aurora, .rental-shimmer { animation: none; }
	}
</style>
