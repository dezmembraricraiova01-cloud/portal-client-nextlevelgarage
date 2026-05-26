<script lang="ts">
	import { gsap } from 'gsap';
	import { onMount, tick } from 'svelte';
	import { auth } from '$lib/stores';
	import { api, type MesajDirect } from '$lib/api';
	import { bindReveal } from '$lib/smooth';

	let client = $derived($auth);

	const consilier      = $derived(client?.consilier ?? null);
	const inlocuitor     = $derived(client?.consilier_inlocuitor ?? null);
	const aratInlocuitor = $derived(!!consilier?.arata_inlocuitor && !!inlocuitor);
	const activ          = $derived(aratInlocuitor ? inlocuitor! : consilier);
	const fara           = $derived(!consilier);

	// Prezență detaliată — sursa de adevăr e status.status (3 stări)
	const activStatus  = $derived(activ?.status?.status ?? 'offline');
	const activLabel   = $derived(activ?.status?.label  ?? 'Indisponibil momentan');
	const statusColor  = $derived(activStatus === 'online' ? '#22c55e' : activStatus === 'away' ? '#f59e0b' : '#ef4444');
	const laServici    = $derived(activ?.status?.motiv == null);
	const lastSeenFmt  = $derived((() => {
		const ls = activ?.status?.last_seen;
		if (!ls) return null;
		const d    = new Date(ls);
		const mins = Math.round((Date.now() - d.getTime()) / 60000);
		if (mins < 60) return `acum ${mins} min`;
		return `azi la ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
	})());

	// Acordeon — o singură secțiune deschisă deodată; null = toate închise
	let openSection = $state<'reparatii' | 'mesaje' | 'realocare' | null>(null);
	function toggle(s: typeof openSection) { openSection = openSection === s ? null : s; }

	let motivText       = $state('');
	let trimitere       = $state(false);
	let trimitereOk     = $state(false);
	let trimitereEroare = $state('');

	// Direct chat
	let mesaje      = $state<MesajDirect[]>([]);
	let chatInput   = $state('');
	let sending     = $state(false);
	let chatEl      = $state<HTMLDivElement | null>(null);
	let lastId      = $state<number | null>(null);

	function sheetAction(node: HTMLElement) {
		gsap.fromTo(node, { y: '100%' }, { y: 0, duration: 0.35, ease: 'power3.out' });
	}

	async function scrollChat() {
		await tick();
		if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
	}

	async function loadMesaje(after?: number) {
		try {
			const data = await api.mesajeDirecte(after);
			if (after == null) {
				mesaje = data.mesaje;
				await scrollChat();
			} else if (data.mesaje.length > 0) {
				mesaje = [...mesaje, ...data.mesaje];
				await scrollChat();
			}
			if (data.mesaje.length > 0) {
				lastId = data.mesaje[data.mesaje.length - 1].id;
			}
		} catch { /* silent */ }
	}

	async function sendMesaj() {
		const text = chatInput.trim();
		if (!text || sending) return;
		sending = true;
		chatInput = '';
		try {
			await api.trimiteDirecte(text);
			await loadMesaje();
		} catch { /* silent */ } finally {
			sending = false;
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMesaj(); }
	}

	function timeFmt(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
	}

	let pollTimer: ReturnType<typeof setInterval>;

	onMount(() => {
		tick().then(() => {
			gsap.from('.chat-header-card', { y: -12, opacity: 0, duration: 0.35, ease: 'power3.out' });
			bindReveal();
		});

		if (!fara) {
			loadMesaje();
			pollTimer = setInterval(() => { loadMesaje(lastId ?? undefined); }, 5000);
		}

		return () => clearInterval(pollTimer);
	});

	async function trimiteRealocare() {
		trimitere = true; trimitereEroare = '';
		try {
			await api.cerereRealocare(motivText.trim() || undefined);
			trimitereOk = true;
			motivText   = '';
			setTimeout(() => { openSection = null; trimitereOk = false; }, 2200);
		} catch (e: any) {
			trimitereEroare = e.message ?? 'Eroare. Încearcă din nou.';
		} finally {
			trimitere = false;
		}
	}

	function telefonFmt(t: string | null): string {
		if (!t) return '';
		return t.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
	}
</script>

<!-- ══════════════════════════════════════════════════════════
     HEADER CHAT — stilizat ca o conversație deschisă
     ══════════════════════════════════════════════════════════ -->

{#if fara}
	<!-- Niciun consilier -->
	<div class="flex flex-col items-center justify-center py-20 gap-3">
		<div class="w-20 h-20 rounded-full flex items-center justify-center text-3xl"
			style="background: var(--surface2);">👤</div>
		<p class="text-base font-semibold" style="color: var(--text)">Niciun consilier alocat</p>
		<p class="text-xs text-center px-6" style="color: var(--muted)">
			Vom aloca în curând un consilier dedicat pentru tine.
		</p>
	</div>

{:else if activ}
	<!-- Banner inlocuitor -->
	{#if aratInlocuitor}
		<div class="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-3 text-xs font-medium"
			style="background: #f59e0b18; color: #b45309; border: 1px solid #f59e0b30;">
			ℹ️ Consilierul tău <strong>{consilier?.name}</strong> e momentan indisponibil. Te poate ajuta:
		</div>
	{/if}

	<!-- Header conversație -->
	<div class="chat-header-card rounded-2xl overflow-hidden mb-4"
		style="background: var(--surface); border: 1px solid var(--border);">



		<!-- Profil header (stil chat) -->
		<div class="flex items-center gap-3 px-4 py-4">
			<!-- Avatar -->
			<div class="relative shrink-0">
				<div class="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold"
					style="background: var(--accent); color: white;">
					{#if activ.avatar}
						<img src={activ.avatar} alt={activ.name} class="w-full h-full object-cover" />
					{:else}
						{activ.initials}
					{/if}
				</div>
				<!-- Status dot — 3 stări: verde/galben/roșu -->
				<span class="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2"
					style="background: {statusColor}; border-color: var(--surface);">
				</span>
			</div>

			<!-- Nume + functie + status -->
			<div class="flex-1 min-w-0">
				<p class="text-base font-bold leading-tight" style="color: var(--text)">{activ.name}</p>
				{#if activ.functie}
					<p class="text-xs mt-0.5" style="color: var(--muted)">{activ.functie}</p>
				{/if}
				<p class="text-xs mt-1 font-medium" style="color: {statusColor}">
					● {activLabel}
				</p>
				<div class="flex flex-wrap gap-1.5 mt-2">
					<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
						style="background: {statusColor}18; color: {statusColor}">
						{activStatus === 'online' ? 'Online acum' : activStatus === 'away' ? 'Away' : 'Offline'}
					</span>
					<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
						style="background: {laServici ? '#22c55e18' : '#64748b14'}; color: {laServici ? '#16a34a' : '#94a3b8'}">
						{laServici ? '🏢 La serviciu' : '🏠 Nu este la serviciu'}
					</span>
					{#if lastSeenFmt}
					<span class="text-[10px] font-medium px-2 py-0.5 rounded-full"
						style="background: #64748b12; color: #94a3b8">
						Văzut {lastSeenFmt}
					</span>
					{/if}
				</div>
			</div>

			<!-- Buton apel -->
			{#if activ.telefon}
				<a href="tel:{activ.telefon}"
					class="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-lg transition-opacity active:opacity-70"
					style="background: #22c55e18; color: #22c55e; text-decoration: none;">
					📞
				</a>
			{/if}
		</div>

		<!-- Telefon formatat dacă există -->
		{#if activ.telefon}
			<div class="px-4 pb-3 -mt-1">
				<span class="text-xs" style="color: var(--muted)">{telefonFmt(activ.telefon)}</span>
			</div>
		{/if}
	</div>

	<!-- ═════ 3 mini-carduri trigger ═════ -->
	{@const sections = [
		{ key: 'reparatii' as const, icon: '🔧', label: 'Reparații',  hint: 'Chat per lucrare' },
		{ key: 'mesaje'    as const, icon: '✉️', label: 'Mesaj',      hint: 'Către consilier'  },
		{ key: 'realocare' as const, icon: '🔄', label: 'Realocare',  hint: 'Schimbă consilier'},
	]}
	<div class="grid grid-cols-3 gap-2 mb-4">
		{#each sections as s}
			{@const isOpen = openSection === s.key}
			<button onclick={() => toggle(s.key)}
				class="flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl transition-all active:scale-[0.96]"
				style="
					background: {isOpen ? 'var(--accent)' : 'var(--surface)'};
					color: {isOpen ? 'white' : 'var(--text)'};
					border: 1.5px solid {isOpen ? 'var(--accent)' : 'var(--border)'};
					box-shadow: {isOpen ? '0 6px 18px rgba(59,130,246,0.30)' : 'none'};
				">
				<span class="text-xl leading-none">{s.icon}</span>
				<span class="text-[11px] font-bold leading-tight">{s.label}</span>
				<span class="text-[9px] leading-tight" style="opacity: {isOpen ? 0.85 : 0.55}">{s.hint}</span>
			</button>
		{/each}
	</div>

	<!-- ═════ Secțiune: Reparații ═════ -->
	{#if openSection === 'reparatii'}
		<div class="rounded-2xl overflow-hidden mb-4"
			style="background: var(--surface); border: 1px solid var(--border);">
			<div class="px-4 py-2.5 border-b"
				style="border-color: var(--border); background: var(--surface2);">
				<p class="text-[10px] font-bold uppercase tracking-widest" style="color: var(--muted)">
					💬 Mesaje reparații
				</p>
			</div>
			<a href="/dashboard/reparatii"
				class="flex items-center gap-3 px-4 py-4 transition-opacity active:opacity-70"
				style="text-decoration: none;">
				<span class="text-xl">🔧</span>
				<div class="flex-1">
					<p class="text-sm font-medium" style="color: var(--text)">Vezi reparațiile tale</p>
					<p class="text-xs" style="color: var(--muted)">Fiecare reparație are chat dedicat</p>
				</div>
				<span style="color: var(--muted)">›</span>
			</a>
		</div>
	{/if}

	<!-- ═════ Secțiune: Mesaj direct consilier ═════ -->
	{#if openSection === 'mesaje'}
		<div class="rounded-2xl overflow-hidden mb-4"
			style="background: var(--surface); border: 1px solid var(--border);">
			<div class="px-4 py-2.5 border-b flex items-center justify-between"
				style="border-color: var(--border); background: var(--surface2);">
				<p class="text-[10px] font-bold uppercase tracking-widest" style="color: var(--muted)">
					✉️ Mesaj direct consilier
				</p>
			</div>

			<!-- Bule mesaje -->
			<div bind:this={chatEl}
				class="flex flex-col gap-2 px-4 py-3 overflow-y-auto"
				style="max-height: 280px; min-height: 80px;">
				{#if mesaje.length === 0}
					<p class="text-xs text-center py-4" style="color: var(--muted)">
						Niciun mesaj încă. Scrie-i consilierului tău.
					</p>
				{:else}
					{#each mesaje as m (m.id)}
						<div class="flex flex-col gap-0.5 {m.expeditor_tip === 'client' ? 'items-end' : 'items-start'}">
							<div class="max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug
								{m.expeditor_tip === 'client' ? 'rounded-br-sm' : 'rounded-bl-sm'}"
								style="{m.expeditor_tip === 'client'
									? 'background: var(--accent); color: white;'
									: 'background: var(--surface2); color: var(--text);'}">
								{m.mesaj}
							</div>
							<span class="text-[10px] px-1" style="color: var(--muted)">
								{m.expeditor_tip === 'service' ? m.sender_name + ' · ' : ''}{timeFmt(m.created_at)}
							</span>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Input trimitere -->
			<div class="px-3 pb-3 pt-1 border-t flex gap-2 items-end"
				style="border-color: var(--border);">
				<textarea bind:value={chatInput} onkeydown={handleKey}
					rows="1" placeholder="Scrie un mesaj..."
					class="flex-1 px-3 py-2 rounded-xl text-sm outline-none resize-none"
					style="background: var(--surface2); border: 1px solid var(--border); color: var(--text); max-height: 96px;">
				</textarea>
				<button onclick={sendMesaj} disabled={sending || !chatInput.trim()}
					class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg disabled:opacity-30 transition-opacity active:opacity-70"
					style="background: var(--accent); color: white;">
					➤
				</button>
			</div>
		</div>
	{/if}

	<!-- ═════ Secțiune: Realocare ═════ -->
	{#if openSection === 'realocare'}
		<div class="rounded-2xl overflow-hidden mb-4"
			style="background: var(--surface); border: 1px solid var(--border);">
			<div class="px-4 py-2.5 border-b"
				style="border-color: var(--border); background: var(--surface2);">
				<p class="text-[10px] font-bold uppercase tracking-widest" style="color: var(--muted)">
					🔄 Realocare consilier
				</p>
			</div>

			<div class="px-4 py-4">
				{#if trimitereOk}
					<div class="text-center py-4">
						<p class="text-4xl mb-2">✅</p>
						<p class="text-sm font-bold mb-1" style="color: var(--text)">Cerere trimisă!</p>
						<p class="text-xs" style="color: var(--muted)">Echipa noastră va analiza și te va contacta în curând.</p>
					</div>
				{:else}
					<p class="text-xs mb-3" style="color: var(--muted)">
						Consilier actual: <strong style="color: var(--text)">{consilier?.name}</strong>.
						Lasă un mesaj opțional și vom procesa cererea în 24h.
					</p>
					<textarea bind:value={motivText} rows="3"
						placeholder="Ex: Prefer o comunicare mai frecventă..."
						class="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-3"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);">
					</textarea>

					{#if trimitereEroare}
						<p class="text-xs mb-2" style="color: #ef4444">{trimitereEroare}</p>
					{/if}

					<button onclick={trimiteRealocare} disabled={trimitere}
						class="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
						style="background: var(--accent); color: white;">
						{trimitere ? 'Se trimite...' : 'Trimite cererea'}
					</button>
					<p class="text-[10px] text-center mt-2" style="color: var(--muted)">
						Vei păstra consilierul actual până la procesarea cererii.
					</p>
				{/if}
			</div>
		</div>
	{/if}
{/if}

