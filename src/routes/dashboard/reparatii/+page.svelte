<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { gsap } from 'gsap';
	import { api, timeAgo, type WorkOrder, type MasinaActiva, type ProgramareMini, type TimelineStep } from '$lib/api';
	import Skeleton from '$lib/Skeleton.svelte';
	import ProgressStepper from '$lib/ProgressStepper.svelte';
	import { atelier, atelierLinie, incarcaAtelier } from '$lib/atelier';

	let reparatii   = $state<WorkOrder[]>([]);
	let loading     = $state(true);
	let loadingMore = $state(false);
	let error       = $state('');
	let currentPage = $state(1);
	let lastPage    = $state(1);

	/**
	 * Povestea paginii, nu doar arhiva: mașina aflată ACUM în service (cu drumul
	 * ei), programarea viitoare și — pentru clientul nou — galeria atelierului și
	 * drumul spre programare. Toate vin din API-uri care există deja; fiecare
	 * pică tăcut, pagina rămâne în picioare cu ce are.
	 */
	let masinaActiva = $state<MasinaActiva | null>(null);
	let programare   = $state<ProgramareMini | null>(null);
	let timeline     = $state<TimelineStep[]>([]);
	let galerie      = $state<{ url: string; titlu: string }[]>([]);

	const colorMap: Record<string, string> = {
		green: '#22c55e', red: '#ef4444', yellow: '#eab308'
	};

	const fmtZi = (iso: string) =>
		new Date(iso).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'short' });
	const fmtOra = (iso: string) =>
		new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

	function deschideChat() {
		window.dispatchEvent(new CustomEvent('portal:deschide-chat'));
	}

	onMount(async () => {
		// Vitrina și contextul — separate de istoric: eșecul lor nu golește pagina.
		api.dashboard()
			.then(async (d) => {
				masinaActiva = d.masina_activa;
				programare   = d.urmatoarea_programare;
				if (d.masina_activa) {
					try {
						timeline = (await api.reparatie(d.masina_activa.wo_uid)).timeline;
					} catch { /* drumul e opțional, cardul stă și fără el */ }
				}
			})
			.catch(() => {});
		incarcaAtelier();
		api.serviceGalerie()
			.then((res) => (galerie = res.galerie))
			.catch(() => {});

		try {
			const res = await api.reparatii();
			reparatii   = res.data;
			currentPage = res.current_page;
			lastPage    = res.last_page;
			await tick();
			gsap.from('.wo-card', { y: 16, opacity: 0, duration: 0.28, stagger: 0.06, ease: 'power2.out' });
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcarea reparațiilor.';
		} finally {
			loading = false;
		}
	});

	async function loadMore() {
		if (loadingMore || currentPage >= lastPage) return;
		loadingMore = true;
		try {
			const res = await api.reparatiiPage(currentPage + 1);
			reparatii   = [...reparatii, ...res.data];
			currentPage = res.current_page;
			lastPage    = res.last_page;
		} catch (e: any) {
			error = e.message ?? 'Eroare la încărcare.';
		} finally {
			loadingMore = false;
		}
	}
</script>

<div class="space-y-4">
	<h1 class="text-xl font-bold" style="color: var(--text)">Reparații</h1>

	{#if masinaActiva}
		<!-- Mașina e în service ACUM — cardul viu, primul pe pagină. -->
		<a href="/dashboard/reparatii/{masinaActiva.wo_uid}" class="rep-hero block">
			<div class="flex items-center justify-between gap-3">
				<span class="rep-live"><i></i>În service acum</span>
				{#if masinaActiva.eta}
					<span class="text-[11px] font-bold" style="color: var(--muted)">gata estimat: {fmtZi(masinaActiva.eta)}</span>
				{/if}
			</div>

			<div class="flex items-center gap-3">
				{#if masinaActiva.foto_url}
					<img src={masinaActiva.foto_url} alt="" class="rep-foto" loading="lazy" />
				{:else}
					<span class="rep-foto grid place-items-center text-2xl">🚗</span>
				{/if}
				<span class="flex-1 min-w-0">
					<b class="block text-base leading-tight" style="color: var(--text)">{masinaActiva.marca} {masinaActiva.model}</b>
					<span class="text-xs" style="color: var(--muted)">
						{masinaActiva.numar_inmatriculare} · {masinaActiva.status_label}{#if masinaActiva.ultima_actualizare} · actualizat {timeAgo(masinaActiva.ultima_actualizare)}{/if}
					</span>
				</span>
				<span class="rep-vezi shrink-0">Vezi detalii →</span>
			</div>

			{#if timeline.length > 0}
				<ProgressStepper steps={timeline} />
			{/if}

			{#if masinaActiva.deviz_pending}
				<p class="rep-deviz">📋 Ai un deviz de aprobat — lucrarea așteaptă răspunsul tău.</p>
			{/if}
		</a>
	{:else if !loading}
		<!-- Client fără nimic activ: pagina îl duce la programare, nu-i arată un gol. -->
		<a href="/dashboard/programari/noua" class="cta-service">
			<span class="cta-service-orb">🔧</span>
			<span class="flex-1 min-w-0">
				<b class="block text-base" style="color: #fff">Programează-te la service</b>
				{#if $atelier}
					<span class="block text-xs font-semibold mt-0.5 truncate" style="color: rgba(255,255,255,0.94)">
						{atelierLinie($atelier)}
					</span>
				{/if}
				<span class="block text-[11px] mt-px" style="color: rgba(255,255,255,0.7)">
					diagnoză pe loc · mașină de schimb cât durează reparația
				</span>
			</span>
			<span class="cta-service-go">Alege ziua →</span>
		</a>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
			<a href="/dashboard/inchirieri" class="rep-mini">
				<span aria-hidden="true">🚗</span>
				<span class="min-w-0">
					<b>Mașină de schimb</b>
					<p>rămâi pe roți cât reparăm — CASCO inclusă, plata la ridicare</p>
				</span>
			</a>
			<button type="button" onclick={deschideChat} class="rep-mini text-left">
				<span aria-hidden="true">💬</span>
				<span class="min-w-0">
					<b>Nu știi ce are?</b>
					<p>scrie-ne în chat cu ce simți la mașină și îți spunem noi</p>
				</span>
			</button>
		</div>

		{#if galerie.length > 0}
			<!-- Galeria atelierului — pozele și textele vin din WMS (Setări → Portal clienți). -->
			<div class="rep-gal">
				{#each galerie as g, i (g.url)}
					<figure class="rep-tile" class:rep-tile-mare={i === 0}>
						<img src={g.url} alt={g.titlu} loading="lazy" />
						<figcaption>{g.titlu}</figcaption>
					</figure>
				{/each}
			</div>
		{/if}
	{/if}

	{#if programare}
		<div class="rep-prog">
			<span aria-hidden="true">📅</span>
			<span class="flex-1 min-w-0 truncate">
				<b>Programarea ta:</b>
				{fmtZi(programare.start_at)} · {fmtOra(programare.start_at)}{#if programare.tip_serviciu_label} · {programare.tip_serviciu_label}{/if}
			</span>
			<a href="/dashboard/programari" class="rep-vezi shrink-0 text-[11px]">Vezi / mută</a>
		</div>
	{/if}

	<p class="text-[11px] font-bold uppercase tracking-wider pt-1" style="color: var(--muted)">Istoric</p>

	{#if loading}
		<div class="space-y-3">
			{#each Array(3) as _}
				<div class="p-4 rounded-2xl border" style="background: var(--surface); border-color: var(--border);">
					<div class="flex items-center justify-between mb-2">
						<Skeleton height="h-4" class="w-28" />
						<Skeleton height="h-5" class="w-16" rounded="rounded-full" />
					</div>
					<Skeleton height="h-3" class="w-48 mt-1" />
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="text-center py-10">
			<p class="text-sm text-red-400">{error}</p>
		</div>
	{:else if reparatii.length === 0}
		<p class="rep-gol">Nicio reparație încă — după prima vizită, istoricul și devizele rămân aici, la îndemână.</p>
	{:else}
		<div class="space-y-3">
			{#each reparatii as wo}
				<a href="/dashboard/reparatii/{wo.uid}"
					class="wo-card block p-4 rounded-2xl border transition-all hover:border-blue-500/40"
					style="background: var(--surface); border-color: var(--border);">
					<div class="flex items-center justify-between mb-2">
						<span class="font-semibold text-sm" style="color: var(--text)">
							{wo.masina?.numar_inmatriculare ?? '—'}
						</span>
						{#if wo.portal_color}
							<span class="text-xs px-2 py-0.5 rounded-full font-medium"
								style="background: {colorMap[wo.portal_color]}22; color: {colorMap[wo.portal_color]}">
								{wo.portal_label}
							</span>
						{/if}
					</div>
					<p class="text-xs" style="color: var(--muted)">
						{wo.masina?.marca} {wo.masina?.model}
						{#if wo.reception_at}
							· {new Date(wo.reception_at).toLocaleDateString('ro-RO')}
						{/if}
						{#if wo.predare_la}
							· <span style="color: var(--accent)">predare {new Date(wo.predare_la).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}</span>
						{/if}
					</p>
					{#if wo.ultima_actualizare}
						<p class="text-[11px] mt-1" style="color: var(--muted)">actualizat {timeAgo(wo.ultima_actualizare)}</p>
					{/if}
				</a>
			{/each}
		</div>

		{#if currentPage < lastPage}
			<button
				onclick={loadMore}
				disabled={loadingMore}
				class="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 transition-all"
				style="background: var(--surface); color: var(--muted); border: 1px solid var(--border);">
				{loadingMore ? 'Se încarcă...' : `Mai multe (pagina ${currentPage + 1} din ${lastPage})`}
			</button>
		{/if}
	{/if}
</div>

<style>
	/* Cardul „în service acum" — albastru viu, primul pe pagină. */
	.rep-hero {
		display: grid;
		gap: 10px;
		padding: 14px 16px;
		border-radius: 16px;
		text-decoration: none;
		background: linear-gradient(135deg, #3b82f61f 0%, #3b82f608 60%, var(--surface) 100%);
		border: 1px solid color-mix(in srgb, #3b82f6 45%, var(--border));
		transition: border-color 0.2s ease;
	}
	.rep-hero:hover { border-color: #3b82f6; }
	.rep-live {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #6ee7b7;
	}
	.rep-live i { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 4px #10b98133; }
	.rep-foto {
		width: 84px; height: 56px;
		border-radius: 12px;
		object-fit: cover;
		flex-shrink: 0;
		background: var(--surface2);
		border: 1px solid var(--border);
	}
	.rep-vezi {
		font-size: 12px;
		font-weight: 800;
		color: var(--text);
		padding: 9px 13px;
		border-radius: 999px;
		background: var(--surface2);
		border: 1px solid var(--border);
		text-decoration: none;
	}
	.rep-deviz {
		font-size: 12px;
		font-weight: 600;
		color: #fbbf24;
		padding: 8px 10px;
		border-radius: 10px;
		background: #eab30815;
		border: 1px solid #eab30840;
	}

	/* Bannerul de programare — cald, alt caracter decât vitrina de închirieri. */
	/* `.cta-service` (+ orb, go) stă în app.css: același card apare și pe Acasă,
	   iar gama nu trebuie ținută sincronizată în două fișiere. */
	.rep-mini {
		display: flex;
		gap: 10px;
		padding: 12px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		text-decoration: none;
		color: var(--text);
		cursor: pointer;
		font: inherit;
		transition: border-color 0.2s ease;
	}
	.rep-mini:hover { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); }
	.rep-mini > span:first-child { font-size: 20px; }
	.rep-mini b { font-size: 13px; display: block; }
	.rep-mini p { font-size: 11px; color: var(--muted); margin-top: 2px; }

	/* Galeria atelierului: prima poză mare, restul mici. */
	.rep-gal {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		grid-auto-rows: 96px;
		gap: 10px;
	}
	@media (min-width: 640px) { .rep-gal { grid-template-columns: repeat(3, 1fr); } }
	.rep-tile {
		margin: 0;
		display: flex;
		flex-direction: column;
		border-radius: 12px;
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.rep-tile-mare { grid-row: span 2; }
	.rep-tile img { flex: 1; min-height: 0; width: 100%; object-fit: cover; }
	.rep-tile figcaption {
		font-size: 10px;
		font-weight: 700;
		color: var(--muted);
		padding: 6px 9px;
		letter-spacing: 0.02em;
	}

	.rep-prog {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-radius: 12px;
		font-size: 12px;
		color: var(--text);
		background: color-mix(in srgb, #eab308 10%, var(--surface));
		border: 1px solid color-mix(in srgb, #eab308 40%, var(--border));
	}
	.rep-gol {
		font-size: 12px;
		color: var(--muted);
		padding: 14px;
		text-align: center;
		border: 1px dashed var(--border);
		border-radius: 12px;
	}
</style>
