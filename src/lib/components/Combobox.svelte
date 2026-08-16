<script lang="ts">
	// Listă căutabilă, în locul lui <select> nativ.
	//
	// Selectul nativ sare doar pe INIȚIALĂ și doar cât ții tastele apăsate rapid:
	// cu ~50 de mărci nu poți tasta „opel" ca să ajungi la Opel. Aici se filtrează
	// pe orice porțiune din nume, fără diacritice și fără majuscule.
	//
	// Dropdownul e poziționat `fixed`, nu `absolute`: cardurile din /register și
	// din dashboard au `overflow-hidden` pentru colțurile rotunjite și ar tăia o
	// listă poziționată în interiorul lor.

	type Optiune = {
		id: number;
		nume: string;
		/** Linie secundară — distanță, preț, motivul indisponibilității. */
		sub?: string;
		/** Se vede în listă, dar nu se poate alege. */
		indisponibila?: boolean;
	};

	let {
		optiuni = [],
		value = $bindable<number | null>(null),
		placeholder = 'Caută…',
		disabled = false,
		loading = false,
		golText = 'Niciun rezultat',
		onCauta = undefined,
		id = undefined
	}: {
		optiuni?: Optiune[];
		value?: number | null;
		placeholder?: string;
		disabled?: boolean;
		loading?: boolean;
		golText?: string;
		/**
		 * Cine primește textul tastat poate aduce rezultate de pe server. Când e
		 * dat, filtrarea locală se oprește: lista primită E răspunsul, iar o a
		 * doua filtrare peste ea ar ascunde exact ce a găsit serverul.
		 */
		onCauta?: (q: string) => void;
		id?: string;
	} = $props();

	let cauta   = $state('');
	let deschis = $state(false);
	let activ   = $state(0);

	let inputEl:  HTMLInputElement | undefined = $state();
	let listaEl:  HTMLElement | undefined = $state();
	let poz = $state({ left: 0, top: 0, width: 0, sus: false });

	const selectat = $derived(optiuni.find((o) => o.id === value) ?? null);

	// „Škoda" trebuie găsit tastând „skoda".
	function plat(s: string): string {
		return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	}

	const filtrate = $derived.by(() => {
		if (onCauta) return optiuni;

		const q = plat(cauta.trim());
		if (!q) return optiuni;

		return optiuni.filter((o) => plat(o.nume).includes(q));
	});

	/** Prima opțiune pe care chiar o poate alege — acolo pornește tastatura. */
	function primaLibera(de: number, pas: number): number {
		for (let i = de; i >= 0 && i < filtrate.length; i += pas) {
			if (!filtrate[i].indisponibila) return i;
		}

		return de;
	}

	// Când valoarea e schimbată din afară (reset după salvare, schimbarea mărcii
	// golește modelul), inputul trebuie să arate ce e selectat.
	$effect(() => {
		if (!deschis) cauta = selectat?.nume ?? '';
	});

	function pozitioneaza() {
		if (!inputEl) return;
		const r = inputEl.getBoundingClientRect();
		const maxH = 260;
		const subEste = window.innerHeight - r.bottom;
		const sus = subEste < maxH + 8 && r.top > subEste;

		poz = {
			left: r.left,
			top: sus ? r.top - 4 : r.bottom + 4,
			width: r.width,
			sus
		};
	}

	function deschide() {
		if (disabled) return;
		deschis = true;
		cauta = '';
		activ = 0;
		pozitioneaza();
	}

	function inchide() {
		deschis = false;
		cauta = selectat?.nume ?? '';
	}

	function alege(o: Optiune) {
		if (o.indisponibila) return;
		value = o.id;
		deschis = false;
		cauta = o.nume;
	}

	function peTasta(e: KeyboardEvent) {
		if (!deschis && (e.key === 'ArrowDown' || e.key === 'Enter')) {
			deschide();
			return;
		}
		if (!deschis) return;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activ = primaLibera(Math.min(activ + 1, filtrate.length - 1), 1);
			vizibil();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activ = primaLibera(Math.max(activ - 1, 0), -1);
			vizibil();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (filtrate[activ]) alege(filtrate[activ]);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			inchide();
		}
	}

	function vizibil() {
		listaEl?.querySelectorAll('[data-optiune]')[activ]?.scrollIntoView({ block: 'nearest' });
	}

	// Click în afară = închidere. Pointerdown, ca să prindă și tap-ul pe mobil.
	function peDocument(e: PointerEvent) {
		if (!deschis) return;
		const t = e.target as Node;
		if (inputEl?.contains(t) || listaEl?.contains(t)) return;
		inchide();
	}
</script>

<svelte:window
	onpointerdown={peDocument}
	onresize={() => deschis && pozitioneaza()}
	onscroll={() => deschis && pozitioneaza()}
/>

<div class="relative">
	<input
		{id}
		bind:this={inputEl}
		type="text"
		role="combobox"
		aria-expanded={deschis}
		aria-controls={id ? id + '-lista' : undefined}
		autocomplete="off"
		{disabled}
		placeholder={loading ? 'Se încarcă...' : placeholder}
		bind:value={cauta}
		onfocus={deschide}
		onclick={deschide}
		oninput={() => {
			if (!deschis) deschide();
			activ = 0;
			onCauta?.(cauta);
		}}
		onkeydown={peTasta}
		class="w-full px-3.5 py-3 rounded-xl text-sm outline-none transition-all disabled:opacity-40"
		style="background: var(--surface2); border: 1.5px solid {selectat
			? 'var(--accent)'
			: 'var(--border)'}; color: var(--text);"
	/>

	<span
		class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-xs"
		style="color: var(--muted)">{deschis ? '▲' : '▼'}</span
	>
</div>

{#if deschis}
	<div
		bind:this={listaEl}
		id={id ? id + '-lista' : undefined}
		role="listbox"
		class="fixed rounded-xl overflow-y-auto"
		style="left: {poz.left}px; {poz.sus
			? `bottom: ${window.innerHeight - poz.top}px;`
			: `top: ${poz.top}px;`} width: {poz.width}px; max-height: 260px; z-index: 60;
			background: var(--surface); border: 1px solid var(--border);
			box-shadow: 0 12px 36px rgba(0,0,0,0.45);"
	>
		{#if filtrate.length === 0}
			<div class="px-3.5 py-3 text-xs" style="color: var(--muted)">{golText}</div>
		{:else}
			{#each filtrate as o, i (o.id)}
				<button
					data-optiune
					type="button"
					role="option"
					aria-selected={o.id === value}
					aria-disabled={o.indisponibila}
					onclick={() => alege(o)}
					onpointerenter={() => !o.indisponibila && (activ = i)}
					class="w-full text-left px-3.5 py-2.5 text-sm transition-colors"
					style="background: {i === activ && !o.indisponibila ? 'var(--surface2)' : 'transparent'};
						color: {o.indisponibila ? 'var(--muted)' : o.id === value ? 'var(--accent)' : 'var(--text)'};
						border: none; cursor: {o.indisponibila ? 'not-allowed' : 'pointer'};"
				>
					{o.nume}
					{#if o.sub}
						<span class="block text-[11px] leading-snug mt-0.5" style="color: var(--muted)">{o.sub}</span>
					{/if}
				</button>
			{/each}
		{/if}
	</div>
{/if}
