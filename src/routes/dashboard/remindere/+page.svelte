<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { gsap } from 'gsap';
	import { auth } from '$lib/stores';
	import { api, type AlertaMasinaFull, type Masina, type AlertSummary, type AlertSummaryItem, type PortalNotificare } from '$lib/api';
	import { sortable } from '$lib/sortable';
	import AlertDocumentCard from '$lib/components/alerts/AlertDocumentCard.svelte';
	import AlertCustomCreateCard from '$lib/components/alerts/AlertCustomCreateCard.svelte';
	import AlertRecommendation from '$lib/components/alerts/AlertRecommendation.svelte';

	let client  = $derived($auth);
	let masine  = $state<Masina[]>([]);
	let alerte  = $state<AlertaMasinaFull[]>([]);
	let summary = $state<AlertSummary | null>(null);
	let loading = $state(true);

	let editMasinaId   = $state<number | null>(null);
	let editPersonal   = $state(false); // true când edităm o alertă personală globală (masina_id=null)
	let editTip        = $state<string | null>(null);
	let editSaving     = $state(false);
	let editToggling   = $state(false);
	let editError      = $state('');
	let editSuccess    = $state('');
	let recError       = $state<Record<string, string>>({}); // cheie: `${masina_id}_${tip}`

	const editOpen = $derived(!!editTip && (editPersonal || editMasinaId !== null));
	const editMasina = $derived(editMasinaId !== null ? masine.find(m => m.id === editMasinaId) : null);

	function closeEdit() {
		editMasinaId = null;
		editPersonal = false;
		editTip      = null;
		editError    = '';
		editSuccess  = '';
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && editOpen) {
			e.preventDefault();
			closeEdit();
		}
	}

	// Mută layout-ul la stânga (pe desktop) ca modalul să nu acopere cardurile.
	// Adaugă o clasă pe body — un CSS global o folosește să schimbe alinierea <main>.
	$effect(() => {
		if (typeof document === 'undefined') return;
		if (editOpen) document.body.classList.add('alerta-modal-open');
		else          document.body.classList.remove('alerta-modal-open');
		return () => document.body.classList.remove('alerta-modal-open');
	});

	// Scroll cardul activ în zona vizibilă când se deschide
	$effect(() => {
		if (!editOpen || !editTip) return;
		queueMicrotask(() => {
			const buttons = document.querySelectorAll(`[data-tip="${editTip}"]`);
			const target = Array.from(buttons).find(b => {
				const r = b.getBoundingClientRect();
				return r.width > 0;
			}) ?? buttons[0];
			target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
		});
	});

	const DOC_PERSONALE = [
		{ tip: 'buletin', icon: '🪪', label: 'Buletin' },
		{ tip: 'permis',  icon: '🚗', label: 'Permis' },
	];

	// Paletă wow per tip — folosită pentru gradient + halo glow pe card
	const DOC_HUE: Record<string, string> = {
		buletin:     '#6366f1', // indigo
		permis:      '#06b6d4', // cyan
		rovinieta:   '#f59e0b', // amber
		rca:         '#10b981', // emerald
		casco:       '#a855f7', // purple
		carte_verde: '#22c55e', // green
		itp:         '#0ea5e9', // sky
		tahograf:    '#f43f5e', // rose
	};
	const hueFor = (tip: string) => DOC_HUE[tip] ?? '#6366f1';
	const DOC_MASINA = [
		{ tip: 'rovinieta',   icon: '🛡️', label: 'Rovinieta' },
		{ tip: 'rca',         icon: '📋', label: 'RCA' },
		{ tip: 'casco',       icon: '🔒', label: 'CASCO' },
		{ tip: 'carte_verde', icon: '🌍', label: 'Carte Verde' },
		{ tip: 'itp',         icon: '🔬', label: 'ITP' },
		{ tip: 'tahograf',    icon: '📡', label: 'Tahograf' },
	];
	const TOATE_DOC = [...DOC_PERSONALE, ...DOC_MASINA];
	const ICOANE: Record<string, string> = Object.fromEntries(TOATE_DOC.map(d => [d.tip, d.icon]));

	// Ordine derivată din localStorage via action-ul $lib/sortable
	function loadOrder(): string[] {
		try {
			const s = localStorage.getItem('nlg-sort:docs-remindere');
			return s ? JSON.parse(s) : [];
		} catch { return []; }
	}

	let docsOrder = $state<string[]>(loadOrder());

	const orderedDocs = $derived(
		docsOrder.length
			? [...DOC_MASINA].sort((a, b) => {
				const ai = docsOrder.indexOf(a.tip);
				const bi = docsOrder.indexOf(b.tip);
				return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
			})
			: DOC_MASINA
	);

	const DOC_INFO: Record<string, { desc: string; motiv: string }> = {
		buletin:     { desc: 'Act de identitate obligatoriu în trafic',         motiv: 'Fără buletin valabil poți fi reținut la orice control rutier.' },
		permis:      { desc: 'Permis de conducere — obligatoriu prin lege',      motiv: 'Conducerea fără permis valid atrage dosar penal.' },
		rovinieta:   { desc: 'Taxă de drum obligatorie pe rețeaua națională',    motiv: 'Amenda ajunge la 4.000 lei și poate fi aplicată automat.' },
		rca:         { desc: 'Asigurare obligatorie de răspundere civilă',       motiv: 'Fără RCA, daunele produse terților cad integral în sarcina ta.' },
		casco:       { desc: 'Asigurare facultativă pentru mașina ta',           motiv: 'Te protejează la avarii, furt și accidente în care ești vinovat.' },
		carte_verde: { desc: 'Dovada asigurării valabilă în toată Europa',       motiv: 'Obligatorie la orice traversare a frontierei cu mașina.' },
		itp:         { desc: 'Inspecție tehnică periodică impusă de lege',       motiv: 'Mașina fără ITP valid nu poate circula legal și poate fi reținută.' },
		tahograf:    { desc: 'Aparat de înregistrare pentru transport',          motiv: 'Obligatoriu pentru vehicule comerciale și transport persoane.' },
	};

	const CTA_LINKS: Record<string, string> = {
		'Programează ITP':      '/dashboard/programari',
		'Pregătește călătorie': '/dashboard/trips',
	};

	let notificari   = $state<PortalNotificare[]>([]);
	let stergNotif   = $state<number | null>(null);
	let masinaActiva = $state<any>(null);

	onMount(async () => {
		const [summaryRes, masineRes, alerteRes, dashRes, notifRes] = await Promise.all([
			api.alertSummary().catch(() => null as AlertSummary | null),
			api.masini().catch(() => [] as Masina[]),
			api.toateAlertele().catch(() => [] as AlertaMasinaFull[]),
			api.dashboard().catch(() => null),
			api.notificari().catch(() => ({ notificari: [] as PortalNotificare[], necitite: 0 })),
		]);
		summary      = summaryRes;
		masine       = masineRes;
		alerte       = alerteRes;
		masinaActiva = dashRes?.masina_activa ?? null;
		notificari   = notifRes.notificari;
		loading      = false;

		await tick();
		// Stagger entrance pe carduri-doc
		gsap.from('.doc-card', {
			opacity: 0,
			y: 14,
			scale: 0.92,
			duration: 0.45,
			ease: 'power3.out',
			stagger: { each: 0.04, from: 'start' },
		});
	});

	async function marcheazaTotul() {
		await api.toateCitite().catch(() => {});
		notificari = notificari.map(n => ({ ...n, citita: true }));
		auth.patchNotificari(0);
	}

	async function stergeNotificare(id: number) {
		stergNotif = id;
		await api.stergeNotificare(id).catch(() => {});
		notificari = notificari.filter(n => n.id !== id);
		auth.patchNotificari(notificari.filter(n => !n.citita).length);
		stergNotif = null;
	}

	function formatData(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function formatDataScurt(iso: string | null): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function zileRamase(iso: string | null): number {
		if (!iso) return 999;
		return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
	}

	const alerteCont = $derived(client ? [
		client.are_restante && {
			icon: '💳', label: 'Lucrări neachitate',
			desc: 'Contactează service-ul pentru a regla situația.',
			color: '#ef4444', bg: '#ef444412', border: '#ef444430',
			href: null as string | null,
		},
		(masinaActiva?.deviz_pending) && {
			icon: '📋', label: 'Deviz în așteptare',
			desc: `${masinaActiva.marca} ${masinaActiva.model} · ${masinaActiva.numar_inmatriculare}`,
			color: '#eab308', bg: '#eab30812', border: '#eab30830',
			href: `/dashboard/reparatii/${masinaActiva.wo_uid}/deviz`,
		},
	].filter(Boolean) : []);

	const documente = $derived<AlertSummaryItem[]>(
		summary?.alerts.slice().sort((a, b) => {
			const ord: Record<string, number> = { critic: 0, missing: 1, unknown_date: 2, warning: 2, ok: 3 };
			return (ord[a.severitate] ?? 9) - (ord[b.severitate] ?? 9);
		}) ?? []
	);

	const urgente = $derived(documente.filter(d => d.severitate === 'critic'));
	const curand  = $derived(documente.filter(d => d.severitate === 'warning'));

	const totalAlerte = $derived(alerteCont.length + urgente.length);

	function itemStyle(sev: string) {
		if (sev === 'critic')       return { color: '#ef4444', bg: '#ef444410', border: '#ef444430', badge: '#ef444420' };
		if (sev === 'missing')      return { color: '#f59e0b', bg: '#f59e0b10', border: '#f59e0b30', badge: '#f59e0b20' };
		if (sev === 'unknown_date') return { color: '#f59e0b', bg: 'var(--surface)', border: 'var(--border)', badge: '#f59e0b20' };
		if (sev === 'warning')      return { color: '#f59e0b', bg: 'var(--surface)', border: 'var(--border)', badge: '#f59e0b20' };
		return                             { color: '#22c55e', bg: 'var(--surface)', border: 'var(--border)', badge: '#22c55e20' };
	}

	function badgeLabel(item: AlertSummaryItem): string {
		if (item.severitate === 'missing')      return 'Adaugă';
		if (item.severitate === 'unknown_date') return 'Fără dată';
		if (item.expirat)                       return 'Posibil expirat';
		if (item.expira_in_zile == null)        return '—';
		if (item.expira_in_zile === 0)          return 'Azi';
		if (item.expira_in_zile === 1)          return 'Mâine';
		return `${item.expira_in_zile} zile`;
	}

	function getAlerta(masinaId: number | null, tip: string) {
		return alerte.find(a => a.masina_id === masinaId && a.tip === tip);
	}

	const isCustomTip = (t: string) => t.startsWith('c:');

	function customAlerteForMasina(mid: number) {
		return alerte.filter(a => a.masina_id === mid && isCustomTip(a.tip));
	}

	const personalAlerte = $derived(alerte.filter(a => a.masina_id === null && isCustomTip(a.tip)));

	function getPersonalAlerta(tip: string) {
		return alerte.find(a => a.masina_id === null && a.tip === tip);
	}

	function openCustomCreate(masinaId: number) {
		editMasinaId = masinaId;
		editPersonal = false;
		editTip      = 'new-custom';
		editError    = '';
		editSuccess  = '';
	}

	function openPersonalCreate() {
		editMasinaId = null;
		editPersonal = true;
		editTip      = 'new-custom';
		editError    = '';
		editSuccess  = '';
	}

	function togglePersonalEdit(tip: string) {
		if (editPersonal && editTip === tip) {
			editPersonal = false; editTip = null; return;
		}
		editMasinaId = null;
		editPersonal = true;
		editTip      = tip;
		editError    = '';
		editSuccess  = '';
	}

	async function handleCreateCustom(
		masinaId: number,
		label: string,
		icon: string,
		data: string,
		zile: number,
		thresholds: number[] | null
	) {
		editSaving = true; editError = ''; editSuccess = '';
		try {
			const masina = masine.find(m => m.id === masinaId);
			if (!masina) { editError = 'Mașina nu a fost găsită.'; return; }
			const saved = await api.saveAlerta(masinaId, {
				tip:           'custom',
				custom_label:  label,
				custom_icon:   icon,
				data_expirare: data || null,
				zile_inainte:  zile,
				thresholds,
			});
			const full: AlertaMasinaFull = {
				...saved,
				masina_id:           masinaId,
				numar_inmatriculare: masina.numar_inmatriculare,
				marca:               masina.marca,
				model:               masina.model,
			};
			alerte = [...alerte.filter(a => !(a.masina_id === masinaId && a.tip === saved.tip)), full];
			summary = await api.alertSummary().catch(() => summary);
			editSuccess = 'Te anunțăm înainte să expire.';
			setTimeout(() => {
				if (editMasinaId === masinaId && editTip === 'new-custom') {
					editMasinaId = null; editTip = null; editSuccess = '';
				}
			}, 1400);
		} catch (e: any) {
			editError = e.message ?? 'Eroare la salvare.';
		} finally {
			editSaving = false;
		}
	}

	function cardBorder(masinaId: number | null, tip: string, isOpen: boolean): string {
		if (isOpen) return 'var(--accent)';
		const a = getAlerta(masinaId, tip);
		if (!a) return 'var(--border)';
		if (!a.data_expirare) return '#6b728050';
		const z = zileRamase(a.data_expirare);
		if (z <= 0)  return '#ef444470';
		if (z <= 30) return '#f59e0b70';
		return '#22c55e50';
	}

	function cardBadge(masinaId: number | null, tip: string) {
		const a = getAlerta(masinaId, tip);
		if (!a) return null;
		if (!a.data_expirare) return { label: 'Fără dată', color: '#6b7280', bg: '#6b728018' };
		const z = zileRamase(a.data_expirare);
		if (z <= 0)  return { label: 'Posibil exp.',              color: '#ef4444', bg: '#ef444418' };
		if (z === 1) return { label: 'Mâine',                     color: '#ef4444', bg: '#ef444418' };
		if (z <= 7)  return { label: `${z}z`,                     color: '#ef4444', bg: '#ef444418' };
		if (z <= 30) return { label: `${z}z`,                     color: '#f59e0b', bg: '#f59e0b18' };
		return             { label: formatDataScurt(a.data_expirare), color: '#22c55e', bg: '#22c55e18' };
	}

	function toggleEdit(masinaId: number, tip: string) {
		if (editMasinaId === masinaId && !editPersonal && editTip === tip) {
			editMasinaId = null; editTip = null; return;
		}
		editMasinaId = masinaId;
		editPersonal = false;
		editTip      = tip;
		editError    = '';
		editSuccess  = '';
	}

	async function handleSave(masinaId: number, tip: string, data: string, zile: number, thresholds: number[] | null) {
		editSaving = true; editError = ''; editSuccess = '';
		try {
			const masina = masine.find(m => m.id === masinaId);
			if (!masina) { editError = 'Mașina nu a fost găsită.'; return; }
			const saved = await api.saveAlerta(masinaId, {
				tip, data_expirare: data || null, zile_inainte: zile, thresholds,
			});
			const full: AlertaMasinaFull = {
				...saved,
				masina_id:           masinaId,
				numar_inmatriculare: masina.numar_inmatriculare,
				marca:               masina.marca,
				model:               masina.model,
			};
			alerte = [...alerte.filter(a => !(a.masina_id === masinaId && a.tip === tip)), full];
			summary = await api.alertSummary().catch(() => summary);
			editSuccess = 'Salvat. Te anunțăm la timp.';
			// închidere automată după scurt delay (lăsă utilizatorul să vadă confirmarea)
			setTimeout(() => {
				if (editMasinaId === masinaId && editTip === tip) {
					editTip = null; editMasinaId = null; editSuccess = '';
				}
			}, 1200);
		} catch (e: any) {
			editError = e.message ?? 'Eroare la salvare.';
		} finally {
			editSaving = false;
		}
	}

	// ── Alerte personale globale ──────────────────────────────────────────────

	async function handleCreatePersonal(
		label: string, icon: string, data: string, zile: number, thresholds: number[] | null
	) {
		editSaving = true; editError = ''; editSuccess = '';
		try {
			const saved = await api.savePersonalAlerta({
				tip:           'custom',
				custom_label:  label,
				custom_icon:   icon,
				data_expirare: data || null,
				zile_inainte:  zile,
				thresholds,
			});
			const full: AlertaMasinaFull = {
				...saved,
				masina_id:           null,
				numar_inmatriculare: null,
				marca:               null,
				model:               null,
			};
			alerte = [...alerte.filter(a => !(a.masina_id === null && a.tip === saved.tip)), full];
			summary = await api.alertSummary().catch(() => summary);
			editSuccess = 'Te anunțăm înainte să expire.';
			setTimeout(() => {
				if (editPersonal && editTip === 'new-custom') {
					editPersonal = false; editTip = null; editSuccess = '';
				}
			}, 1400);
		} catch (e: any) {
			editError = e.message ?? 'Eroare la salvare.';
		} finally {
			editSaving = false;
		}
	}

	async function handleSavePersonal(tip: string, data: string, zile: number, thresholds: number[] | null) {
		editSaving = true; editError = ''; editSuccess = '';
		try {
			const existing = getPersonalAlerta(tip);
			const saved = await api.savePersonalAlerta({
				tip,
				custom_label:  existing?.custom_label ?? '',
				custom_icon:   existing?.custom_icon ?? '',
				data_expirare: data || null,
				zile_inainte:  zile,
				thresholds,
			});
			const full: AlertaMasinaFull = {
				...saved,
				masina_id:           null,
				numar_inmatriculare: null,
				marca:               null,
				model:               null,
			};
			alerte = [...alerte.filter(a => !(a.masina_id === null && a.tip === tip)), full];
			summary = await api.alertSummary().catch(() => summary);
			editSuccess = 'Salvat. Te anunțăm la timp.';
			setTimeout(() => {
				if (editPersonal && editTip === tip) {
					editPersonal = false; editTip = null; editSuccess = '';
				}
			}, 1200);
		} catch (e: any) {
			editError = e.message ?? 'Eroare la salvare.';
		} finally {
			editSaving = false;
		}
	}

	async function handleTogglePersonalActiva(tip: string, next: boolean) {
		const existing = getPersonalAlerta(tip);
		if (!existing) return;
		editToggling = true; editError = ''; editSuccess = '';
		try {
			const updated = await api.updatePersonalAlertaSettings(existing.id, { activa: next });
			alerte = alerte.map(a =>
				a.masina_id === null && a.tip === tip ? { ...a, ...updated } : a
			);
			summary = await api.alertSummary().catch(() => summary);
			editSuccess = next ? 'Notificări activate.' : 'Notificări oprite.';
			setTimeout(() => { editSuccess = ''; }, 1500);
		} catch (e: any) {
			editError = e.message ?? 'Nu am putut actualiza setarea.';
		} finally {
			editToggling = false;
		}
	}

	async function handleDeletePersonal(tip: string) {
		const existing = getPersonalAlerta(tip);
		if (!existing) { editPersonal = false; editTip = null; return; }
		const label = existing.custom_label ?? 'această alertă personală';
		if (!confirm(`Sigur vrei să ștergi „${label}"?`)) return;
		try {
			await api.deletePersonalAlerta(existing.id);
			alerte = alerte.filter(a => !(a.masina_id === null && a.tip === tip));
			editPersonal = false; editTip = null;
			summary = await api.alertSummary().catch(() => summary);
		} catch (e: any) {
			editError = e.message ?? 'Eroare.';
		}
	}

	async function handleRenamePersonal(tip: string, label: string, icon: string) {
		const existing = getPersonalAlerta(tip);
		if (!existing) throw new Error('Alerta nu a fost găsită.');
		const updated = await api.updatePersonalAlertaSettings(existing.id, {
			custom_label: label,
			custom_icon:  icon,
		});
		alerte = alerte.map(a =>
			a.masina_id === null && a.tip === tip ? { ...a, ...updated } : a
		);
		summary = await api.alertSummary().catch(() => summary);
	}

	// ──────────────────────────────────────────────────────────────────────────

	async function handleRenameCustom(masinaId: number, tip: string, label: string, icon: string) {
		const existing = getAlerta(masinaId, tip);
		if (!existing) throw new Error('Alerta nu a fost găsită.');
		const updated = await api.updateAlertaSettings(masinaId, existing.id, {
			custom_label: label,
			custom_icon:  icon,
		});
		alerte = alerte.map(a =>
			a.masina_id === masinaId && a.tip === tip
				? { ...a, ...updated }
				: a
		);
		summary = await api.alertSummary().catch(() => summary);
	}

	async function handleToggleActiva(masinaId: number, tip: string, next: boolean) {
		const existing = getAlerta(masinaId, tip);
		if (!existing) return;
		editToggling = true; editError = ''; editSuccess = '';
		try {
			const updated = await api.updateAlertaSettings(masinaId, existing.id, { activa: next });
			alerte = alerte.map(a =>
				a.masina_id === masinaId && a.tip === tip
					? { ...a, ...updated }
					: a
			);
			summary = await api.alertSummary().catch(() => summary);
			editSuccess = next ? 'Notificări activate.' : 'Notificări oprite.';
			setTimeout(() => { editSuccess = ''; }, 1500);
		} catch (e: any) {
			editError = e.message ?? 'Nu am putut actualiza setarea.';
		} finally {
			editToggling = false;
		}
	}

	async function handleDelete(masinaId: number, tip: string) {
		const existing = getAlerta(masinaId, tip);
		if (!existing) { editTip = null; editMasinaId = null; return; }
		// Confirmare doar pentru alertele custom — datele sunt introduse manual de user
		// și nu se pot recupera dintr-un sistem extern.
		if (isCustomTip(tip)) {
			const label = existing.custom_label ?? 'această alertă personalizată';
			if (!confirm(`Sigur vrei să ștergi „${label}"?`)) return;
		}
		try {
			await api.deleteAlerta(masinaId, existing.id);
			alerte = alerte.filter(a => !(a.masina_id === masinaId && a.tip === tip));
			editTip = null; editMasinaId = null;
			summary = await api.alertSummary().catch(() => summary);
		} catch (e: any) {
			editError = e.message ?? 'Eroare.';
		}
	}

	// Acceptă recomandarea noastră: salvează data găsită, clientul rămâne owner
	async function acceptaRecomandare(masinaId: number | null, tip: string, wmsDate: string) {
		if (!masinaId) return;
		const key = `${masinaId}_${tip}`;
		editSaving = true;
		recError = { ...recError, [key]: '' };
		if (editMasinaId === masinaId && editTip === tip) editError = '';
		try {
			const masina   = masine.find(m => m.id === masinaId);
			if (!masina) throw new Error('Mașina nu a fost găsită.');
			const existing = getAlerta(masinaId, tip);
			const saved    = await api.saveAlerta(masinaId, {
				tip,
				data_expirare: wmsDate || null,
				zile_inainte:  existing?.zile_inainte ?? 30,
				thresholds:    existing?.thresholds ?? null,
			});
			const full: AlertaMasinaFull = {
				...saved,
				masina_id:           masinaId,
				numar_inmatriculare: masina.numar_inmatriculare,
				marca:               masina.marca,
				model:               masina.model,
			};
			alerte   = [...alerte.filter(a => !(a.masina_id === masinaId && a.tip === tip)), full];
			summary  = await api.alertSummary().catch(() => summary);
			if (editMasinaId === masinaId && editTip === tip) {
				editTip = null; editMasinaId = null;
			}
		} catch (e: any) {
			const msg = e.message ?? 'Eroare la actualizare.';
			recError = { ...recError, [key]: msg };
			if (editMasinaId === masinaId && editTip === tip) editError = msg;
		} finally {
			editSaving = false;
		}
	}
</script>

<div class="flex flex-col gap-4 pb-6 alerte-page" class:alerte-page-shifted={editOpen}>

	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold" style="color: var(--text)">Alertele mele</h1>
			<p class="text-xs mt-0.5" style="color: var(--muted)">Îți reamintim din timp — tu decizi.</p>
		</div>
		{#if !loading && totalAlerte > 0}
			<span class="text-xs font-semibold px-2.5 py-1 rounded-full"
				style="background: #ef444420; color: #ef4444">{totalAlerte} active</span>
		{/if}
	</div>

	{#if loading}
		<div class="space-y-2">
			{#each Array(4) as _}
				<div class="h-14 rounded-2xl border animate-pulse"
					style="background: var(--surface); border-color: var(--border);"></div>
			{/each}
		</div>

	{:else}

		<!-- ── Notificări service ── -->
		{#if notificari.length > 0}
			<div class="rounded-2xl overflow-hidden" style="background: var(--surface); border: 1px solid var(--border);">
				<div class="flex items-center justify-between px-4 py-2.5 border-b"
					style="border-color: var(--border); background: var(--surface2);">
					<p class="text-[10px] font-bold uppercase tracking-widest" style="color: var(--muted)">🔔 Notificări service</p>
					{#if notificari.some(n => !n.citita)}
						<button onclick={marcheazaTotul} class="text-[10px] font-semibold" style="color: var(--accent)">
							Marchează toate citite
						</button>
					{/if}
				</div>
				<div class="divide-y" style="divide-color: var(--border);">
					{#each notificari as n (n.id)}
						{@const tipIcon = n.tip === 'deviz' ? '📋' : n.tip === 'chat' ? '💬' : n.tip === 'status_wo' ? '🔧' : '🔔'}
						<div class="flex items-start gap-3 px-4 py-3"
							style="background: {n.citita ? 'transparent' : 'var(--accent)06'}; opacity: {stergNotif === n.id ? '0.4' : '1'};">
							<span class="text-lg shrink-0 mt-0.5">{tipIcon}</span>
							<div class="flex-1 min-w-0">
								{#if n.link}
									<a href={n.link} class="text-sm font-semibold block" style="color: var(--text); text-decoration: none;">
										{n.titlu}
										{#if !n.citita}<span class="inline-block w-1.5 h-1.5 rounded-full ml-1.5 mb-0.5" style="background: var(--accent);"></span>{/if}
									</a>
								{:else}
									<p class="text-sm font-semibold" style="color: var(--text);">
										{n.titlu}
										{#if !n.citita}<span class="inline-block w-1.5 h-1.5 rounded-full ml-1.5 mb-0.5" style="background: var(--accent);"></span>{/if}
									</p>
								{/if}
								<p class="text-xs mt-0.5" style="color: var(--muted)">{n.mesaj}</p>
							</div>
							<button onclick={() => stergeNotificare(n.id)}
								class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5"
								style="background: var(--surface2); color: var(--muted);">×</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ── Alerte cont ── -->
		{#each alerteCont as a}
			{#if a}
				{#if a.href}
					<a href={a.href}
						class="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-opacity active:opacity-70"
						style="background: {a.bg}; border: 1px solid {a.border}; text-decoration: none;">
						<span class="text-xl shrink-0">{a.icon}</span>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-semibold" style="color: {a.color}">{a.label}</p>
							<p class="text-xs" style="color: var(--muted)">{a.desc}</p>
						</div>
						<span style="color: {a.color}">→</span>
					</a>
				{:else}
					<div class="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
						style="background: {a.bg}; border: 1px solid {a.border};">
						<span class="text-xl shrink-0">{a.icon}</span>
						<div class="flex-1 min-w-0">
							<p class="text-sm font-semibold" style="color: {a.color}">{a.label}</p>
							<p class="text-xs" style="color: var(--muted)">{a.desc}</p>
						</div>
					</div>
				{/if}
			{/if}
		{/each}

		<!-- ── Necesită atenție ── -->
		{#if urgente.length > 0}
			<div>
				<p class="text-[10px] font-bold uppercase tracking-widest mb-2 px-0.5" style="color: #ef4444">⚠ Necesită atenție</p>
				<div class="rounded-2xl overflow-hidden" style="border: 1px solid #ef444330;">
					{#each urgente as item, i}
						{@const s = itemStyle(item.severitate)}
						<div class="flex flex-col gap-2 px-4 py-3 {i > 0 ? 'border-t' : ''}"
							style="background: {s.bg}; border-color: {s.border};">
							<div class="flex items-center gap-3">
								<span class="text-xl shrink-0">{item.custom_icon ?? ICOANE[item.tip] ?? '🔔'}</span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<p class="text-sm font-semibold" style="color: {s.color}">{item.label}</p>
										<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
											style="background: {s.badge}; color: {s.color}">{badgeLabel(item)}</span>
									</div>
									<p class="text-xs mt-0.5" style="color: var(--muted)">
										{item.numar_inmatriculare ?? ''}{item.numar_inmatriculare && item.data_expirare ? ' · ' : ''}{formatData(item.data_expirare)}
									</p>
									{#if item.expirat}
										<p class="text-[11px] mt-1 italic" style="color: #ef4444">Este posibil să fie expirat — verifică rapid.</p>
									{/if}
								</div>
								{#if item.cta && CTA_LINKS[item.cta.label]}
									<a href={CTA_LINKS[item.cta.label]}
										class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap"
										style="background: {s.color}; color: white; text-decoration: none;">
										{item.cta.label}
									</a>
								{/if}
							</div>
							{#if item.has_conflict && item.wms_date && item.client_date}
								{@const rkey = `${item.masina_id}_${item.tip}`}
								<div class="pl-9 space-y-1">
									<AlertRecommendation
										document={item}
										onapply={() => acceptaRecomandare(item.masina_id, item.tip, item.wms_date!)}
										saving={editSaving}
									/>
									{#if recError[rkey]}
										<p class="text-xs" style="color: #ef4444">{recError[rkey]}</p>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ── Expiră în curând ── -->
		{#if curand.length > 0}
			<div>
				<p class="text-[10px] font-bold uppercase tracking-widest mb-2 px-0.5" style="color: #f59e0b">⏳ Expiră în curând</p>
				<div class="rounded-2xl overflow-hidden" style="border: 1px solid var(--border);">
					{#each curand as item, i}
						{@const s = itemStyle(item.severitate)}
						<div class="flex flex-col gap-2 px-4 py-3 {i > 0 ? 'border-t' : ''}"
							style="background: var(--surface); border-color: var(--border);">
							<div class="flex items-center gap-3">
								<span class="text-xl shrink-0">{item.custom_icon ?? ICOANE[item.tip] ?? '🔔'}</span>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<p class="text-sm font-semibold" style="color: var(--text)">{item.label}</p>
										<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
											style="background: {s.badge}; color: {s.color}">{badgeLabel(item)}</span>
									</div>
									<p class="text-xs mt-0.5" style="color: var(--muted)">
										{item.numar_inmatriculare ?? ''}{item.numar_inmatriculare && item.data_expirare ? ' · ' : ''}{formatData(item.data_expirare)}
									</p>
									<p class="text-[11px] mt-1 italic" style="color: #f59e0b">Se apropie de expirare — verifică dacă data este corectă.</p>
								</div>
								{#if item.cta && CTA_LINKS[item.cta.label]}
									<a href={CTA_LINKS[item.cta.label]}
										class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap"
										style="background: #f59e0b; color: white; text-decoration: none;">
										{item.cta.label}
									</a>
								{/if}
							</div>
							{#if item.has_conflict && item.wms_date && item.client_date}
								{@const rkey = `${item.masina_id}_${item.tip}`}
								<div class="pl-9 space-y-1">
									<AlertRecommendation
										document={item}
										onapply={() => acceptaRecomandare(item.masina_id, item.tip, item.wms_date!)}
										saving={editSaving}
									/>
									{#if recError[rkey]}
										<p class="text-xs" style="color: #ef4444">{recError[rkey]}</p>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- ── Carduri documente per mașină ── -->
		{#if masine.length === 0}
			<div class="flex flex-col items-center justify-center py-16 gap-3 text-center">
				<span class="text-5xl">🚘</span>
				<p class="text-base font-semibold" style="color: var(--text)">Nicio mașină înregistrată</p>
				<p class="text-sm" style="color: var(--muted)">Contactează NLG pentru a adăuga o mașină în cont.</p>
			</div>
		{/if}

		{#each masine as masina}
			<div class="space-y-3">

				{#if masine.length > 1}
					<p class="text-sm font-semibold px-0.5" style="color: var(--text)">
						🚘 {masina.marca} {masina.model}
						<span class="font-mono font-normal" style="color: var(--muted)">· {masina.numar_inmatriculare}</span>
					</p>
				{/if}

				<!-- Scrollable card row — long-press to drag & reorder -->
				<div class="cards-row flex gap-3 overflow-x-auto pb-1" style="scrollbar-width: none; -ms-overflow-style: none;"
					use:sortable={{ key: 'docs-remindere', idAttr: 'data-tip', direction: 'horizontal' }}>

					{#each orderedDocs as doc (doc.tip)}
						{@const isOpen = editMasinaId === masina.id && editTip === doc.tip}
						{@const badge = cardBadge(masina.id, doc.tip)}
						{@const hue = hueFor(doc.tip)}
						<button data-tip={doc.tip}
							onclick={() => toggleEdit(masina.id, doc.tip)}
							class="doc-card flex-none rounded-2xl"
							class:doc-card-active={isOpen}
							class:doc-card-empty={!badge}
							style="--hue: {hue};">
							<span class="doc-icon-wrap">
								<span class="doc-icon-halo"></span>
								<span class="doc-icon">{doc.icon}</span>
							</span>
							<span class="doc-label">{doc.label}</span>
							{#if badge}
								<span class="doc-badge" style="--bg: {badge.bg}; --fg: {badge.color}">{badge.label}</span>
							{:else}
								<span class="doc-add">+ adaugă</span>
							{/if}
						</button>
					{/each}

					{#each customAlerteForMasina(masina.id) as a (a.id)}
						{@const isOpen = editMasinaId === masina.id && editTip === a.tip}
						{@const badge = cardBadge(masina.id, a.tip)}
						<button data-tip={a.tip}
							onclick={() => toggleEdit(masina.id, a.tip)}
							class="doc-card flex-none rounded-2xl"
							class:doc-card-active={isOpen}
							class:doc-card-empty={!badge}
							style="--hue: #a855f7;">
							<span class="doc-icon-wrap">
								<span class="doc-icon-halo"></span>
								<span class="doc-icon">{a.custom_icon ?? '🔔'}</span>
							</span>
							<span class="doc-label">{a.custom_label ?? 'Alertă'}</span>
							{#if badge}
								<span class="doc-badge" style="--bg: {badge.bg}; --fg: {badge.color}">{badge.label}</span>
							{:else}
								<span class="doc-add">—</span>
							{/if}
						</button>
					{/each}

					<button onclick={() => openCustomCreate(masina.id)}
						class="doc-card doc-card-new flex-none rounded-2xl"
						class:doc-card-active={editMasinaId === masina.id && editTip === 'new-custom'}>
						<span class="doc-icon-wrap">
							<span class="doc-icon-halo"></span>
							<span class="doc-icon doc-icon-plus">+</span>
						</span>
						<span class="doc-label">Alertă</span>
						<span class="doc-add">nouă</span>
					</button>

				</div>

				{#if customAlerteForMasina(masina.id).length === 0 && !(editMasinaId === masina.id && editTip === 'new-custom')}
					<p class="text-[11px] px-1 -mt-1" style="color: var(--muted)">
						💡 Lipsește o alertă? Apasă <span style="color: var(--accent); font-weight: 600">+</span> și creează una (ex: extinctor, trusă, revizie personală).
					</p>
				{/if}

			</div>
		{/each}

		<!-- ── Alerte personale globale ── -->
		<div class="space-y-3">
			<p class="text-sm font-semibold px-0.5" style="color: var(--text)">
				✨ Alerte personale
				<span class="font-normal text-xs" style="color: var(--muted)">· nu țin de o anumită mașină</span>
			</p>

			<div class="cards-row flex gap-3 overflow-x-auto pb-1" style="scrollbar-width: none; -ms-overflow-style: none;">
				<!-- Predefinite personale: Buletin + Permis -->
				{#each DOC_PERSONALE as doc (doc.tip)}
					{@const isOpen = editPersonal && editTip === doc.tip}
					{@const badge = cardBadge(null, doc.tip)}
					{@const hue = hueFor(doc.tip)}
					<button data-tip={doc.tip}
						onclick={() => togglePersonalEdit(doc.tip)}
						class="doc-card flex-none rounded-2xl"
						class:doc-card-active={isOpen}
						class:doc-card-empty={!badge}
						style="--hue: {hue};">
						<span class="doc-icon-wrap">
							<span class="doc-icon-halo"></span>
							<span class="doc-icon">{doc.icon}</span>
						</span>
						<span class="doc-label">{doc.label}</span>
						{#if badge}
							<span class="doc-badge" style="--bg: {badge.bg}; --fg: {badge.color}">{badge.label}</span>
						{:else}
							<span class="doc-add">+ adaugă</span>
						{/if}
					</button>
				{/each}

				<!-- Alerte personale custom -->
				{#each personalAlerte as a (a.id)}
					{@const isOpen = editPersonal && editTip === a.tip}
					{@const badge  = cardBadge(null, a.tip)}
					<button data-tip={a.tip}
						onclick={() => togglePersonalEdit(a.tip)}
						class="doc-card flex-none rounded-2xl"
						class:doc-card-active={isOpen}
						class:doc-card-empty={!badge}
						style="--hue: #ec4899;">
						<span class="doc-icon-wrap">
							<span class="doc-icon-halo"></span>
							<span class="doc-icon">{a.custom_icon ?? '🔔'}</span>
						</span>
						<span class="doc-label">{a.custom_label ?? 'Alertă'}</span>
						{#if badge}
							<span class="doc-badge" style="--bg: {badge.bg}; --fg: {badge.color}">{badge.label}</span>
						{:else}
							<span class="doc-add">—</span>
						{/if}
					</button>
				{/each}

				<button onclick={openPersonalCreate}
					class="doc-card doc-card-new flex-none rounded-2xl"
					class:doc-card-active={editPersonal && editTip === 'new-custom'}>
					<span class="doc-icon-wrap">
						<span class="doc-icon-halo"></span>
						<span class="doc-icon doc-icon-plus">+</span>
					</span>
					<span class="doc-label">Alertă</span>
					<span class="doc-add">nouă</span>
				</button>
			</div>

			{#if personalAlerte.length === 0 && !(editPersonal && editTip === 'new-custom')}
				<p class="text-[11px] px-1" style="color: var(--muted)">
					💡 Pentru lucruri care nu țin de o mașină — extinctor, trusă, controale medicale, abonamente.
				</p>
			{/if}

		</div>


	{/if}
</div>

<svelte:window onkeydown={onEditKeydown} />

<!-- ═══════════════════════════════════════════════════ -->
<!-- Bottom sheet / side card pentru editare alertă -->
<!-- ═══════════════════════════════════════════════════ -->
{#if editOpen}
	<div class="alerta-overlay" role="presentation" onclick={closeEdit}></div>
	<div class="alerta-modal" role="dialog" aria-modal="true" aria-label="Editare alertă">
		<button type="button" onclick={closeEdit}
			class="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10"
			style="background: var(--surface); border: 1px solid var(--border); color: var(--muted)"
			aria-label="Închide">✕</button>

		<div class="alerta-modal-body">
			{#if editPersonal && editTip === 'new-custom'}
				<AlertCustomCreateCard
					saving={editSaving}
					error={editError}
					success={editSuccess}
					onSave={(label, icon, data, zile, thresholds) =>
						handleCreatePersonal(label, icon, data, zile, thresholds)}
					onCancel={closeEdit}
				/>
			{:else if editPersonal && editTip}
				{@const isCustom    = isCustomTip(editTip)}
				{@const docPredef   = DOC_PERSONALE.find(d => d.tip === editTip)}
				{@const existing    = getPersonalAlerta(editTip)}
				{@const summaryDoc  = summary?.documents?.find(d => d.tip === editTip && d.masina_id === null)}
				{@const info        = isCustom ? undefined : DOC_INFO[editTip ?? '']}
				{@const dispLabel   = isCustom ? (existing?.custom_label ?? 'Alertă') : (docPredef?.label ?? editTip ?? '')}
				{@const dispIcon    = isCustom ? (existing?.custom_icon ?? '🔔') : (docPredef?.icon ?? '🔔')}
				<AlertDocumentCard
					{summaryDoc}
					existingData={existing?.data_expirare?.split('T')[0] ?? ''}
					existingZile={existing?.zile_inainte ?? 30}
					existingActiva={existing?.activa ?? true}
					existingThresholds={existing?.thresholds ?? null}
					hasExisting={!!existing}
					{isCustom}
					docInfo={info}
					docLabel={dispLabel}
					docIcon={dispIcon}
					saving={editSaving}
					toggling={editToggling}
					error={editError}
					success={editSuccess}
					onSave={(data, zile, thresholds) => handleSavePersonal(editTip!, data, zile, thresholds)}
					onApplyRecommendation={() => {}}
					onDelete={() => handleDeletePersonal(editTip!)}
					onToggleActiva={(next) => handleTogglePersonalActiva(editTip!, next)}
					onRenameCustom={(label, icon) => handleRenamePersonal(editTip!, label, icon)}
				/>
			{:else if editMasina && editTip === 'new-custom'}
				<AlertCustomCreateCard
					saving={editSaving}
					error={editError}
					success={editSuccess}
					onSave={(label, icon, data, zile, thresholds) =>
						handleCreateCustom(editMasina.id, label, icon, data, zile, thresholds)}
					onCancel={closeEdit}
				/>
			{:else if editMasina && editTip}
				{@const isCustom   = isCustomTip(editTip)}
				{@const docActiv   = TOATE_DOC.find(d => d.tip === editTip)}
				{@const existing   = getAlerta(editMasina.id, editTip)}
				{@const info       = isCustom ? undefined : DOC_INFO[editTip ?? '']}
				{@const summaryDoc = summary?.documents?.find(d => d.tip === editTip && (d.masina_id === editMasina.id || d.masina_id === null))}
				{@const dispLabel  = isCustom ? (existing?.custom_label ?? 'Alertă') : (docActiv?.label ?? editTip ?? '')}
				{@const dispIcon   = isCustom ? (existing?.custom_icon ?? '🔔') : (docActiv?.icon ?? '🔔')}
				<AlertDocumentCard
					{summaryDoc}
					existingData={existing?.data_expirare?.split('T')[0] ?? ''}
					existingZile={existing?.zile_inainte ?? 30}
					existingActiva={existing?.activa ?? true}
					existingThresholds={existing?.thresholds ?? null}
					hasExisting={!!existing}
					{isCustom}
					docInfo={info}
					docLabel={dispLabel}
					docIcon={dispIcon}
					saving={editSaving}
					toggling={editToggling}
					error={editError}
					success={editSuccess}
					onSave={(data, zile, thresholds) => handleSave(editMasina.id, editTip!, data, zile, thresholds)}
					onApplyRecommendation={(wmsDate) => acceptaRecomandare(editMasina.id, editTip!, wmsDate)}
					onDelete={() => handleDelete(editMasina.id, editTip!)}
					onToggleActiva={(next) => handleToggleActiva(editMasina.id, editTip!, next)}
					onRenameCustom={isCustom ? (label, icon) => handleRenameCustom(editMasina.id, editTip!, label, icon) : undefined}
				/>
			{/if}
		</div>
	</div>
{/if}

<style>
	.alerta-overlay {
		position: fixed;
		inset: 0;
		background: rgba(8, 8, 18, 0.18);
		z-index: 60;
		animation: alertaFadeIn 0.18s ease-out;
	}
	.alerta-modal {
		position: fixed;
		left: 50%;
		bottom: 0;
		transform: translateX(-50%);
		width: min(560px, 100vw);
		max-height: 92vh;
		overflow: hidden;
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 35%),
			var(--surface);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
		border-bottom: none;
		border-radius: 22px 22px 0 0;
		box-shadow:
			0 1px 0 rgba(255,255,255,0.06) inset,
			0 -16px 40px -12px rgba(0,0,0,0.55);
		z-index: 61;
		animation: alertaSheetIn 0.32s cubic-bezier(0.32, 1.4, 0.5, 1);
		display: flex;
		flex-direction: column;
		padding-bottom: env(safe-area-inset-bottom);
	}
	.alerta-modal::before {
		content: '';
		display: block;
		width: 36px;
		height: 4px;
		border-radius: 2px;
		background: rgba(255,255,255,0.18);
		margin: 8px auto 0;
		flex-shrink: 0;
	}
	.alerta-modal-body {
		overflow-y: auto;
		padding: 14px 22px 22px;
		scrollbar-width: none;
	}
	.alerta-modal-body::-webkit-scrollbar { display: none; }
	@keyframes alertaFadeIn {
		from { opacity: 0; }
		to   { opacity: 1; }
	}
	@keyframes alertaSheetIn {
		from { transform: translate(-50%, 100%); }
		to   { transform: translate(-50%, 0); }
	}
	/* === Carduri document — premium 2026 === */
	/* Padding pe rândul-părinte ca să nu fie tăiate halo-urile/box-shadow.
	   Rezervă spațiu și sus, jos, dreapta — fără negative margin, ca să nu se suprapună cu textul. */
	:global(.cards-row) {
		padding: 8px 8px 12px 2px !important;
	}

	.doc-card {
		--hue: #6366f1;
		position: relative;
		isolation: isolate;
		overflow: hidden;
		width: 84px;
		padding: 12px 6px 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		background:
			radial-gradient(120% 140% at 50% 0%, color-mix(in srgb, var(--hue) 18%, transparent) 0%, transparent 55%),
			linear-gradient(180deg, color-mix(in srgb, var(--hue) 5%, var(--surface)) 0%, var(--surface) 100%);
		border: 1px solid color-mix(in srgb, var(--hue) 22%, var(--border));
		box-shadow:
			0 1px 0 rgba(255,255,255,0.04) inset,
			0 6px 16px -10px color-mix(in srgb, var(--hue) 70%, transparent);
		transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
	}
	.doc-card::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(110deg, transparent 35%, color-mix(in srgb, var(--hue) 30%, #fff 8%) 50%, transparent 65%);
		transform: translateX(-110%);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
		mix-blend-mode: overlay;
	}
	.doc-card:hover {
		transform: translateY(-3px);
		border-color: color-mix(in srgb, var(--hue) 55%, var(--border));
		box-shadow:
			0 1px 0 rgba(255,255,255,0.06) inset,
			0 14px 26px -12px color-mix(in srgb, var(--hue) 80%, transparent),
			0 0 0 1px color-mix(in srgb, var(--hue) 35%, transparent);
	}
	.doc-card:hover::after {
		opacity: 1;
		animation: docShimmer 0.9s ease-out;
	}
	@keyframes docShimmer {
		from { transform: translateX(-110%); }
		to   { transform: translateX(110%); }
	}
	.doc-card:active { transform: scale(0.96); }

	.doc-icon-wrap {
		position: relative;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 14px;
		background: linear-gradient(135deg, color-mix(in srgb, var(--hue) 22%, transparent), color-mix(in srgb, var(--hue) 6%, transparent));
		border: 1px solid color-mix(in srgb, var(--hue) 30%, transparent);
	}
	.doc-icon-halo {
		position: absolute;
		inset: -2px;
		border-radius: inherit;
		background: radial-gradient(circle, color-mix(in srgb, var(--hue) 45%, transparent) 0%, transparent 65%);
		filter: blur(8px);
		opacity: 0.6;
		z-index: -1;
		transition: opacity 0.3s ease, filter 0.3s ease;
	}
	.doc-card:hover .doc-icon-halo { opacity: 0.9; filter: blur(12px); }
	.doc-icon {
		font-size: 20px;
		line-height: 1;
		filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
	}
	.doc-icon-plus {
		font-size: 24px;
		font-weight: 300;
		color: var(--hue, var(--accent));
	}

	.doc-label {
		font-size: 11px;
		font-weight: 600;
		text-align: center;
		line-height: 1.15;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
		letter-spacing: 0.01em;
	}

	.doc-badge {
		font-size: 9px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 999px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		background: var(--bg);
		color: var(--fg);
		border: 1px solid color-mix(in srgb, var(--fg) 35%, transparent);
		box-shadow: 0 0 8px color-mix(in srgb, var(--fg) 25%, transparent);
		letter-spacing: 0.02em;
	}
	.doc-add {
		font-size: 10px;
		font-weight: 600;
		color: color-mix(in srgb, var(--hue) 60%, var(--muted));
		opacity: 0.8;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	/* Active (modal deschis pentru acest card) */
	.doc-card-active {
		--hue: var(--accent, #3b82f6);
		border-color: var(--accent) !important;
		background:
			radial-gradient(120% 140% at 50% 0%, color-mix(in srgb, var(--accent) 32%, transparent) 0%, transparent 55%),
			linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, var(--surface)) 0%, var(--surface) 100%) !important;
		box-shadow:
			0 1px 0 rgba(255,255,255,0.10) inset,
			0 14px 26px -10px color-mix(in srgb, var(--accent) 70%, transparent),
			0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent) !important;
		animation: docPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes docPop {
		0%   { transform: scale(0.94); }
		60%  { transform: scale(1.03); }
		100% { transform: scale(1); }
	}

	/* Card "Alertă nouă" — dashed gradient border + glow accent */
	.doc-card-new {
		background: transparent;
		border: 1.5px dashed color-mix(in srgb, var(--accent) 50%, var(--border));
		--hue: var(--accent, #3b82f6);
	}
	.doc-card-new .doc-icon-wrap {
		background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, transparent), transparent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.doc-card-new .doc-label,
	.doc-card-new .doc-add {
		color: var(--accent);
	}
	.doc-card-new:hover {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 5%, transparent);
	}

	/* Empty state — un strop mai stins */
	.doc-card-empty .doc-icon { opacity: 0.85; }

	@media (prefers-reduced-motion: reduce) {
		.doc-card, .doc-card::after, .doc-card-active, .doc-icon-halo {
			animation: none;
			transition: none;
		}
	}

	/* Pe desktop, când modalul e deschis, mutăm <main> de la mx-auto la stânga,
	   ca modalul (right:24px, 440px) să aibă spațiu fără să acopere cardurile. */
	@media (min-width: 900px) {
		:global(body.alerta-modal-open main) {
			margin-left: 24px !important;
			margin-right: auto !important;
			transition: margin 0.32s cubic-bezier(0.32, 1.4, 0.5, 1);
		}
		:global(main) {
			transition: margin 0.32s cubic-bezier(0.32, 1.4, 0.5, 1);
		}

		.alerta-overlay {
			background: transparent;
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
			pointer-events: none; /* lasă click-uri pe carduri din spate */
		}
		.alerta-modal {
			left: auto;
			right: 28px;
			bottom: auto;
			top: 50%;
			transform: translateY(-50%);
			width: 480px;
			max-height: 92vh;
			border-radius: 18px;
			border: 1px solid rgba(255, 255, 255, 0.10);
			box-shadow:
				0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent),
				0 24px 64px rgba(0, 0, 0, 0.6),
				0 8px 24px rgba(0, 0, 0, 0.4),
				inset 0 1px 0 rgba(255, 255, 255, 0.06);
			animation: alertaCardIn 0.3s cubic-bezier(0.32, 1.4, 0.5, 1);
		}
		.alerta-modal::before { display: none; }
		@keyframes alertaCardIn {
			from { opacity: 0; transform: translate(20px, -50%); }
			to   { opacity: 1; transform: translate(0, -50%); }
		}
	}
</style>
