<script lang="ts">
	/**
	 * Rândul de „act lipsă", cu încărcare pe loc.
	 *
	 * Înlocuiește mesajele „prezentați-vă la service": omul are actul în telefon,
	 * n-are rost pus pe drum ca să ni-l arate. Poza se face direct din cameră pe
	 * telefon (`capture`), fișierul pleacă imediat ce e ales — fără al doilea buton
	 * de confirmare, care doar adaugă un pas.
	 *
	 * Ce încarcă clientul intră NEVERIFICAT în WMS; textul de succes spune asta,
	 * ca omul să nu creadă că dosarul lui e gata.
	 */

	import CalendarModal from './CalendarModal.svelte';

	let {
		eticheta,
		descriere = '',
		accept = 'image/jpeg,image/png,image/webp,application/pdf',
		cereData = false,
		incarca,
		gata = false
	}: {
		eticheta: string;
		descriere?: string;
		accept?: string;
		/** Actele cu termen: cerem data ÎNAINTE de fișier — ea aprinde alertele. */
		cereData?: boolean;
		/** Trimite fișierul. Aruncă `{ message }` la eșec. */
		incarca: (fisier: File, valabilPana?: string) => Promise<{ message?: string }>;
		gata?: boolean;
	} = $props();

	let stare = $state<'liber' | 'trimite' | 'gata' | 'eroare'>(gata ? 'gata' : 'liber');
	let mesaj = $state('');
	let dataPana = $state('');
	let calendarDeschis = $state(false);
	let input: HTMLInputElement | undefined = $state();

	// Afișăm data pe românește; în cerere pleacă tot formatul an-lună-zi.
	const dataAfisata = $derived(
		dataPana ? dataPana.split('-').reverse().join('.') : ''
	);

	// Fără dată, serverul respinge cu 422 și omul nu înțelege de ce — așa că
	// butonul stă blocat până o completează.
	const poateTrimite = $derived(!cereData || dataPana !== '');

	// Un act nu poate expira în trecut; limita ține data validă din start.
	const azi = new Date().toISOString().slice(0, 10);

	async function alesFisier(e: Event) {
		const fisier = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!fisier) return;

		stare = 'trimite';
		mesaj = '';

		try {
			const r = await incarca(fisier, cereData ? dataPana : undefined);
			stare = 'gata';
			mesaj = r?.message ?? 'Document încărcat.';
		} catch (err: any) {
			stare = 'eroare';
			mesaj = err?.message ?? 'Încărcarea nu a reușit.';
		} finally {
			// Golim inputul: altfel același fișier ales din nou nu declanșează change.
			if (input) input.value = '';
		}
	}
</script>

<div
	class="px-3 py-2.5 rounded-lg text-xs"
	style="background: {stare === 'gata' ? '#22c55e12' : stare === 'eroare' ? '#ef444412' : '#eab30815'};
	       border: 1px solid {stare === 'gata' ? '#22c55e35' : stare === 'eroare' ? '#ef444435' : '#eab30830'};"
>
	<div class="flex items-center justify-between gap-3">
		<div class="min-w-0">
			<div class="font-semibold" style="color: {stare === 'gata' ? '#22c55e' : stare === 'eroare' ? '#ef4444' : '#eab308'};">
				{stare === 'gata' ? '✓' : '⚠️'} {eticheta}
			</div>
			{#if mesaj}
				<div class="mt-0.5" style="color: var(--muted)">{mesaj}</div>
			{:else if descriere}
				<div class="mt-0.5" style="color: var(--muted)">{descriere}</div>
			{/if}
		</div>

		{#if stare !== 'gata'}
			<button
				type="button"
				onclick={() => input?.click()}
				disabled={stare === 'trimite' || !poateTrimite}
				class="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-40 transition-opacity active:scale-95"
				style="background: #eab308; color: #1a1a1a;"
			>
				{stare === 'trimite' ? 'Se încarcă...' : 'Adaugă'}
			</button>
		{/if}
	</div>

	{#if cereData && stare !== 'gata'}
		<button
			type="button"
			onclick={() => (calendarDeschis = true)}
			class="w-full flex items-center justify-between gap-2 mt-2.5 px-2.5 py-2 rounded-lg text-[11px] transition-opacity active:scale-[0.99]"
			style="background: var(--surface2); border: 1px solid {dataPana ? '#eab30860' : 'var(--border)'}; color: var(--text);"
		>
			<span style="color: var(--muted)">Valabil până la</span>
			<span class="font-semibold" style="color: {dataPana ? '#eab308' : 'var(--muted)'}">
				{dataPana ? dataAfisata : 'alege data ›'}
			</span>
		</button>
	{/if}

	<input
		bind:this={input}
		type="file"
		{accept}
		capture="environment"
		onchange={alesFisier}
		class="hidden"
		aria-label={eticheta}
	/>
</div>

<CalendarModal
	bind:deschis={calendarDeschis}
	bind:valoare={dataPana}
	titlu="Până când e valabil?"
	subtitlu={eticheta}
	minim={azi}
/>
