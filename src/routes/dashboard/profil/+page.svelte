<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { api, type Client, type Masina, type MasinaFoto, type ConsimtaminteStatus } from '$lib/api';
	import { auth } from '$lib/stores';

	let client  = $state<Client | null>(null);
	let masini  = $state<Masina[]>([]);
	let loading = $state(true);
	let error   = $state('');

	// Galerie foto per mașină + index curent
	let masinaFotos     = $state<Record<number, MasinaFoto[]>>({});
	let currentPhotoIdx = $state<Record<number, number>>({});

	// Editare email
	let emailEdit  = $state(false);
	let emailVal   = $state('');
	let emailSaving = $state(false);
	let emailOk    = $state(false);

	// GDPR — consimțăminte și drepturi
	let gdprStatus     = $state<ConsimtaminteStatus | null>(null);
	let gdprBusy       = $state<string>(''); // 'export' | 'marketing' | 'stergere' | 'rectificare'
	let gdprMsg        = $state('');
	let stergereOpen   = $state(false);
	let stergereMotiv  = $state('');
	let stergereOk     = $state<string | null>(null);
	let rectificareOpen = $state(false);
	let rectificareText = $state('');
	let rectificareOk   = $state(false);

	// Acordeon header — null = ambele închise
	let panelOpen = $state<'consilier' | 'gdpr' | null>(null);
	async function togglePanel(p: typeof panelOpen) {
		panelOpen = panelOpen === p ? null : p;
		if (panelOpen) {
			await tick(); // așteaptă să se randeze secțiunea
			const el = document.getElementById(`section-${panelOpen}`);
			if (el) {
				const headerOffset = 64; // înălțimea header-ului sticky + buffer
				const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
				window.scrollTo({ top, behavior: 'smooth' });
			}
		}
	}

	onMount(async () => {
		try {
			const [me, mArr] = await Promise.all([api.me(), api.masini()]);
			client = me;
			masini = mArr;
			emailVal = me.email ?? '';
			try { gdprStatus = await api.consimtaminteStatus(); } catch {}

			// Încarcă galeria foto pentru fiecare mașină în paralel (best-effort, ignoră erori)
			const fotosMap: Record<number, MasinaFoto[]> = {};
			await Promise.all(mArr.map(async (m) => {
				try {
					const det = await api.masina(m.id);
					if (det.fotos && det.fotos.length > 0) fotosMap[m.id] = det.fotos;
				} catch { /* ignorăm */ }
			}));
			masinaFotos = fotosMap;
		} catch {
			error = 'Nu s-au putut încărca datele profilului.';
		} finally {
			loading = false;
		}
	});

	function photosFor(m: Masina): MasinaFoto[] {
		const gallery = masinaFotos[m.id];
		if (gallery && gallery.length > 0) return gallery;
		if (m.foto_url) return [{ id: 0, url: m.foto_url }];
		return [];
	}

	function nextPhoto(masinaId: number, total: number) {
		const cur = currentPhotoIdx[masinaId] ?? 0;
		currentPhotoIdx = { ...currentPhotoIdx, [masinaId]: (cur + 1) % total };
	}
	function prevPhoto(masinaId: number, total: number) {
		const cur = currentPhotoIdx[masinaId] ?? 0;
		currentPhotoIdx = { ...currentPhotoIdx, [masinaId]: (cur - 1 + total) % total };
	}

	async function exportDate(format: 'json' | 'pdf' = 'json') {
		gdprBusy = 'export'; gdprMsg = '';
		try { await api.exportDate(format); gdprMsg = `Datele au fost descărcate (${format.toUpperCase()}).`; }
		catch (e: any) { gdprMsg = e.message ?? 'Export indisponibil acum.'; }
		finally { gdprBusy = ''; }
	}

	async function toggleMarketing() {
		if (!gdprStatus) return;
		gdprBusy = 'marketing';
		try {
			if (gdprStatus.marketing) {
				await api.retrageConsimtamant('marketing');
				gdprStatus = { ...gdprStatus, marketing: false };
				gdprMsg = 'Te-ai dezabonat de la oferte.';
			} else {
				await api.acceptaConsimtamant({
					versiune: gdprStatus.versiune_curenta, politica: true, marketing: true,
				});
				gdprStatus = { ...gdprStatus, marketing: true };
				gdprMsg = 'Te-ai abonat la oferte.';
			}
		} catch (e: any) { gdprMsg = e.message ?? 'Eroare. Încearcă din nou.'; }
		finally { gdprBusy = ''; }
	}

	async function trimiteCerereStergere() {
		gdprBusy = 'stergere';
		try {
			const r = await api.cerereStergereCont(stergereMotiv.trim() || undefined);
			stergereOk = r.programata_la;
			if (gdprStatus) gdprStatus = { ...gdprStatus, cerere_stergere_la: r.programata_la };
		} catch (e: any) { gdprMsg = e.message ?? 'Eroare la trimiterea cererii.'; }
		finally { gdprBusy = ''; }
	}

	async function anuleazaCerereStergere() {
		gdprBusy = 'stergere';
		try {
			await api.anuleazaCerereStergere();
			if (gdprStatus) gdprStatus = { ...gdprStatus, cerere_stergere_la: null };
			gdprMsg = 'Cererea de ștergere a fost anulată.';
		} catch (e: any) { gdprMsg = e.message ?? 'Eroare.'; }
		finally { gdprBusy = ''; }
	}

	async function trimiteRectificare() {
		gdprBusy = 'rectificare';
		try {
			await api.cerereRectificare(rectificareText.trim());
			rectificareOk = true;
			setTimeout(() => { rectificareOpen = false; rectificareOk = false; rectificareText = ''; }, 2200);
		} catch (e: any) { gdprMsg = e.message ?? 'Eroare.'; }
		finally { gdprBusy = ''; }
	}

	// Câmpuri completate / lipsă
	const emailLipsa   = $derived(!client?.email);
	const completare = $derived(() => {
		if (!client) return 0;
		let done = 0;
		let total = 4;
		if (client.nume)       done++;
		if (client.telefon)    done++;
		if (!client.ci_lipsa)  done++;
		if (!emailLipsa)       done++;
		return Math.round((done / total) * 100);
	});
</script>

<div class="space-y-6 pb-8">

	<!-- Titlu + 2 mini-carduri trigger — sticky sub header-ul global (h-14 = 56px) -->
	<div class="sticky z-30 -mx-4 px-4 py-3 flex items-start gap-3 flex-wrap"
		style="top: 56px; background: rgba(28,28,36,0.92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid var(--border);">
		<div class="flex-1 min-w-[200px]">
			<h1 class="text-xl font-bold" style="color: var(--text)">Profilul meu</h1>
			<p class="text-sm mt-0.5" style="color: var(--muted)">Datele tale înregistrate la NLG</p>
		</div>

		<div class="flex gap-2 shrink-0">
			<a href="/dashboard/documente"
				class="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl transition-all active:scale-[0.96]"
				style="background: var(--surface); color: var(--text); border: 1.5px solid var(--border); min-width: 78px; text-decoration: none;">
				<span class="text-xl leading-none">📂</span>
				<span class="text-[11px] font-bold leading-tight">Documente</span>
			</a>
			<a href="/dashboard/profil/istoric"
				class="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl transition-all active:scale-[0.96]"
				style="background: var(--surface); color: var(--text); border: 1.5px solid var(--border); min-width: 78px; text-decoration: none;">
				<span class="text-xl leading-none">🕘</span>
				<span class="text-[11px] font-bold leading-tight">Istoric</span>
			</a>
			{#each [
				{ key: 'consilier' as const, icon: '👤', label: 'Consilier' },
				{ key: 'gdpr'      as const, icon: '🔒', label: 'GDPR' },
			] as p}
				{@const isOpen = panelOpen === p.key}
				<button onclick={() => togglePanel(p.key)}
					class="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl transition-all active:scale-[0.96]"
					style="
						background: {isOpen ? 'var(--accent)' : 'var(--surface)'};
						color: {isOpen ? 'white' : 'var(--text)'};
						border: 1.5px solid {isOpen ? 'var(--accent)' : 'var(--border)'};
						box-shadow: {isOpen ? '0 6px 18px rgba(59,130,246,0.30)' : 'none'};
						min-width: 78px;
					">
					<span class="text-xl leading-none">{p.icon}</span>
					<span class="text-[11px] font-bold leading-tight">{p.label}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-16">
			<div class="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style="border-color: var(--accent); border-top-color: transparent;"></div>
		</div>

	{:else if error}
		<div class="px-4 py-3 rounded-xl text-sm" style="background: #ef444415; color: #ef4444; border: 1px solid #ef444430;">
			{error}
		</div>

	{:else if client}

		<!-- Card progres completare profil -->
		{@const pct = completare()}
		{#if pct < 100}
			<div class="px-4 py-4 rounded-2xl space-y-2" style="background: var(--surface); border: 1px solid var(--border);">
				<div class="flex items-center justify-between">
					<span class="text-xs font-semibold" style="color: var(--muted)">Completare profil</span>
					<span class="text-xs font-bold" style="color: var(--accent)">{pct}%</span>
				</div>
				<div class="w-full h-1.5 rounded-full" style="background: var(--surface2);">
					<div class="h-full rounded-full transition-all" style="width: {pct}%; background: var(--accent);"></div>
				</div>
				{#if pct < 100}
					<p class="text-xs" style="color: var(--muted)">
						Completați profilul pentru a beneficia de toate serviciile NLG.
					</p>
				{/if}
			</div>
		{/if}

		<!-- Date personale + Mașinile mele — grid 2 coloane pe sm+, înălțime egală -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">

		<!-- Date personale -->
		<div class="rounded-2xl overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
			<div class="px-4 py-3 border-b" style="border-color: var(--border);">
				<span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted)">Date personale</span>
			</div>

			<div class="divide-y" style="divide-color: var(--border);">
				<!-- Nume -->
				<div class="px-4 py-3 flex items-center justify-between">
					<div>
						<div class="text-xs" style="color: var(--muted)">Nume complet</div>
						<div class="text-sm font-medium mt-0.5" style="color: var(--text)">{client.nume || '—'}</div>
					</div>
					{#if client.vip}
						<span class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
							style="background: linear-gradient(90deg,#854d0e30,#ca8a0430); color: #ca8a04; border: 1px solid #ca8a0440;">
							⭐ VIP
						</span>
					{/if}
				</div>

				<!-- Telefon -->
				<div class="px-4 py-3">
					<div class="text-xs" style="color: var(--muted)">Telefon</div>
					<div class="text-sm font-medium mt-0.5" style="color: var(--text)">{client.telefon}</div>
				</div>

				<!-- Email -->
				<div class="px-4 py-3">
					<div class="flex items-center justify-between mb-1">
						<div class="text-xs" style="color: var(--muted)">Email</div>
						{#if !emailEdit}
							<button
								onclick={() => { emailEdit = true; emailOk = false; }}
								class="text-xs font-medium"
								style="color: var(--accent)"
							>
								{emailLipsa ? '+ Adaugă' : 'Modifică'}
							</button>
						{/if}
					</div>

					{#if emailEdit}
						<div class="flex gap-2 mt-1">
							<input
								type="email"
								bind:value={emailVal}
								placeholder="adresa@email.com"
								class="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
								style="background: var(--surface2); border: 1px solid var(--accent); color: var(--text);"
							/>
							<button
								onclick={() => { emailEdit = false; emailOk = false; }}
								class="px-3 py-2 rounded-lg text-xs"
								style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);"
							>
								Anulează
							</button>
						</div>
						<p class="text-xs mt-2" style="color: var(--muted)">
							Modificarea email-ului se face la service — contactați consilierul dumneavoastră.
						</p>
					{:else}
						<div class="text-sm font-medium" style="color: {emailLipsa ? 'var(--muted)' : 'var(--text)'};">
							{emailLipsa ? 'Lipsă — contactați service-ul' : client.email}
						</div>
					{/if}
				</div>

				<!-- Documente lipsă -->
				{#if client.ci_lipsa || client.permis_lipsa}
					<div class="px-4 py-3">
						<div class="text-xs mb-2" style="color: var(--muted)">Documente</div>
						<div class="space-y-1.5">
							{#if client.ci_lipsa}
								<div class="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style="background: #eab30815; color: #eab308; border: 1px solid #eab30830;">
									⚠️ Carte de identitate lipsă — prezentați-vă la service
								</div>
							{/if}
							{#if client.permis_lipsa}
								<div class="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style="background: #eab30815; color: #eab308; border: 1px solid #eab30830;">
									⚠️ Permis de conducere lipsă — prezentați-vă la service
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Mașinile mele -->
		<div class="rounded-2xl overflow-hidden flex flex-col h-full" style="background: var(--surface); border: 1px solid var(--border);">
			<div class="px-4 py-3 border-b shrink-0" style="border-color: var(--border);">
				<span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted)">
					Mașinile mele ({masini.length})
				</span>
			</div>

			{#if masini.length === 0}
				<div class="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
					<div class="text-5xl mb-3">🚗</div>
					<div class="text-sm" style="color: var(--muted)">Nicio mașină înregistrată</div>
					<a href="/dashboard/masini" class="inline-block mt-3 text-xs font-semibold px-4 py-2 rounded-lg"
						style="background: var(--accent); color: white;">
						+ Adaugă mașină
					</a>
				</div>
			{:else}
				<div class="flex-1 flex flex-col">
					{#each masini as m, idx}
						{@const photos = photosFor(m)}
						{@const curIdx = currentPhotoIdx[m.id] ?? 0}
						{@const cur = photos[curIdx]}

						<!-- Carusel foto -->
						<div class="relative w-full overflow-hidden flex-1"
							style="background: var(--surface2); min-height: 180px; {idx > 0 ? 'border-top: 1px solid var(--border);' : ''}">
							{#if cur}
								<img src={cur.url} alt="{m.marca} {m.model}"
									class="w-full h-full object-cover"
									style="display: block; min-height: 180px;" />
							{:else}
								<div class="w-full h-full flex items-center justify-center" style="min-height: 180px;">
									<span class="text-6xl opacity-30">🚗</span>
								</div>
							{/if}

							{#if photos.length > 1}
								<!-- Săgeți stânga / dreapta -->
								<button onclick={(e) => { e.stopPropagation(); prevPhoto(m.id, photos.length); }}
									class="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-base transition-all active:scale-90"
									style="background: rgba(0,0,0,0.55); color: white; border: none; backdrop-filter: blur(4px);"
									aria-label="Foto anterior">‹</button>
								<button onclick={(e) => { e.stopPropagation(); nextPhoto(m.id, photos.length); }}
									class="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-base transition-all active:scale-90"
									style="background: rgba(0,0,0,0.55); color: white; border: none; backdrop-filter: blur(4px);"
									aria-label="Foto următor">›</button>

								<!-- Indicator dots -->
								<div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
									{#each photos as _, i}
										<span class="w-1.5 h-1.5 rounded-full transition-all"
											style="background: {i === curIdx ? 'white' : 'rgba(255,255,255,0.4)'};"></span>
									{/each}
								</div>

								<!-- Counter -->
								<span class="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
									style="background: rgba(0,0,0,0.55); color: white; backdrop-filter: blur(4px);">
									{curIdx + 1} / {photos.length}
								</span>
							{/if}
						</div>

						<!-- Info mașină -->
						<a href="/dashboard/masini/{m.id}"
							class="flex items-center gap-3 px-4 py-3 transition-opacity active:opacity-70 shrink-0"
							style="text-decoration: none;">
							<span class="text-xl">🚗</span>
							<div class="flex-1 min-w-0">
								<div class="text-sm font-semibold truncate" style="color: var(--text)">
									{m.marca} {m.model}
									{#if m.an} <span style="color: var(--muted)">· {m.an}</span>{/if}
								</div>
								<div class="text-xs mt-0.5 truncate" style="color: var(--muted)">
									{m.numar_inmatriculare || 'Nr. înmatriculare necompletat'}
									{#if m.observatii?.includes('pe firmă')}
										<span class="ml-1 px-1.5 py-0.5 rounded text-[10px]"
											style="background: var(--surface2); color: var(--muted);">Firmă</span>
									{/if}
								</div>
							</div>
							<span style="color: var(--muted)">›</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>

		</div>
		<!-- /grid 2 coloane Date personale + Mașinile mele -->

		<!-- Consilier alocat — vizibil doar când mini-cardul Consilier e activ -->
		{#if panelOpen === 'consilier' && client.consilier}
			{@const c = client.consilier}
			<div id="section-consilier" class="rounded-2xl overflow-hidden scroll-mt-20" style="background: var(--surface); border: 1px solid var(--border);">
				<div class="px-4 py-3 border-b" style="border-color: var(--border);">
					<span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted)">Consilier alocat</span>
				</div>
				<div class="px-4 py-3 flex items-center gap-3">
					{#if c.avatar}
						<img src={c.avatar} alt={c.name} class="w-10 h-10 rounded-full object-cover" />
					{:else}
						<div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
							style="background: var(--accent)20; color: var(--accent);">
							{c.initials}
						</div>
					{/if}
					<div>
						<div class="text-sm font-semibold" style="color: var(--text)">{c.name}</div>
						{#if c.functie}
							<div class="text-xs" style="color: var(--muted)">{c.functie}</div>
						{/if}
					</div>
					{#if c.telefon}
						<a href="tel:{c.telefon}" class="ml-auto text-xs px-3 py-1.5 rounded-lg font-medium"
							style="background: var(--accent)15; color: var(--accent);">
							Sună
						</a>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Notă prospect -->
		{#if client.are_restante || client.ci_lipsa || client.permis_lipsa}
			<div class="px-4 py-3 rounded-xl text-xs" style="background: var(--surface); border: 1px solid var(--border); color: var(--muted);">
				📋 Pentru a beneficia de toate serviciile, completați dosarul la prima vizită la service.
			</div>
		{/if}

		<!-- ═════ GDPR — Confidențialitate și drepturile mele (vizibil doar când mini-cardul GDPR e activ) ═════ -->
		{#if panelOpen === 'gdpr'}
		<div id="section-gdpr" class="rounded-2xl overflow-hidden scroll-mt-20" style="background: var(--surface); border: 1px solid var(--border);">
			<div class="px-4 py-3 border-b" style="border-color: var(--border);">
				<span class="text-xs font-semibold uppercase tracking-wider" style="color: var(--muted)">
					🔒 Confidențialitate · Drepturile mele GDPR
				</span>
			</div>

			<div class="divide-y" style="divide-color: var(--border);">

				<!-- Consimțământ marketing toggle -->
				<div class="px-4 py-3 flex items-center justify-between gap-3">
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold" style="color: var(--text)">Oferte și promoții</div>
						<div class="text-[11px] mt-0.5" style="color: var(--muted)">
							{gdprStatus?.marketing ? 'Primești SMS / email cu oferte' : 'Nu primești comunicări marketing'}
						</div>
					</div>
					<button onclick={toggleMarketing} disabled={gdprBusy === 'marketing'}
						class="shrink-0 relative w-12 h-7 rounded-full transition-all disabled:opacity-50"
						style="background: {gdprStatus?.marketing ? 'var(--accent)' : 'var(--surface2)'}; border: 1px solid var(--border);">
						<span class="absolute top-0.5 w-5 h-5 rounded-full transition-all"
							style="background: white; left: {gdprStatus?.marketing ? '22px' : '2px'};"></span>
					</button>
				</div>

				<!-- Export date — PDF + JSON -->
				<div class="px-4 py-3">
					<div class="flex items-start gap-3 mb-2">
						<span class="text-lg">📥</span>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-semibold" style="color: var(--text)">Descarcă datele mele</div>
							<div class="text-[11px] mt-0.5" style="color: var(--muted)">
								Toate datele tale într-un fișier (art. 15 + 20 GDPR)
							</div>
						</div>
					</div>
					<div class="flex gap-2 ml-7">
						<button onclick={() => exportDate('pdf')} disabled={gdprBusy === 'export'}
							class="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-50 transition-all active:scale-[0.97]"
							style="background: var(--accent); color: white; border: none;">
							📄 PDF (citibil)
						</button>
						<button onclick={() => exportDate('json')} disabled={gdprBusy === 'export'}
							class="flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-50 transition-all active:scale-[0.97]"
							style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);">
							{'{ }'} JSON (date)
						</button>
					</div>
				</div>

				<!-- Rectificare date -->
				<button onclick={() => { rectificareOpen = true; rectificareOk = false; }}
					class="w-full px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.99]"
					style="background: transparent; border: none; text-align: left; cursor: pointer;">
					<span class="text-lg">✏️</span>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold" style="color: var(--text)">Solicită corectarea datelor</div>
						<div class="text-[11px] mt-0.5" style="color: var(--muted)">
							Trimite o cerere de rectificare (art. 16 GDPR)
						</div>
					</div>
					<span style="color: var(--muted)">›</span>
				</button>

				<!-- Politici legale -->
				<a href="/legal/privacy" target="_blank"
					class="w-full px-4 py-3 flex items-center gap-3"
					style="text-decoration: none;">
					<span class="text-lg">📄</span>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold" style="color: var(--text)">Politica de confidențialitate</div>
						<div class="text-[11px] mt-0.5" style="color: var(--muted)">
							{gdprStatus?.versiune_acceptata
								? `Acceptată: v${gdprStatus.versiune_acceptata}`
								: 'Nu este acceptată încă'}
						</div>
					</div>
					<span style="color: var(--muted)">↗</span>
				</a>

				<a href="/legal/terms" target="_blank"
					class="w-full px-4 py-3 flex items-center gap-3"
					style="text-decoration: none;">
					<span class="text-lg">📋</span>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold" style="color: var(--text)">Termeni și condiții</div>
					</div>
					<span style="color: var(--muted)">↗</span>
				</a>

				<a href="/legal/cookies" target="_blank"
					class="w-full px-4 py-3 flex items-center gap-3"
					style="text-decoration: none;">
					<span class="text-lg">🍪</span>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold" style="color: var(--text)">Politica de cookies</div>
					</div>
					<span style="color: var(--muted)">↗</span>
				</a>

				<button onclick={() => window.dispatchEvent(new CustomEvent('open-cookie-banner'))}
					class="w-full px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.99]"
					style="background: transparent; border: none; text-align: left; cursor: pointer;">
					<span class="text-lg">⚙️</span>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold" style="color: var(--text)">Setări cookies</div>
						<div class="text-[11px] mt-0.5" style="color: var(--muted)">
							Schimbă preferințele de cookies
						</div>
					</div>
					<span style="color: var(--muted)">›</span>
				</button>

				<!-- Ștergere cont — destructiv, separat -->
				{#if gdprStatus?.cerere_stergere_la}
					<div class="px-4 py-3 space-y-2" style="background: #ef444408;">
						<div class="text-xs font-semibold" style="color: #ef4444">
							⏳ Cerere de ștergere în curs
						</div>
						<p class="text-[11px]" style="color: var(--muted)">
							Contul va fi șters pe <strong>{new Date(gdprStatus.cerere_stergere_la).toLocaleDateString('ro-RO')}</strong>.
							Datele obligatorii prin lege (facturi 10 ani) vor rămâne arhivate conform legislației.
						</p>
						<button onclick={anuleazaCerereStergere} disabled={gdprBusy === 'stergere'}
							class="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
							style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);">
							Anulează cererea
						</button>
					</div>
				{:else}
					<button onclick={() => { stergereOpen = true; stergereOk = null; stergereMotiv = ''; }}
						class="w-full px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.99]"
						style="background: transparent; border: none; text-align: left; cursor: pointer;">
						<span class="text-lg">🗑️</span>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-semibold" style="color: #ef4444">Șterge contul meu</div>
							<div class="text-[11px] mt-0.5" style="color: var(--muted)">
								Dreptul de a fi uitat (art. 17 GDPR)
							</div>
						</div>
						<span style="color: var(--muted)">›</span>
					</button>
				{/if}
			</div>

			{#if gdprMsg}
				<div class="px-4 py-2 text-[11px]" style="color: var(--muted); border-top: 1px solid var(--border);">
					{gdprMsg}
				</div>
			{/if}
		</div>

		<p class="text-[10px] text-center px-4" style="color: var(--muted)">
			Pentru orice întrebare: <a href="mailto:gdpr@nlg.ro" style="color: var(--accent)">gdpr@nlg.ro</a> ·
			Reclamații la <a href="https://www.dataprotection.ro" target="_blank" style="color: var(--accent)">ANSPDCP</a>
		</p>
		{/if}
		<!-- /GDPR -->

	{/if}
</div>

<!-- ═════ Modal cerere ștergere cont ═════ -->
{#if stergereOpen}
	<button class="fixed inset-0 z-[100]" style="background: rgba(0,0,0,0.7);"
		onclick={() => stergereOpen = false} aria-label="Închide"></button>

	<div class="fixed bottom-0 left-0 right-0 z-[101] rounded-t-3xl"
		style="background: var(--surface); border-top: 1px solid var(--border); max-height: 85dvh; overflow-y: auto;">
		<div class="px-4 pt-3 pb-8 max-w-md mx-auto">
			<div class="w-10 h-1 rounded-full mx-auto mb-5" style="background: var(--border);"></div>

			{#if stergereOk}
				<div class="text-center py-6">
					<p class="text-5xl mb-3">✅</p>
					<p class="text-base font-bold mb-2" style="color: var(--text)">Cerere înregistrată</p>
					<p class="text-sm mb-1" style="color: var(--muted)">
						Contul tău va fi șters pe<br/>
						<strong style="color: var(--text)">{new Date(stergereOk).toLocaleDateString('ro-RO')}</strong>
					</p>
					<p class="text-xs mt-3 px-2" style="color: var(--muted)">
						Poți anula cererea oricând din profil până la data programată.
					</p>
					<button onclick={() => stergereOpen = false}
						class="mt-5 px-6 py-2 rounded-xl text-sm font-semibold"
						style="background: var(--accent); color: white;">
						Înțeles
					</button>
				</div>
			{:else}
				<h2 class="text-base font-bold mb-1" style="color: #ef4444">⚠️ Șterge contul</h2>
				<p class="text-xs mb-4" style="color: var(--muted)">
					Contul tău va fi marcat pentru ștergere și șters definitiv în <strong>30 de zile</strong>.
					Te poți răzgândi oricând în acest interval. Documentele fiscale (facturi) vor fi păstrate
					10 ani, conform legii.
				</p>

				<label class="text-[11px] font-semibold uppercase tracking-wide" style="color: var(--muted)">
					Motiv (opțional)
				</label>
				<textarea bind:value={stergereMotiv} rows="3"
					placeholder="De ce dorești ștergerea? (ne ajută să ne îmbunătățim)"
					class="w-full mt-1.5 px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-4"
					style="background: var(--surface2); border: 1.5px solid var(--border); color: var(--text); font-family: inherit;">
				</textarea>

				<button onclick={trimiteCerereStergere} disabled={gdprBusy === 'stergere'}
					class="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all active:scale-[0.98] mb-2"
					style="background: #ef4444; color: white;">
					{gdprBusy === 'stergere' ? 'Se trimite...' : 'Confirmă cererea de ștergere'}
				</button>
				<button onclick={() => stergereOpen = false}
					class="w-full py-2.5 text-xs"
					style="color: var(--muted); background: none; border: none;">
					Anulează
				</button>
			{/if}
		</div>
	</div>
{/if}

<!-- ═════ Modal cerere rectificare ═════ -->
{#if rectificareOpen}
	<button class="fixed inset-0 z-[100]" style="background: rgba(0,0,0,0.7);"
		onclick={() => rectificareOpen = false} aria-label="Închide"></button>

	<div class="fixed bottom-0 left-0 right-0 z-[101] rounded-t-3xl"
		style="background: var(--surface); border-top: 1px solid var(--border); max-height: 85dvh; overflow-y: auto;">
		<div class="px-4 pt-3 pb-8 max-w-md mx-auto">
			<div class="w-10 h-1 rounded-full mx-auto mb-5" style="background: var(--border);"></div>

			{#if rectificareOk}
				<div class="text-center py-6">
					<p class="text-5xl mb-3">✅</p>
					<p class="text-base font-bold mb-1" style="color: var(--text)">Cerere trimisă</p>
					<p class="text-sm" style="color: var(--muted)">Te vom contacta în maxim 30 zile.</p>
				</div>
			{:else}
				<h2 class="text-base font-bold mb-1" style="color: var(--text)">✏️ Solicită corectare date</h2>
				<p class="text-xs mb-4" style="color: var(--muted)">
					Descrie ce informație trebuie corectată sau actualizată. Răspundem în max. 30 zile.
				</p>

				<textarea bind:value={rectificareText} rows="5"
					placeholder="Ex: Numele meu corect este... · Adresa s-a schimbat la..."
					class="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-4"
					style="background: var(--surface2); border: 1.5px solid var(--border); color: var(--text); font-family: inherit;">
				</textarea>

				<button onclick={trimiteRectificare}
					disabled={gdprBusy === 'rectificare' || rectificareText.trim().length < 5}
					class="w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-40 transition-all active:scale-[0.98] mb-2"
					style="background: var(--accent); color: white;">
					{gdprBusy === 'rectificare' ? 'Se trimite...' : 'Trimite cerere'}
				</button>
				<button onclick={() => rectificareOpen = false}
					class="w-full py-2.5 text-xs"
					style="color: var(--muted); background: none; border: none;">
					Anulează
				</button>
			{/if}
		</div>
	</div>
{/if}
