<script lang="ts">
	/**
	 * Alegerea unui interval — ridicare și returnare — într-un singur calendar.
	 *
	 * Două luni una lângă alta pe ecran lat, una singură pe telefon: paisprezece
	 * coloane pe 360px sunt ilizibile. La o închiriere de o săptămână intervalul
	 * trece aproape mereu peste sfârșit de lună, deci a doua lună scutește o
	 * navigare exact în cazul obișnuit.
	 *
	 * Nu folosim două `<input type="date">`: fiecare browser deschide alt
	 * selector, niciunul nu știe de celălalt capăt și niciunul nu poate stinge
	 * zilele deja rezervate.
	 */

	let {
		deschis = $bindable(false),
		de = $bindable(''),
		pana = $bindable(''),
		/** Intervale deja ocupate, ca zilele lor să fie stinse. */
		blocate = [],
		maxZile = 60,
		maxInainte = 180
	}: {
		deschis?: boolean;
		/** Prima zi, în format an-lună-zi. */
		de?: string;
		/** Ultima zi, în format an-lună-zi. */
		pana?: string;
		blocate?: { from: string; to: string }[];
		maxZile?: number;
		maxInainte?: number;
	} = $props();

	const LUNI = [
		'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
		'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
	];
	// Luni prima: în România săptămâna nu începe duminica.
	const ZILE = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

	function cod(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	const azi = new Date();
	azi.setHours(0, 0, 0, 0);
	const minim = cod(azi);
	const maxim = cod(new Date(azi.getTime() + maxInainte * 86_400_000));

	// Ciornă: bara de sus nu se schimbă până nu apeși „Aplică perioada".
	let ciornaDe = $state('');
	let ciornaPana = $state('');
	let ancoraLuna = $state(azi.getMonth());
	let ancoraAn = $state(azi.getFullYear());

	// O singură lună sub 640px; nu ne bazăm pe CSS să ascundă a doua, altfel
	// săgeata de navigare ar sări peste luni pe telefon.
	let doarOLuna = $state(false);

	$effect(() => {
		if (!deschis) return;
		ciornaDe = de;
		ciornaPana = pana;

		const baza = de ? new Date(de + 'T00:00:00') : azi;
		ancoraLuna = baza.getMonth();
		ancoraAn = baza.getFullYear();
	});

	$effect(() => {
		const mq = window.matchMedia('(max-width: 640px)');
		const citeste = () => (doarOLuna = mq.matches);
		citeste();
		mq.addEventListener('change', citeste);

		return () => mq.removeEventListener('change', citeste);
	});

	/** Zilele ocupate, desfăcute din intervale în coduri, ca să le putem stinge una câte una. */
	const ocupate = $derived.by(() => {
		const set = new Set<string>();

		for (const b of blocate) {
			const s = new Date(b.from + 'T00:00:00');
			const e = new Date(b.to + 'T00:00:00');
			if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;

			for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) set.add(cod(d));
		}

		return set;
	});

	function grila(luna: number, an: number) {
		const zileInLuna = new Date(an, luna + 1, 0).getDate();
		// getDay() dă 0 pentru duminică; mutăm ca luni să fie prima coloană.
		const gol = (new Date(an, luna, 1).getDay() + 6) % 7;

		const zile = Array.from({ length: zileInLuna }, (_, i) => {
			const c = cod(new Date(an, luna, i + 1));

			return {
				zi: i + 1,
				cod: c,
				blocata: c < minim || c > maxim || ocupate.has(c),
				capat: c === ciornaDe || (!!ciornaPana && c === ciornaPana),
				stanga: c === ciornaDe && !!ciornaPana && ciornaDe !== ciornaPana,
				dreapta: c === ciornaPana && ciornaDe !== ciornaPana,
				intre: !!ciornaDe && !!ciornaPana && c > ciornaDe && c < ciornaPana
			};
		});

		return { titlu: `${LUNI[luna]} ${an}`, gol, zile };
	}

	const luna1 = $derived(grila(ancoraLuna, ancoraAn));
	const luna2 = $derived.by(() => {
		const d = new Date(ancoraAn, ancoraLuna + 1, 1);

		return grila(d.getMonth(), d.getFullYear());
	});

	const nrZile = $derived.by(() => {
		if (!ciornaDe || !ciornaPana) return 0;
		const z = Math.round(
			(new Date(ciornaPana + 'T00:00:00').getTime() - new Date(ciornaDe + 'T00:00:00').getTime()) / 86_400_000
		);

		return z > 0 ? z : 0;
	});

	const preaLung = $derived(nrZile > maxZile);
	const gata = $derived(!!ciornaDe && !!ciornaPana && nrZile > 0 && !preaLung);

	/** Un interval e valabil doar dacă nicio zi dintre capete nu e deja luată. */
	function trecePeste(a: string, b: string): boolean {
		for (let d = new Date(a + 'T00:00:00'); cod(d) <= b; d.setDate(d.getDate() + 1)) {
			if (ocupate.has(cod(d))) return true;
		}

		return false;
	}

	function alege(c: string) {
		// A doua apăsare știe de prima: o zi mai devreme devine noua ridicare, nu
		// o eroare. Altfel omul trebuie să apese „Șterge" ca să se răzgândească.
		if (!ciornaDe || ciornaPana || c <= ciornaDe) {
			ciornaDe = c;
			ciornaPana = '';

			return;
		}

		if (trecePeste(ciornaDe, c)) {
			// Mașina e ocupată undeva la mijloc; repornim de la ziua apăsată.
			ciornaDe = c;
			ciornaPana = '';

			return;
		}

		ciornaPana = c;
	}

	function schimbaLuna(pas: number) {
		const d = new Date(ancoraAn, ancoraLuna + pas, 1);
		ancoraLuna = d.getMonth();
		ancoraAn = d.getFullYear();
	}

	function sterge() {
		ciornaDe = '';
		ciornaPana = '';
	}

	function aplica() {
		if (!gata) return;
		de = ciornaDe;
		pana = ciornaPana;
		deschis = false;
	}

	function scurt(c: string): string {
		return new Date(c + 'T00:00:00').toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
	}

	function peTasta(e: KeyboardEvent) {
		if (e.key === 'Escape') deschis = false;
	}
</script>

<svelte:window on:keydown={peTasta} />

{#if deschis}
	<button
		type="button"
		class="fixed inset-0 z-[100] cursor-default cal-fundal"
		aria-label="Închide calendarul"
		onclick={() => (deschis = false)}
	></button>

	<div
		class="fixed inset-0 z-[101] flex items-center justify-center p-3 pointer-events-none"
		role="dialog"
		aria-modal="true"
		aria-label="Alege perioada"
	>
		<div
			class="w-full max-w-[680px] max-h-[92vh] overflow-y-auto rounded-2xl p-4 pointer-events-auto cal-card"
			style="background: var(--surface); border: 1px solid var(--border);"
		>
			<!-- Navigare + îndrumar: textul spune ce urmează, nu ce s-a întâmplat -->
			<div class="flex items-center justify-between gap-2 mb-3">
				<button
					type="button"
					onclick={() => schimbaLuna(-1)}
					class="w-9 h-9 shrink-0 rounded-xl text-base active:scale-90 transition-transform"
					style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);"
					aria-label="Luna anterioară">‹</button>

				<p class="text-[11px] text-center leading-snug" style="color: var(--muted)">
					{#if ciornaDe && !ciornaPana}
						Acum apasă ziua în care aduci mașina înapoi
					{:else}
						Apasă ziua de ridicare, apoi pe cea de returnare
					{/if}
				</p>

				<button
					type="button"
					onclick={() => schimbaLuna(1)}
					class="w-9 h-9 shrink-0 rounded-xl text-base active:scale-90 transition-transform"
					style="background: var(--surface2); color: var(--text); border: 1px solid var(--border);"
					aria-label="Luna următoare">›</button>
			</div>

			<div class="grid gap-5" style="grid-template-columns: repeat({doarOLuna ? 1 : 2}, minmax(0, 1fr));">
				{#each doarOLuna ? [luna1] : [luna1, luna2] as l (l.titlu)}
					<div>
						<p class="text-center text-xs font-bold mb-2" style="color: var(--text)">{l.titlu}</p>

						<div class="grid grid-cols-7 mb-1">
							{#each ZILE as z}
								<div class="text-center text-[10px] font-bold py-1" style="color: var(--muted)">{z}</div>
							{/each}
						</div>

						<div class="grid grid-cols-7">
							{#each Array(l.gol) as _}
								<div></div>
							{/each}

							{#each l.zile as z (z.cod)}
								<button
									type="button"
									disabled={z.blocata}
									onclick={() => alege(z.cod)}
									class="zi aspect-square text-[12px] font-semibold disabled:opacity-25 disabled:cursor-not-allowed"
									class:zi-capat={z.capat}
									class:zi-stanga={z.stanga}
									class:zi-dreapta={z.dreapta}
									class:zi-intre={z.intre}
								>{z.zi}</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div class="flex items-center gap-2 flex-wrap mt-4 pt-3" style="border-top: 1px solid var(--border);">
				<p class="text-[12px] flex-1 min-w-[140px]" style="color: var(--muted)">
					{#if ciornaDe && ciornaPana}
						{scurt(ciornaDe)} – {scurt(ciornaPana)} ·
						<b style="color: {preaLung ? '#f87171' : '#22c55e'}">{nrZile} {nrZile === 1 ? 'zi' : 'zile'}</b>
						{#if preaLung}
							<span class="block text-[11px] mt-0.5" style="color: #f87171">
								Maximum {maxZile} de zile într-o rezervare.
							</span>
						{/if}
					{:else if ciornaDe}
						{scurt(ciornaDe)} · alege ziua de returnare
					{:else}
						Nicio zi aleasă
					{/if}
				</p>

				<button
					type="button"
					onclick={sterge}
					class="px-4 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
					style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);"
				>Șterge</button>

				<button
					type="button"
					onclick={aplica}
					disabled={!gata}
					class="px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 active:scale-95 transition-transform"
					style="background: #eab308; color: #1a1a1a;"
				>Aplică perioada</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.cal-fundal {
		/* Blur puternic pe toată pagina din spate, văl mai subțire: fereastra
		   rămâne crocantă, restul se topește — același desen pe toate ferestrele. */
		background: rgba(8, 10, 18, 0.42);
		backdrop-filter: blur(14px) saturate(1.1);
		-webkit-backdrop-filter: blur(14px) saturate(1.1);
		animation: apare 0.18s ease-out;
	}

	.cal-card {
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
		animation: creste 0.2s cubic-bezier(0.2, 0.7, 0.3, 1);
	}

	/* Zilele dintre capete stau lipite: intervalul trebuie citit ca o bandă,
	   nu ca un șir de pastile separate. */
	.zi {
		display: grid;
		place-items: center;
		background: transparent;
		color: var(--text);
		border: 0;
		border-radius: 999px;
		transition: background 0.14s ease;
	}
	.zi:not(:disabled):hover { background: var(--surface2); }
	.zi-intre  { background: rgba(234, 179, 8, 0.22); border-radius: 0; }
	.zi-capat  { background: #eab308; color: #1a1a1a; }
	.zi-stanga { border-radius: 999px 0 0 999px; }
	.zi-dreapta { border-radius: 0 999px 999px 0; }

	@keyframes apare { from { opacity: 0; } }
	@keyframes creste { from { opacity: 0; transform: scale(0.96) translateY(8px); } }

	@media (prefers-reduced-motion: reduce) {
		.cal-fundal, .cal-card { animation: none; }
	}
</style>
