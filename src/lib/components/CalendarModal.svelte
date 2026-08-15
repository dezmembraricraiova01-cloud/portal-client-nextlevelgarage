<script lang="ts">
	/**
	 * Alegerea unei date, într-un modal cu fundalul estompat.
	 *
	 * Nu folosim `<input type="date">`: pe desktop deschide selectorul browserului,
	 * altul pe fiecare sistem, iar pe telefon acoperă ecranul cu o roată nativă.
	 * Aici e o grilă de lună, la fel peste tot, cu zilele trecute stinse.
	 */

	let {
		deschis = $bindable(false),
		valoare = $bindable(''),
		titlu = 'Alege data',
		subtitlu = '',
		minim = new Date().toISOString().slice(0, 10)
	}: {
		deschis?: boolean;
		/** Data aleasă, în format an-lună-zi. */
		valoare?: string;
		titlu?: string;
		subtitlu?: string;
		minim?: string;
	} = $props();

	const LUNI = [
		'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
		'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'
	];
	// Luni prima: în România săptămâna nu începe duminica.
	const ZILE = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

	const azi = new Date();
	const dinValoare = $derived(valoare ? new Date(valoare + 'T00:00:00') : null);

	let lunaCurenta = $state(azi.getMonth());
	let anCurent    = $state(azi.getFullYear());
	let aleasa      = $state<string>('');

	// La deschidere pornim din luna datei deja alese, dacă există.
	$effect(() => {
		if (!deschis) return;
		const baza = dinValoare ?? azi;
		lunaCurenta = baza.getMonth();
		anCurent    = baza.getFullYear();
		aleasa      = valoare;
	});

	function cod(an: number, luna: number, zi: number): string {
		return `${an}-${String(luna + 1).padStart(2, '0')}-${String(zi).padStart(2, '0')}`;
	}

	const zileInLuna = $derived(new Date(anCurent, lunaCurenta + 1, 0).getDate());

	// getDay() dă 0 pentru duminică; mutăm ca luni să fie prima coloană.
	const golInainte = $derived((new Date(anCurent, lunaCurenta, 1).getDay() + 6) % 7);

	const zile = $derived(
		Array.from({ length: zileInLuna }, (_, i) => {
			const c = cod(anCurent, lunaCurenta, i + 1);

			return { zi: i + 1, cod: c, blocata: c < minim, aleasa: c === aleasa };
		})
	);

	function schimbaLuna(pas: number) {
		const d = new Date(anCurent, lunaCurenta + pas, 1);
		lunaCurenta = d.getMonth();
		anCurent    = d.getFullYear();
	}

	function confirma() {
		if (!aleasa) return;
		valoare = aleasa;
		deschis = false;
	}

	function peTasta(e: KeyboardEvent) {
		if (e.key === 'Escape') deschis = false;
	}
</script>

<svelte:window on:keydown={peTasta} />

{#if deschis}
	<!-- Fundal estompat -->
	<button
		type="button"
		class="fixed inset-0 z-[100] cursor-default modal-fundal"
		aria-label="Închide calendarul"
		onclick={() => (deschis = false)}
	></button>

	<div
		class="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
		role="dialog"
		aria-modal="true"
		aria-label={titlu}
	>
		<div
			class="w-full max-w-[320px] rounded-2xl p-4 pointer-events-auto modal-card"
			style="background: var(--surface); border: 1px solid var(--border);"
		>
			<div class="mb-3">
				<p class="text-sm font-bold" style="color: var(--text)">{titlu}</p>
				{#if subtitlu}
					<p class="text-[11px] mt-0.5" style="color: var(--muted)">{subtitlu}</p>
				{/if}
			</div>

			<!-- Navigare lună -->
			<div class="flex items-center justify-between mb-2">
				<button
					type="button"
					onclick={() => schimbaLuna(-1)}
					class="w-8 h-8 rounded-lg text-sm transition-opacity active:scale-90"
					style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);"
					aria-label="Luna anterioară">‹</button>

				<span class="text-xs font-semibold" style="color: var(--text)">
					{LUNI[lunaCurenta]} {anCurent}
				</span>

				<button
					type="button"
					onclick={() => schimbaLuna(1)}
					class="w-8 h-8 rounded-lg text-sm transition-opacity active:scale-90"
					style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);"
					aria-label="Luna următoare">›</button>
			</div>

			<div class="grid grid-cols-7 gap-1 mb-1">
				{#each ZILE as z}
					<div class="text-center text-[10px] font-semibold py-1" style="color: var(--muted)">{z}</div>
				{/each}
			</div>

			<div class="grid grid-cols-7 gap-1">
				{#each Array(golInainte) as _}
					<div></div>
				{/each}

				{#each zile as z (z.cod)}
					<button
						type="button"
						disabled={z.blocata}
						onclick={() => (aleasa = z.cod)}
						class="aspect-square rounded-lg text-[12px] font-semibold transition-all disabled:opacity-25 disabled:cursor-not-allowed active:scale-90"
						style="background: {z.aleasa ? '#eab308' : 'var(--surface2)'};
						       color: {z.aleasa ? '#1a1a1a' : 'var(--text)'};
						       border: 1px solid {z.aleasa ? '#eab308' : 'var(--border)'};"
					>
						{z.zi}
					</button>
				{/each}
			</div>

			<div class="flex gap-2 mt-4">
				<button
					type="button"
					onclick={() => (deschis = false)}
					class="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-opacity active:scale-95"
					style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);"
				>Renunță</button>

				<button
					type="button"
					onclick={confirma}
					disabled={!aleasa}
					class="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 transition-opacity active:scale-95"
					style="background: #eab308; color: #1a1a1a;"
				>Alege data</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-fundal {
		background: rgba(8, 10, 18, 0.55);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		animation: apare 0.18s ease-out;
	}

	.modal-card {
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
		animation: creste 0.2s cubic-bezier(0.2, 0.7, 0.3, 1);
	}

	@keyframes apare { from { opacity: 0; } }
	@keyframes creste { from { opacity: 0; transform: scale(0.94) translateY(8px); } }

	@media (prefers-reduced-motion: reduce) {
		.modal-fundal, .modal-card { animation: none; }
	}
</style>
