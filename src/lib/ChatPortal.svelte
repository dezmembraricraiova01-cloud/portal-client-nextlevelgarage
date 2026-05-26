<script lang="ts">
	import { onMount, onDestroy, tick, untrack } from 'svelte';
	import { getEcho, onStatusChange, type EchoStatus } from '$lib/echo';

	let {
		woUid,
		embedded   = false,
		visible    = $bindable(true),
		chatUnread = $bindable(0),
	}: {
		woUid:       string;
		embedded?:   boolean;
		visible?:    boolean;
		chatUnread?: number;
	} = $props();

	interface Mesaj {
		id:            number;
		expeditor_tip: 'client' | 'service';
		mesaj:         string;
		citit_la:      string | null;
		created_at:    string;
	}

	let mesaje      = $state<Mesaj[]>([]);
	let text        = $state('');
	let sending     = $state(false);
	let listEl      = $state<HTMLElement>();
	let wsStatus    = $state<EchoStatus>('connecting');
	let channel:    any;
	let cleanup:    () => void;
	let lastId      = 0;
	let pollTimer:  ReturnType<typeof setInterval>;

	onMount(async () => {
		// 1. Contorizează mesajele necitite ÎNAINTE de history (care le marchează citite)
		try {
			const r = await fetch(`/api/portal/reparatii/${woUid}/chat/necitite`);
			if (r.ok) chatUnread = (await r.json()).count ?? 0;
		} catch {}

		// 2. Încarcă istoricul (marchează mesajele service ca citite în BD)
		try {
			const res = await fetch(`/api/portal/reparatii/${woUid}/chat`);
			if (res.ok) {
				mesaje = await res.json();
				lastId = mesaje.at(-1)?.id ?? 0;
			}
		} catch {}

		if (visible) { await tick(); scrollJos(); }

		// 3. Polling fallback — preia mesaje noi la fiecare 4s (indiferent de WS)
		pollTimer = setInterval(async () => {
			try {
				const r = await fetch(`/api/portal/reparatii/${woUid}/chat?after=${lastId}`);
				if (!r.ok) return;
				const noi: Mesaj[] = await r.json();
				for (const m of noi) {
					if (!mesaje.find(x => x.id === m.id)) {
						mesaje = [...mesaje, m];
						lastId = Math.max(lastId, m.id);
						if (!visible && m.expeditor_tip === 'service') chatUnread += 1;
						else tick().then(scrollJos);
					}
				}
			} catch {}
		}, 4000);

		// 4. Abonare WebSocket — livrare instant când Reverb e conectat
		cleanup = onStatusChange(s => wsStatus = s);
		const echo = getEcho();

		channel = echo.private(`portal.chat.${woUid}`)
			.listen('.mesaj.nou', (data: Mesaj) => {
				if (!mesaje.find(m => m.id === data.id)) {
					mesaje = [...mesaje, data];
					lastId = Math.max(lastId, data.id);
					if (!visible && data.expeditor_tip === 'service') {
						chatUnread += 1;
					} else {
						tick().then(scrollJos);
					}
				}
			});
	});

	onDestroy(() => {
		clearInterval(pollTimer);
		channel?.unsubscribe?.();
		cleanup?.();
	});

	// Când panelul devine vizibil: golește badge + scroll + re-marchează ca citite.
	// untrack() previne ca citirea chatUnread să creeze o dependință reactivă.
	$effect(() => {
		if (visible) {
			const hadUnread = untrack(() => chatUnread > 0);
			chatUnread = 0;
			tick().then(scrollJos);
			if (hadUnread) {
				fetch(`/api/portal/reparatii/${woUid}/chat`)
					.then(r => r.ok ? r.json() : null)
					.then(data => { if (data) mesaje = data; })
					.catch(() => {});
			}
		}
	});

	async function trimite() {
		const t = text.trim();
		if (!t || sending) return;

		sending = true;
		text = '';
		try {
			const res = await fetch(`/api/portal/reparatii/${woUid}/chat`, {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body:    JSON.stringify({ mesaj: t }),
			});
			if (res.ok) {
				const mesaj: Mesaj = await res.json();
				mesaje = [...mesaje, mesaj];
				await tick();
				scrollJos();
			}
		} catch {}
		finally { sending = false; }
	}

	function scrollJos() {
		listEl?.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' });
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); trimite(); }
	}

	function formatOra(iso: string) {
		return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
	}

	function formatZi(iso: string) {
		const d = new Date(iso);
		const azi = new Date();
		if (d.toDateString() === azi.toDateString()) return 'Azi';
		const ieri = new Date(azi); ieri.setDate(ieri.getDate() - 1);
		if (d.toDateString() === ieri.toDateString()) return 'Ieri';
		return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
	}

	// Grupare mesaje pe zile
	const mesajeGrupate = $derived.by(() => {
		const grupe: { zi: string; mesaje: Mesaj[] }[] = [];
		for (const m of mesaje) {
			const zi = formatZi(m.created_at);
			const last = grupe.at(-1);
			if (last?.zi === zi) last.mesaje.push(m);
			else grupe.push({ zi, mesaje: [m] });
		}
		return grupe;
	});
</script>

<div class="flex flex-col overflow-hidden" style="height:100%; background: var(--surface);">

	<!-- Header — ascuns când e embedded (widget-ul extern are propriul header) -->
	{#if !embedded}
	<div class="flex items-center justify-between px-4 py-3 border-b shrink-0" style="border-color: var(--border);">
		<div class="flex items-center gap-2">
			<span class="text-sm font-semibold" style="color: var(--text)">Chat service</span>
			{#if wsStatus === 'connected'}
				<span class="w-2 h-2 rounded-full bg-green-500"></span>
			{:else if wsStatus === 'connecting'}
				<span class="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
			{:else}
				<span class="w-2 h-2 rounded-full bg-red-500"></span>
			{/if}
		</div>
	</div>
	{/if}

	{#if wsStatus === 'disconnected'}
	<div class="shrink-0 px-3 py-1.5 text-center text-[10px]" style="background:#ef444412; color:#ef4444">
		Offline — mesajele se trimit la reconectare
	</div>
	{/if}

	<!-- Lista mesaje -->
	<div bind:this={listEl} class="flex-1 overflow-y-auto px-4 py-3 space-y-1" style="scrollbar-width: thin;">

		{#if mesaje.length === 0}
			<div class="h-full flex items-center justify-center">
				<p class="text-xs text-center" style="color: var(--muted)">
					Scrie-ne orice întrebare despre reparație.<br>
					Echipa noastră îți răspunde în cel mai scurt timp.
				</p>
			</div>
		{:else}
			{#each mesajeGrupate as grupa}
				<!-- Separator zi -->
				<div class="flex items-center gap-2 py-2">
					<div class="flex-1 h-px" style="background: var(--border)"></div>
					<span class="text-[10px] px-2" style="color: var(--muted)">{grupa.zi}</span>
					<div class="flex-1 h-px" style="background: var(--border)"></div>
				</div>

				{#each grupa.mesaje as m}
					{@const eClient = m.expeditor_tip === 'client'}
					<div class="flex {eClient ? 'justify-end' : 'justify-start'} mb-1">
						<div class="max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug"
							style="
								background: {eClient ? 'var(--accent)' : 'var(--surface2)'};
								color: {eClient ? 'white' : 'var(--text)'};
								border-bottom-right-radius: {eClient ? '4px' : '16px'};
								border-bottom-left-radius: {eClient ? '16px' : '4px'};
							">
							{#if !eClient}
								<p class="text-[10px] font-semibold mb-0.5" style="color: var(--muted)">NLG Service</p>
							{/if}
							<p style="white-space: pre-wrap; word-break: break-word;">{m.mesaj}</p>
							<p class="text-[10px] mt-1 {eClient ? 'text-right' : 'text-left'}"
								style="opacity: 0.65; display:flex; align-items:center; gap:3px; {eClient ? 'justify-content:flex-end' : ''}">
								<span>{formatOra(m.created_at)}</span>
								{#if eClient}
									{#if m.citit_la}
										<span style="color: var(--accent); opacity:1" title="Citit de service">✓✓</span>
									{:else}
										<span title="Trimis">✓</span>
									{/if}
								{/if}
							</p>
						</div>
					</div>
				{/each}
			{/each}
		{/if}
	</div>

	<!-- Input -->
	<div class="flex items-end gap-2 px-3 py-3 border-t" style="border-color: var(--border);">
		<textarea
			bind:value={text}
			onkeydown={onKeydown}
			rows="1"
			placeholder="Scrie un mesaj..."
			style="
				flex: 1; padding: 8px 12px; border-radius: 16px; font-size: 13px;
				background: var(--surface2); border: 1px solid var(--border);
				color: var(--text); outline: none; resize: none;
				max-height: 96px; overflow-y: auto; line-height: 1.4;
				font-family: inherit;
			"
		></textarea>
		<button
			onclick={trimite}
			disabled={!text.trim() || sending || wsStatus === 'disconnected'}
			style="
				flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%;
				background: var(--accent); color: white; font-size: 16px;
				display: flex; align-items: center; justify-content: center;
				opacity: {!text.trim() || sending || wsStatus === 'disconnected' ? '0.4' : '1'};
				transition: opacity 0.15s;
			">
			{#if sending}
				<span style="font-size: 10px">...</span>
			{:else}
				↑
			{/if}
		</button>
	</div>

</div>
