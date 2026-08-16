<script lang="ts">
	/**
	 * De unde ia clientul mașina, sau unde o aduce înapoi.
	 *
	 * Catalogul vine din API, nu din cod: taxele se schimbă din DB, fără deploy.
	 * Componenta nu știe ce locuri există și nici cât costă — le primește.
	 */

	import { api, type LocInchiriere, type LocalitateGasita } from '$lib/api';
	import Combobox from '$lib/components/Combobox.svelte';

	let {
		deschis = $bindable(false),
		tip = $bindable('sediu'),
		adresa = $bindable(''),
		localitateId = $bindable(0),
		locuri = [],
		titlu = 'De unde iei mașina?'
	}: {
		deschis?: boolean;
		/** Codul locului ales. */
		tip?: string;
		/** Adresa scrisă de client, folosită doar unde catalogul o cere. */
		adresa?: string;
		/** Localitatea aleasă; 0 = niciuna. Doar la locurile plătite pe km. */
		localitateId?: number;
		locuri?: LocInchiriere[];
		titlu?: string;
	} = $props();

	let ciornaTip = $state('sediu');
	let ciornaAdresa = $state('');
	// `Combobox` lucrează cu `null` pentru „nimic ales", noi cu 0 — puntea stă
	// aici, nu împrăștiată prin șablon.
	let localitateSelectata = $state<number | null>(null);
	const ciornaLocalitate = $derived(localitateSelectata ?? 0);

	$effect(() => {
		if (!deschis) return;
		ciornaTip = tip;
		ciornaAdresa = adresa;
		localitateSelectata = localitateId || null;
	});

	const ales = $derived(locuri.find((l) => l.cod === ciornaTip) ?? null);
	const cereAdresa = $derived(!!ales?.cere_adresa);
	const cereLocalitate = $derived(!!ales?.cere_localitate);

	const localitateAleasa = $derived(
		ales?.localitati.find((l) => l.id === ciornaLocalitate) ?? null
	);

	// Prețul locului ales: cel al localității când se plătește pe km, altfel taxa
	// fixă. Cifra vine de la server; aici doar se alege care dintre ele se arată.
	const pretAles = $derived(
		cereLocalitate ? (localitateAleasa?.pret ?? null) : (ales?.taxa ?? 0)
	);

	const gata = $derived(
		!!ales
		&& (!cereAdresa || ciornaAdresa.trim().length > 3)
		&& (!cereLocalitate || !!localitateAleasa)
	);

	// ── Căutarea în nomenclator ──────────────────────────────────────────────
	//
	// Lista servită e mică și deja încărcată, deci se filtrează pe loc, fără
	// rețea. Căutarea pe server intră peste ea ca să acopere restul țării: omul
	// din Malu Mare trebuie să-și găsească comuna și să AFLE că nu ajungem încă
	// acolo — „niciun rezultat" l-ar lăsa să creadă că a scris greșit.

	let gasite = $state<LocalitateGasita[]>([]);
	let cautaTimer: number | null = null;
	let cautaSecventa = 0;

	function faraDiacritice(s: string): string {
		return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	}

	let textCautat = $state('');

	function cauta(text: string) {
		const q = text.trim();
		textCautat = q;

		if (cautaTimer) clearTimeout(cautaTimer);
		if (q.length < 2) {
			gasite = [];

			return;
		}

		cautaTimer = setTimeout(async () => {
			// Numărul de ordine face ca un răspuns întârziat la „mal" să nu mai
			// suprascrie rezultatul proaspăt pentru „malu mare".
			const al = ++cautaSecventa;
			try {
				const res = await api.inchirieriLocalitati(q, ciornaTip);
				if (al === cautaSecventa) gasite = res.localitati;
			} catch {
				// Căutarea e un ajutor, nu o poartă: lista locală rămâne în picioare.
				if (al === cautaSecventa) gasite = [];
			}
		}, 250) as unknown as number;
	}

	/** Ce vede omul în listă: întâi localitățile servite, apoi restul țării. */
	const optiuniLocalitate = $derived.by(() => {
		// Filtrarea locală o facem aici: `Combobox` o oprește când primește
		// `onCauta`, altfel ar tăia din rezultatele venite de pe server.
		const q = faraDiacritice(textCautat);
		const servite = (ales?.localitati ?? [])
			.filter((l) => !q || faraDiacritice(l.nume).includes(q))
			.map((l) => ({
				id: l.id,
				nume: l.nume,
				sub: `${l.km} km · ${l.pret} lei`
			}));

		const cunoscute = new Set(servite.map((s) => s.id));
		const restul = gasite
			.filter((g) => !g.servita && !cunoscute.has(g.id))
			.map((g) => ({
				id: g.id,
				nume: g.nume,
				sub: g.judet ? `${g.judet} · nu livrăm încă aici` : 'nu livrăm încă aici',
				indisponibila: true
			}));

		return [...servite, ...restul];
	});

	function confirma() {
		if (!gata) return;
		tip = ciornaTip;
		// Adresa nu se cară mai departe când locul n-o cere: altfel operatorul
		// citește o adresă rămasă dintr-o alegere de care clientul s-a răzgândit.
		adresa = cereAdresa ? ciornaAdresa.trim() : '';
		localitateId = cereLocalitate ? ciornaLocalitate : 0;
		deschis = false;
	}

	function peTasta(e: KeyboardEvent) {
		if (e.key === 'Escape') deschis = false;
	}
</script>

<svelte:window on:keydown={peTasta} />

{#if deschis}
	<button
		type="button"
		class="fixed inset-0 z-[100] cursor-default loc-fundal"
		aria-label="Închide"
		onclick={() => (deschis = false)}
	></button>

	<div
		class="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
		role="dialog"
		aria-modal="true"
		aria-label={titlu}
	>
		<div
			class="w-full max-w-[360px] rounded-2xl p-4 pointer-events-auto loc-card"
			style="background: var(--surface); border: 1px solid var(--border);"
		>
			<p class="text-sm font-bold mb-3" style="color: var(--text)">{titlu}</p>

			<div class="space-y-2">
				{#each locuri as l (l.cod)}
					{@const activ = l.cod === ciornaTip}
					<button
						type="button"
						onclick={() => (ciornaTip = l.cod)}
						class="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
						style="background: {activ ? 'color-mix(in srgb, #eab308 12%, var(--surface2))' : 'var(--surface2)'};
						       border: 1.5px solid {activ ? '#eab308' : 'var(--border)'};"
					>
						<span class="text-lg leading-none shrink-0">{l.icon}</span>
						<span class="min-w-0 flex-1">
							<span class="block text-[13px] font-bold truncate" style="color: var(--text)">{l.label}</span>
							{#if l.descriere}
								<span class="block text-[11px] truncate" style="color: var(--muted)">{l.descriere}</span>
							{/if}
						</span>
						<span class="text-[11px] font-bold shrink-0"
							style="color: {l.cere_localitate || l.taxa > 0 ? '#eab308' : '#22c55e'}">
							{#if l.cere_localitate}
								după distanță
							{:else if l.taxa > 0}
								+{l.taxa} lei
							{:else}
								gratuit
							{/if}
						</span>
					</button>
				{/each}
			</div>

			{#if cereLocalitate}
				<div class="block mt-3">
					<span class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--muted)">Localitatea</span>
					{#if ales && ales.localitati.length > 0}
						<div class="mt-1">
							<Combobox
								bind:value={localitateSelectata}
								optiuni={optiuniLocalitate}
								onCauta={cauta}
								placeholder="Scrie localitatea — ex. Malu Mare"
								golText="Nicio localitate cu numele ăsta"
							/>
						</div>
					{:else}
						<!-- Nicio localitate configurată: nu inventăm un preț, spunem adevărul. -->
						<p class="mt-1 text-[12px] leading-snug" style="color: var(--muted)">
							Nu avem încă tarife de livrare setate. Sună-ne și stabilim pe loc.
						</p>
					{/if}
				</div>
			{/if}

			{#if cereAdresa}
				<label class="block mt-3">
					<span class="text-[10px] font-bold uppercase tracking-wider" style="color: var(--muted)">Adresa</span>
					<input
						bind:value={ciornaAdresa}
						placeholder="Strada, numărul, orașul"
						autocomplete="street-address"
						class="w-full mt-1 text-sm px-3 py-2.5 rounded-xl"
						style="background: var(--surface2); border: 1px solid var(--border); color: var(--text);"
					/>
				</label>
			{/if}

			{#if pretAles !== null && pretAles > 0}
				<p class="text-[12px] mt-3" style="color: var(--muted)">
					Costă <b style="color: #eab308">{pretAles} lei</b>
					{#if localitateAleasa}
						pentru {localitateAleasa.km} km
					{/if}
					— o singură dată, nu pe zi.
				</p>
			{/if}

			<div class="flex gap-2 mt-4">
				<button
					type="button"
					onclick={() => (deschis = false)}
					class="flex-1 py-2.5 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
					style="background: var(--surface2); color: var(--muted); border: 1px solid var(--border);"
				>Renunță</button>

				<button
					type="button"
					onclick={confirma}
					disabled={!gata}
					class="flex-1 py-2.5 rounded-xl text-xs font-bold disabled:opacity-40 active:scale-95 transition-transform"
					style="background: #eab308; color: #1a1a1a;"
				>Alege locul</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.loc-fundal {
		background: rgba(8, 10, 18, 0.55);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		animation: apare 0.18s ease-out;
	}

	.loc-card {
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
		animation: creste 0.2s cubic-bezier(0.2, 0.7, 0.3, 1);
	}

	@keyframes apare { from { opacity: 0; } }
	@keyframes creste { from { opacity: 0; transform: scale(0.94) translateY(8px); } }

	@media (prefers-reduced-motion: reduce) {
		.loc-fundal, .loc-card { animation: none; }
	}
</style>
