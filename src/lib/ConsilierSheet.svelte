<script lang="ts">
	import { gsap } from 'gsap';
	import { auth } from '$lib/stores';
	import { api } from '$lib/api';

	let { onClose }: { onClose?: () => void } = $props();

	let client = $derived($auth);

	const consilier      = $derived(client?.consilier ?? null);
	const inlocuitor     = $derived(client?.consilier_inlocuitor ?? null);
	const aratInlocuitor = $derived(!!consilier?.arata_inlocuitor && !!inlocuitor);
	const activ          = $derived(aratInlocuitor ? inlocuitor! : consilier);
	const fara           = $derived(!consilier);
	const activStatus    = $derived(activ?.status?.status ?? 'offline');
	const activLabel     = $derived(activ?.status?.label  ?? 'Indisponibil momentan');
	const statusColor    = $derived(activStatus === 'online' ? '#22c55e' : activStatus === 'away' ? '#f59e0b' : '#ef4444');
	// motiv null = passed schedule check = within working hours
	const laServici      = $derived(activ?.status?.motiv == null);
	const lastSeenFmt    = $derived((() => {
		const ls = activ?.status?.last_seen;
		if (!ls) return null;
		const d    = new Date(ls);
		const mins = Math.round((Date.now() - d.getTime()) / 60000);
		if (mins < 60) return `acum ${mins} min`;
		return `azi la ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
	})());

	let realocareOpen   = $state(false);
	let motivText       = $state('');
	let trimitere       = $state(false);
	let trimitereOk     = $state(false);
	let trimitereEroare = $state('');

	function sheetAction(node: HTMLElement) {
		gsap.fromTo(node, { y: '100%' }, { y: 0, duration: 0.35, ease: 'power3.out' });
	}

	async function trimiteRealocare() {
		trimitere = true; trimitereEroare = '';
		try {
			await api.cerereRealocare(motivText.trim() || undefined);
			trimitereOk = true;
			motivText = '';
			setTimeout(() => { realocareOpen = false; trimitereOk = false; }, 2200);
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

{#if fara}
	<div class="flex flex-col items-center justify-center py-16 gap-3">
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

	<!-- Profil consilier -->
	<div class="rounded-2xl overflow-hidden mb-4"
		style="background: var(--surface2); border: 1px solid var(--border);">

		<div class="flex items-center gap-3 px-4 py-4">
			<div class="relative shrink-0">
				<div class="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold"
					style="background: var(--accent); color: white;">
					{#if activ.avatar}
						<img src={activ.avatar} alt={activ.name} class="w-full h-full object-cover" />
					{:else}
						{activ.initials}
					{/if}
				</div>
				<span class="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2"
					style="background: {statusColor}; border-color: var(--surface2);">
				</span>
			</div>

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

			{#if activ.telefon}
				<a href="tel:{activ.telefon}"
					class="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-lg transition-opacity active:opacity-70"
					style="background: #22c55e18; color: #22c55e; text-decoration: none;">
					📞
				</a>
			{/if}
		</div>

		{#if activ.telefon}
			<div class="px-4 pb-3 -mt-1">
				<span class="text-xs" style="color: var(--muted)">{telefonFmt(activ.telefon)}</span>
			</div>
		{/if}
	</div>

	<!-- Mesaje reparații -->
	<div class="rounded-2xl overflow-hidden mb-4"
		style="background: var(--surface2); border: 1px solid var(--border);">
		<div class="px-4 py-2.5 border-b"
			style="border-color: var(--border); background: var(--surface);">
			<p class="text-[10px] font-bold uppercase tracking-widest" style="color: var(--muted)">
				💬 Mesaje reparații
			</p>
		</div>
		<a href="/dashboard/reparatii" onclick={onClose}
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

	<!-- Realocare -->
	<button onclick={() => realocareOpen = true}
		class="w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all active:scale-[0.98]"
		style="background: var(--surface2); border: 1px solid var(--border);">
		<div class="text-left">
			<p class="text-sm font-semibold" style="color: var(--text)">🔄 Solicită realocare consilier</p>
			<p class="text-xs mt-0.5" style="color: var(--muted)">Dorești un alt consilier dedicat?</p>
		</div>
		<span style="color: var(--muted)">›</span>
	</button>
{/if}

<!-- Sheet realocare -->
{#if realocareOpen}
	<button class="fixed inset-0 z-[60]" style="background: rgba(0,0,0,0.6);"
		onclick={() => { realocareOpen = false; trimitereOk = false; trimitereEroare = ''; }}
		aria-label="Închide"></button>

	<div use:sheetAction
		class="fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl overflow-hidden"
		style="background: var(--surface); max-height: 80vh; overflow-y: auto; border-top: 1px solid var(--border);">
		<div class="px-4 pt-3 pb-6">
			<div class="w-10 h-1 rounded-full mx-auto mb-5" style="background: var(--border);"></div>

			{#if trimitereOk}
				<div class="text-center py-6">
					<p class="text-4xl mb-3">✅</p>
					<p class="text-base font-bold mb-1" style="color: var(--text)">Cerere trimisă!</p>
					<p class="text-sm" style="color: var(--muted)">
						Echipa noastră va analiza și te va contacta în curând.
					</p>
				</div>
			{:else}
				<div class="flex items-center justify-between mb-4">
					<div>
						<h2 class="text-base font-bold" style="color: var(--text)">Realocare consilier</h2>
						<p class="text-xs mt-0.5" style="color: var(--muted)">
							Consilier actual: <strong>{consilier?.name}</strong>
						</p>
					</div>
					<button onclick={() => realocareOpen = false}
						class="w-8 h-8 rounded-full flex items-center justify-center text-lg"
						style="background: var(--surface2); color: var(--muted);">×</button>
				</div>

				<div class="space-y-4">
					<p class="text-sm" style="color: var(--muted)">
						Lasă un mesaj opțional și vom procesa cererea în 24h.
					</p>
					<textarea bind:value={motivText} rows="3"
						placeholder="Ex: Prefer o comunicare mai frecventă..."
						class="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text); font-family: inherit;">
					</textarea>

					{#if trimitereEroare}
						<p class="text-xs" style="color: #ef4444">{trimitereEroare}</p>
					{/if}

					<button onclick={trimiteRealocare} disabled={trimitere}
						class="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-[0.98]"
						style="background: var(--accent); color: white;">
						{trimitere ? 'Se trimite...' : '🔄 Trimite cererea'}
					</button>
					<p class="text-[11px] text-center" style="color: var(--muted)">
						Vei păstra consilierul actual până la procesarea cererii.
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
