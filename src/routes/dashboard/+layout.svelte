<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll, onNavigate, afterNavigate } from '$app/navigation';
	import { gsap } from 'gsap';
	import { page } from '$app/state';
	import { auth } from '$lib/stores';
	import { api } from '$lib/api';
	import { initSmooth, destroySmooth, bindReveal } from '$lib/smooth';
	import * as PullToRefresh from 'pulltorefreshjs';
	import 'shepherd.js/dist/css/shepherd.css';
	import ChatPortal from '$lib/ChatPortal.svelte';
	import ConsilierChatMini from '$lib/ConsilierChatMini.svelte';
	import GdprConsentModal from '$lib/GdprConsentModal.svelte';
	import { activeWoUid, activeWorkOrders, type ActiveWorkOrder } from '$lib/stores';

	let { children } = $props();
	let client    = $derived($auth);
	let isOffline = $state(false);
	let mainEl    = $state<HTMLElement | undefined>();

	// Toast alerte cont
	let showToast   = $state(false);
	let toastEl     = $state<HTMLElement | undefined>();

	// Badge bell = alerte cont + notificări portal necitite
	const alertCount = $derived(
		client
			? (client.are_restante ? 1 : 0)
				+ (client.ci_lipsa || client.permis_lipsa ? 1 : 0)
				+ (client.notificari_necitite ?? 0)
			: 0
	);

	// Acțiune GSAP pe elementul de toast
	function toastAction(node: HTMLElement) {
		toastEl = node;
		gsap.fromTo(node,
			{ y: 60, opacity: 0, scale: 0.97 },
			{ y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out' }
		);
	}

	async function dismissToast() {
		if (!toastEl) { showToast = false; return; }
		await new Promise<void>(r =>
			gsap.to(toastEl!, { y: 60, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: r })
		);
		showToast = false;
	}

	onNavigate(() => new Promise<void>((resolve) => {
		if (mainEl) gsap.to(mainEl, { opacity: 0, y: -6, duration: 0.13, ease: 'power2.in', onComplete: resolve });
		else resolve();
	}));

	afterNavigate(({ from }) => {
		if (!from || !mainEl) return;
		gsap.fromTo(mainEl, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', clearProps: 'opacity,transform' });
		bindReveal();
	});

	onMount(() => {
		initSmooth();
		return () => destroySmooth();
	});

	onMount(async () => {
		auth.restore();
		try {
			const me = await api.me();
			auth.login(me);
			isOffline = false;

			const areAlerte = me.are_restante || me.ci_lipsa || me.permis_lipsa;
			if (areAlerte && !sessionStorage.getItem('alerts-shown')) {
				sessionStorage.setItem('alerts-shown', '1');
				showToast = true;
				setTimeout(() => dismissToast(), 5000);
			}
		} catch (e: any) {
			if (!navigator.onLine || e instanceof TypeError) {
				isOffline = true;
			} else {
				auth.logout();
				goto('/login');
			}
		}
	});

	// Actualizează prezența consilierului și notificările la fiecare 60s
	onMount(() => {
		const poll = setInterval(async () => {
			try {
				const [consilierData, notifData] = await Promise.all([
					api.consilier(),
					api.notificari(),
				]);
				auth.patchConsilier(consilierData.consilier, consilierData.consilier_inlocuitor);
				auth.patchNotificari(notifData.necitite);
			} catch { /* offline sau sesiune expirată — ignorăm silențios */ }
		}, 60_000);
		return () => clearInterval(poll);
	});

	// Lista lucrărilor active — populată o dată la mount, folosită de chat-ul global
	const STATUSURI_INACTIVE = ['finalizat', 'livrat', 'predata', 'predată', 'anulat', 'arhivat'];
	async function refreshActiveWorkOrders() {
		try {
			const res = await api.reparatii();
			const active: ActiveWorkOrder[] = res.data
				.filter(wo => !STATUSURI_INACTIVE.includes((wo.status ?? '').toLowerCase()))
				.map(wo => ({
					uid:   wo.uid,
					plate: wo.masina?.numar_inmatriculare ?? '—',
					label: `${wo.masina?.numar_inmatriculare ?? '—'} · ${wo.masina?.marca ?? ''} ${wo.masina?.model ?? ''}`.trim(),
				}));
			activeWorkOrders.set(active);
			// Dacă nu avem un activeWoUid setat, alegem primul (compat cu dashboard)
			if (!$activeWoUid && active.length > 0) {
				activeWoUid.set(active[0].uid);
			}
		} catch { /* ignorăm */ }
	}
	onMount(refreshActiveWorkOrders);

	onMount(() => {
		PullToRefresh.init({
			mainElement: 'body',
			instructionsPullToRefresh: 'Trage pentru a actualiza',
			instructionsReleaseToRefresh: 'Eliberează pentru a actualiza',
			instructionsRefreshing: 'Se actualizează...',
			onRefresh() { return invalidateAll(); },
		});
		return () => PullToRefresh.destroyAll();
	});

	async function logout() {
		try { await api.logout(); } catch {}
		auth.logout();
		goto('/login');
	}

	const navItems = [
		{ href: '/dashboard',             label: 'Acasă',      icon: '⌂' },
		{ href: '/dashboard/masini',      label: 'Mașini',     icon: '🚗' },
		{ href: '/dashboard/reparatii',   label: 'Reparații',  icon: '🔧' },
		{ href: '/dashboard/trips',       label: 'Călătorii',  icon: '🗺️' },
		{ href: '/dashboard/remindere',   label: 'Alerte',     icon: '🔔', badge: true },
		{ href: '/dashboard/profil',      label: 'Profil',     icon: '👤' },
	];

	const currentPath = $derived(page.url.pathname);
	const isActive = (href: string) =>
		href === '/dashboard' ? currentPath === '/dashboard' : currentPath.startsWith(href);

	let chatOpen    = $state(false);
	let chatUnread  = $state(0);
	let chatChoice  = $state<'lucrare' | 'consilier' | null>(null);
	let woUid       = $derived($activeWoUid);
	let workOrders  = $derived($activeWorkOrders);
	let activeWO    = $derived(workOrders.find(w => w.uid === woUid) ?? null);

	// Realocare consilier
	const MOTIVE = [
		'Nu mă contactează',
		'Lipsă răspuns la mesaje',
		'Comunicare dificilă',
		'Prefer alt consilier',
		'Altul',
	];
	let realocareOpen    = $state(false);
	let motivSelectat    = $state('');
	let motivCustom      = $state('');
	let realocareLoading = $state(false);
	let realocareOk      = $state(false);
	let realocareEroare  = $state('');

	function sheetRealocareAction(node: HTMLElement) {
		gsap.fromTo(node, { y: '100%' }, { y: 0, duration: 0.35, ease: 'power3.out' });
	}

	async function trimiteRealocare() {
		realocareLoading = true; realocareEroare = '';
		const motiv = motivSelectat === 'Altul' ? motivCustom.trim() : motivSelectat;
		try {
			await api.cerereRealocare(motiv || undefined);
			realocareOk = true;
			setTimeout(() => { realocareOpen = false; realocareOk = false; motivSelectat = ''; motivCustom = ''; }, 2400);
		} catch (e: any) {
			realocareEroare = e.message ?? 'Eroare. Încearcă din nou.';
		} finally {
			realocareLoading = false;
		}
	}

	function chatPopupAction(node: HTMLElement) {
		gsap.fromTo(node,
			{ opacity: 0, y: 16, scale: 0.95 },
			{ opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'back.out(1.6)' }
		);
	}

	async function closeChat() {
		const el = document.getElementById('chat-popup');
		if (el) await new Promise<void>(r => gsap.to(el, { opacity: 0, y: 12, scale: 0.95, duration: 0.18, ease: 'power2.in', onComplete: r }));
		chatOpen   = false;
		chatChoice = null;
	}
</script>

<div class="min-h-screen flex flex-col" style="background: transparent">
	<!-- Header -->
	<header class="sticky top-0 z-50 flex items-center justify-between px-5 h-14 border-b"
		style="background: var(--surface); border-color: var(--border);">
		<span class="font-bold text-base tracking-tight" style="color: var(--text)">NLG Portal</span>
		{#if client}
			<div class="flex items-stretch gap-2 h-10">
				{#if client.vip}
					<span class="flex flex-col items-center justify-center px-2.5 rounded-lg text-[10px] font-bold leading-tight shrink-0"
						style="background: linear-gradient(90deg,#854d0e30,#ca8a0430); color: #ca8a04; border: 1px solid #ca8a0440;">
						<span class="text-sm leading-none">⭐</span>
						<span class="mt-0.5">VIP</span>
					</span>
				{/if}

				<a href="/dashboard/profil"
					class="flex flex-col items-end justify-center leading-tight px-3 rounded-lg transition-all active:scale-[0.97] hover:bg-white/5"
					style="text-decoration: none; border: 1px solid var(--border);">
					<span class="text-sm font-semibold whitespace-nowrap" style="color: var(--text)">{client.nume}</span>
					<span class="inline-flex items-center gap-1 text-[10px] mt-0.5 font-medium" style="color: var(--accent)">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
							stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<circle cx="12" cy="8" r="4"/>
							<path d="M4 21a8 8 0 0 1 16 0"/>
						</svg>
						Profilul meu
					</span>
				</a>

				<button onclick={logout}
					class="flex flex-col items-center justify-center px-3 rounded-lg text-[10px] font-bold leading-tight transition-opacity active:opacity-70 shrink-0"
					style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
						stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
						<polyline points="16 17 21 12 16 7"/>
						<line x1="21" y1="12" x2="9" y2="12"/>
					</svg>
					<span class="mt-0.5">Ieși</span>
				</button>
			</div>
		{/if}
	</header>

	<!-- Banner offline -->
	{#if isOffline}
		<div class="px-4 py-2.5 text-center text-xs font-medium"
			style="background: #eab30820; color: #eab308; border-bottom: 1px solid #eab30840;">
			📡 Ești offline — datele afișate pot fi învechite
		</div>
	{/if}

	<!-- Toast alerte cont — slide-in GSAP din jos, 5 secunde, o dată per sesiune -->
	{#if showToast && client}
		<div use:toastAction
			class="fixed bottom-20 left-3 right-3 z-50 rounded-2xl shadow-2xl overflow-hidden"
			style="border: 1px solid #ffffff12; background: #111;">

			<!-- Bară progres auto-dismiss -->
			<div class="h-0.5 w-full" style="background: #ffffff10;">
				<div class="h-full" style="background: var(--accent); animation: toast-progress 5s linear forwards;"></div>
			</div>

			<div class="px-4 py-3 space-y-2">
				{#if client.are_restante}
					<div class="flex items-center gap-3">
						<span class="text-base shrink-0">⚠️</span>
						<p class="text-xs flex-1" style="color: #ef4444">Ai lucrări <strong>neachitate</strong> — contactează service-ul.</p>
					</div>
				{/if}
				{#if client.ci_lipsa || client.permis_lipsa}
					<div class="flex items-center gap-3">
						<span class="text-base shrink-0">📋</span>
						<p class="text-xs flex-1" style="color: #eab308">
							Dosar incomplet:
							{#if client.ci_lipsa}CI lipsă{/if}{#if client.ci_lipsa && client.permis_lipsa} · {/if}{#if client.permis_lipsa}Permis lipsă{/if}
						</p>
					</div>
				{/if}
				<div class="flex items-center justify-between pt-1">
					<a href="/dashboard/remindere" onclick={dismissToast}
						class="text-xs font-semibold px-3 py-1.5 rounded-lg"
						style="background: var(--accent); color: white;">
						Vezi alertele ({alertCount}) →
					</a>
					<button onclick={dismissToast} class="text-xs px-3 py-1.5 rounded-lg"
						style="color: var(--muted); background: var(--surface2);">
						Închide
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Content -->
	<main bind:this={mainEl} class="flex-1 px-4 py-4 max-w-[940px] w-full mx-auto pb-24">
		{@render children()}
	</main>

	<!-- FAB Chat -->
	<button
		onclick={() => chatOpen = !chatOpen}
		class="fixed bottom-[72px] right-4 z-50 rounded-full flex items-center justify-center transition-all active:scale-90"
		style="background: var(--accent); color: white; width: 52px; height: 52px; box-shadow: 0 4px 20px rgba(59,130,246,0.45); border: none; transform-origin: center;">

		<!-- Badge mesaje necitite -->
		{#if chatUnread > 0 && !chatOpen}
			<span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
				style="background: #ef4444; color: white; line-height: 1;">
				{chatUnread}
			</span>
		{/if}

		<!-- Iconița se transformă în X când e deschis -->
		{#if chatOpen}
			<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
				<path d="M2 2L16 16M16 2L2 16" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
			</svg>
		{:else}
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
				<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/>
			</svg>
		{/if}
	</button>

	<!-- Popup chat deasupra FAB -->
	{#if chatOpen}
		<!-- Click outside -->
		<button class="fixed inset-0 z-[45]" onclick={closeChat} aria-label="Închide" style="background: transparent;"></button>

		<div id="chat-popup" use:chatPopupAction
			class="fixed z-[50] flex flex-col overflow-hidden rounded-2xl shadow-2xl"
			style="
				bottom: 134px; right: 16px;
				width: min(360px, calc(100vw - 32px));
				height: min(480px, calc(100dvh - 160px));
				background: var(--surface);
				border: 1px solid var(--border);
				box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
			">

			<!-- Header — principal + locțiitor (afișat doar când principalul e indisponibil) -->
			<div class="px-4 py-3 shrink-0 border-b" style="border-color: var(--border); background: var(--surface2);">
				{#if client?.consilier}
					{@const main      = client.consilier}
					{@const sub       = client.consilier_inlocuitor}
					{@const subSt0    = sub?.status?.status ?? 'offline'}
					{@const subOk     = !!sub && subSt0 !== 'offline'}
					{@const showSub   = !!main.arata_inlocuitor && subOk}
					{@const mainSt    = showSub ? 'offline' : (main.status?.status ?? 'offline')}
					{@const mainColor = mainSt === 'online' ? '#22c55e' : mainSt === 'away' ? '#f59e0b' : '#ef4444'}
					{@const mainLabel = showSub
						? (main.status?.motiv ?? main.status?.label ?? 'Indisponibil')
						: (main.status?.label ?? 'Offline')}

					<!-- Bara superioară: înapoi + badge mod chat + close -->
					<div class="flex items-center justify-between gap-2 mb-2">
						<div class="flex items-center gap-1.5 min-w-0">
							{#if chatChoice !== null && woUid}
								<button onclick={() => chatChoice = null}
									class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-opacity active:opacity-60"
									style="background: var(--surface); color: var(--muted); font-size: 14px; border: 1px solid var(--border);"
									title="Înapoi la opțiuni">
									←
								</button>
							{/if}
							{#if chatChoice === 'lucrare'}
								{@const suffix = woUid ? woUid.split('-').pop() : ''}
								<span class="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap"
									style="background: var(--accent); color: white;">
									🔧 {activeWO?.plate ?? 'Lucrare'}{suffix ? ` · ${suffix}` : ''}
								</span>
							{:else if chatChoice === 'consilier'}
								<span class="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap"
									style="background: var(--accent); color: white;">
									💬 Consilier
								</span>
							{/if}
						</div>
						<button onclick={closeChat}
							class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
							style="background: var(--surface); color: var(--muted); font-size: 16px;">×</button>
					</div>

					<!-- Consilier principal -->
					<p class="text-[9px] uppercase font-semibold tracking-widest mb-1.5" style="color: var(--muted)">
						Consilierul dumneavoastră alocat este
					</p>
					<div class="flex items-center gap-3">
						<div class="relative shrink-0">
							<div class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
								style="background: var(--accent); color: white;">
								{#if main.avatar}<img src={main.avatar} alt={main.name} class="w-full h-full object-cover"/>{:else}{main.initials}{/if}
							</div>
							<span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
								style="background: {mainColor}; border-color: var(--surface2);"></span>
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-semibold truncate" style="color: var(--text)">{main.name}</p>
							<p class="text-[11px] truncate" style="color: {mainColor}">● {mainLabel}</p>
						</div>
						{#if main.telefon && !showSub}
							<a href="tel:{main.telefon}" onclick={closeChat}
								class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-opacity active:opacity-70"
								style="background: #22c55e18; color: #22c55e; text-decoration: none;">📞</a>
						{/if}
					</div>

					<!-- Locțiitor — vizibil doar când principalul e indisponibil -->
					{#if showSub}
						{@const subSt    = sub!.status?.status ?? 'offline'}
						{@const subColor = subSt === 'online' ? '#22c55e' : subSt === 'away' ? '#f59e0b' : '#ef4444'}
						{@const subLabel = sub!.status?.label ?? 'Offline'}
						<div class="mt-2 pt-2 border-t" style="border-color: var(--border);">
							<p class="text-[9px] uppercase font-semibold tracking-widest mb-1.5" style="color: var(--muted)">↪ Te ajută acum</p>
							<div class="flex items-center gap-3">
								<div class="relative shrink-0">
									<div class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold"
										style="background: var(--accent); color: white;">
										{#if sub!.avatar}<img src={sub!.avatar} alt={sub!.name} class="w-full h-full object-cover"/>{:else}{sub!.initials}{/if}
									</div>
									<span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
										style="background: {subColor}; border-color: var(--surface2);"></span>
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold truncate" style="color: var(--text)">{sub!.name}</p>
									<p class="text-[11px] truncate" style="color: {subColor}">● {subLabel}</p>
								</div>
								{#if sub!.telefon}
									<a href="tel:{sub!.telefon}" onclick={closeChat}
										class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-opacity active:opacity-70"
										style="background: #22c55e18; color: #22c55e; text-decoration: none;">📞</a>
								{/if}
							</div>
						</div>
					{/if}
				{:else}
					<div class="flex items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							<div class="w-9 h-9 rounded-full flex items-center justify-center text-base" style="background: var(--surface);">💬</div>
							<p class="text-sm font-semibold" style="color: var(--text)">Chat service</p>
						</div>
						<button onclick={closeChat}
							class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
							style="background: var(--surface); color: var(--muted); font-size: 16px;">×</button>
					</div>
				{/if}
			</div>

			<!-- Corp chat -->
			<div class="flex-1 overflow-hidden">
				{#if woUid && chatChoice === null}
					<!-- Ecran alegere: discută despre lucrare sau alte întrebări -->
					<div class="h-full flex flex-col justify-center gap-3 px-5 py-4 overflow-y-auto">
						<p class="text-sm font-semibold text-center mb-1" style="color: var(--text)">
							Despre ce vrei să vorbești?
						</p>
						<p class="text-xs text-center mb-3" style="color: var(--muted)">
							{workOrders.length > 1 ? 'Ai mai multe lucrări în service.' : 'Mașina ta este în service.'}
						</p>

						{#if workOrders.length > 1}
							<!-- Mai multe lucrări — listă; user alege explicit -->
							<p class="text-[10px] uppercase font-semibold tracking-widest" style="color: var(--muted)">🔧 Alege lucrarea</p>
							{#each workOrders as wo}
								{@const woSuffix = wo.uid.split('-').pop()}
								<button onclick={() => { activeWoUid.set(wo.uid); chatChoice = 'lucrare'; }}
									class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
									style="background: {wo.uid === woUid ? 'var(--accent)' : 'var(--surface2)'}; color: {wo.uid === woUid ? 'white' : 'var(--text)'}; border: 1px solid {wo.uid === woUid ? 'var(--accent)' : 'var(--border)'};">
									<span class="text-base">🚗</span>
									<div class="flex-1 text-left min-w-0">
										<p class="font-semibold truncate">{wo.plate}</p>
										<p class="text-[10px] truncate" style="opacity: 0.7;">WO · {woSuffix}</p>
									</div>
									<span>›</span>
								</button>
							{/each}
						{:else}
							<!-- O singură lucrare — buton direct cu plăcuța -->
							{@const wo = workOrders[0] ?? activeWO}
							<button onclick={() => chatChoice = 'lucrare'}
								class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
								style="background: var(--accent); color: white; border: none;">
								<span class="text-lg">🔧</span>
								<div class="flex-1 text-left min-w-0">
									<p class="font-semibold truncate">Lucrarea în curs{wo?.plate ? ` — ${wo.plate}` : ''}</p>
									<p class="text-[11px] opacity-80">Întrebări despre reparația mașinii</p>
								</div>
								<span>›</span>
							</button>
						{/if}
						<button onclick={() => chatChoice = 'consilier'}
							class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
							style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);">
							<span class="text-lg">💬</span>
							<div class="flex-1 text-left">
								<p class="font-semibold">Alte întrebări</p>
								<p class="text-[11px]" style="color: var(--muted)">Vorbește direct cu consilierul</p>
							</div>
							<span style="color: var(--muted)">›</span>
						</button>
					</div>
				{:else if chatChoice === 'consilier'}
					<ConsilierChatMini visible={chatOpen} />
				{:else if woUid}
					<ChatPortal {woUid} embedded={true} visible={chatOpen} bind:chatUnread />
				{:else}
					<div class="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
						<span class="text-4xl">🔧</span>
						<p class="text-sm font-semibold" style="color: var(--text)">Nicio reparație activă</p>
						<p class="text-xs" style="color: var(--muted)">Chatul devine disponibil când mașina ta intră în service.</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Modal realocare consilier -->
	{#if realocareOpen}
		<button class="fixed inset-0 z-[65]" style="background: rgba(0,0,0,0.6);"
			onclick={() => { realocareOpen = false; realocareEroare = ''; }}
			aria-label="Închide"></button>

		<div use:sheetRealocareAction
			class="fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl"
			style="background: var(--surface); border-top: 1px solid var(--border); max-height: 80dvh; overflow-y: auto;">
			<div class="px-4 pt-3 pb-8">
				<div class="w-10 h-1 rounded-full mx-auto mb-5" style="background: var(--border);"></div>

				{#if realocareOk}
					<div class="text-center py-8">
						<p class="text-5xl mb-4">✅</p>
						<p class="text-base font-bold mb-2" style="color: var(--text)">Cerere trimisă!</p>
						<p class="text-sm" style="color: var(--muted)">
							Echipa noastră va analiza și te va contacta în curând.
						</p>
					</div>
				{:else}
					<div class="flex items-center justify-between mb-5">
						<div>
							<h2 class="text-base font-bold" style="color: var(--text)">Schimbă consilierul</h2>
							{#if client?.consilier}
								<p class="text-xs mt-0.5" style="color: var(--muted)">
									Consilier actual: <strong style="color: var(--text)">{client.consilier.name}</strong>
								</p>
							{/if}
						</div>
						<button onclick={() => { realocareOpen = false; realocareEroare = ''; }}
							class="w-8 h-8 rounded-full flex items-center justify-center text-lg"
							style="background: var(--surface2); color: var(--muted);">×</button>
					</div>

					<!-- Chips motiv -->
					<p class="text-xs font-semibold uppercase tracking-wide mb-3" style="color: var(--muted)">
						Selectează motivul
					</p>
					<div class="flex flex-wrap gap-2 mb-4">
						{#each MOTIVE as m}
							<button
								onclick={() => motivSelectat = m}
								class="px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95"
								style="
									background: {motivSelectat === m ? 'var(--accent)' : 'var(--surface2)'};
									color: {motivSelectat === m ? 'white' : 'var(--muted)'};
									border: 1.5px solid {motivSelectat === m ? 'var(--accent)' : 'var(--border)'};
								">
								{m}
							</button>
						{/each}
					</div>

					{#if motivSelectat === 'Altul'}
						<textarea bind:value={motivCustom} rows="3"
							placeholder="Descrie motivul..."
							class="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-4"
							style="background: var(--surface2); border: 1.5px solid var(--border); color: var(--text); font-family: inherit;">
						</textarea>
					{/if}

					{#if realocareEroare}
						<p class="text-xs mb-3" style="color: #ef4444">{realocareEroare}</p>
					{/if}

					<button
						onclick={trimiteRealocare}
						disabled={!motivSelectat || realocareLoading || (motivSelectat === 'Altul' && !motivCustom.trim())}
						class="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
						style="background: var(--accent); color: white;">
						{realocareLoading ? 'Se trimite...' : '🔄 Trimite cererea'}
					</button>
					<p class="text-[11px] text-center mt-3" style="color: var(--muted)">
						Vei păstra consilierul actual până la procesarea cererii.
					</p>
				{/if}
			</div>
		</div>
	{/if}

	<!-- GDPR consent modal (blocant la primul login / la schimbarea politicii) -->
	<GdprConsentModal />

	<!-- Bottom Nav -->
	<nav data-tour="nav" class="fixed bottom-0 left-0 right-0 z-50 border-t flex"
		style="background: var(--surface); border-color: var(--border);">
		{#each navItems as item}
			<a href={item.href}
				class="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors"
				style="color: {isActive(item.href) ? 'var(--accent)' : 'var(--muted)'}">
				<span class="relative text-lg leading-none">
					{item.icon}
					{#if item.badge && alertCount > 0}
						<span class="absolute -top-1 -right-2 min-w-[16px] h-4 px-0.5 rounded-full text-[9px] font-bold flex items-center justify-center"
							style="background: #ef4444; color: white; line-height: 1;">
							{alertCount}
						</span>
					{/if}
				</span>
				<span class="text-[10px] truncate max-w-full text-center px-0.5">{item.label}</span>
			</a>
		{/each}
	</nav>
</div>

<style>
	@keyframes toast-progress {
		from { width: 100%; }
		to   { width: 0%; }
	}
</style>
