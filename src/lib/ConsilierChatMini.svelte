<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { api, type MesajDirect } from '$lib/api';

	let { visible = $bindable(true) }: { visible?: boolean } = $props();

	let mesaje    = $state<MesajDirect[]>([]);
	let text      = $state('');
	let sending   = $state(false);
	let listEl    = $state<HTMLElement>();
	let lastId: number | null = null;
	let pollTimer: ReturnType<typeof setInterval>;

	function scrollJos() {
		listEl?.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' });
	}

	async function loadMesaje(after?: number) {
		try {
			const data = await api.mesajeDirecte(after);
			if (after == null) {
				mesaje = data.mesaje;
			} else if (data.mesaje.length > 0) {
				mesaje = [...mesaje, ...data.mesaje];
			}
			if (data.mesaje.length > 0) {
				lastId = data.mesaje[data.mesaje.length - 1].id;
			}
			await tick();
			if (visible) scrollJos();
		} catch { /* silent */ }
	}

	async function trimite() {
		const t = text.trim();
		if (!t || sending) return;
		sending = true;
		text = '';
		try {
			await api.trimiteDirecte(t);
			await loadMesaje(lastId ?? undefined);
		} catch { /* silent */ }
		finally { sending = false; }
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); trimite(); }
	}

	function formatOra(iso: string): string {
		return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
	}

	onMount(() => {
		loadMesaje();
		pollTimer = setInterval(() => loadMesaje(lastId ?? undefined), 5000);
	});

	onDestroy(() => clearInterval(pollTimer));

	$effect(() => {
		if (visible) tick().then(scrollJos);
	});
</script>

<div class="flex flex-col overflow-hidden" style="height:100%; background: var(--surface);">

	<!-- Lista mesaje -->
	<div bind:this={listEl} class="flex-1 overflow-y-auto px-4 py-3 space-y-1" style="scrollbar-width: thin;">
		{#if mesaje.length === 0}
			<div class="h-full flex items-center justify-center">
				<p class="text-xs text-center" style="color: var(--muted)">
					Niciun mesaj încă.<br>Scrie-i consilierului tău.
				</p>
			</div>
		{:else}
			{#each mesaje as m (m.id)}
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
							<p class="text-[10px] font-semibold mb-0.5" style="color: var(--muted)">{m.sender_name}</p>
						{/if}
						<p style="white-space: pre-wrap; word-break: break-word;">{m.mesaj}</p>
						<p class="text-[10px] mt-1 {eClient ? 'text-right' : 'text-left'}" style="opacity: 0.65;">
							{formatOra(m.created_at)}
						</p>
					</div>
				</div>
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
			disabled={!text.trim() || sending}
			style="
				flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%;
				background: var(--accent); color: white; font-size: 16px;
				display: flex; align-items: center; justify-content: center;
				opacity: {!text.trim() || sending ? '0.4' : '1'};
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
