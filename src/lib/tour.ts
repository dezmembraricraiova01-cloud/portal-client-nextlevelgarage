import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import './tours/tour-theme.css';

const TOUR_KEY = 'nlg_tour_v3'; // Bump v3: pași rescriși pentru UI-ul actual

export const hasSeenTour = (): boolean =>
	typeof localStorage !== 'undefined' && localStorage.getItem(TOUR_KEY) === 'done';

const markDone = (): void => {
	try { localStorage.setItem(TOUR_KEY, 'done'); } catch (e) {}
};

const btn = (text: string, action: () => void, secondary = false) => ({
	text,
	action,
	classes: secondary ? 'shepherd-btn-secondary' : 'shepherd-btn-primary',
});

/**
 * Injectează step counter + progress bar în pasul curent.
 */
function injectStepMeta(step: any, idx: number, total: number): void {
	const el: HTMLElement | undefined = step.el;
	if (!el) return;
	const header = el.querySelector('.shepherd-header');
	if (!header) return;

	let meta = el.querySelector('.tour-step-meta') as HTMLElement | null;
	if (!meta) {
		meta = document.createElement('div');
		meta.className = 'tour-step-meta';
		header.insertAdjacentElement('afterend', meta);
	}

	const pct = Math.round(((idx + 1) / total) * 100);
	meta.innerHTML = `
		<div class="tour-step-counter">Pasul <strong>${idx + 1}</strong> / ${total}</div>
		<div class="tour-progress"><div class="tour-progress-bar" style="width:${pct}%"></div></div>
	`;
}

/**
 * Pornește tour-ul dashboard. Dacă `force` e true, ignoră flag-ul "seen".
 */
export function startTour(opts: { force?: boolean } = {}): void {
	if (!opts.force && hasSeenTour()) return;

	const tour = new Shepherd.Tour({
		useModalOverlay: true,
		defaultStepOptions: {
			cancelIcon: { enabled: true },
			scrollTo: { behavior: 'smooth', block: 'center' },
			modalOverlayOpeningRadius: 12,
			modalOverlayOpeningPadding: 8,
			classes: 'app-tour-step',
		},
	});

	tour.addStep({
		id: 'welcome',
		title: 'Bun venit în Garajul Meu',
		text: 'Te ghidăm rapid prin câteva funcții cheie ale portalului. Durează <strong>~1 minut</strong> și poți să sari oricând cu <code>×</code>.',
		buttons: [
			btn('Nu acum', () => tour.cancel(), true),
			btn('Hai să vedem →', () => tour.next()),
		],
	});

	tour.addStep({
		id: 'masina',
		attachTo: { element: '[data-tour="masina"]', on: 'bottom' },
		title: 'Mașina ta și statusul',
		text: 'Aici vezi <strong>mașina principală</strong> cu statusul curent. Când e în service apar detaliile reparației și butonul <strong>Programează-te</strong> pentru o nouă vizită.',
		buttons: [
			btn('← Înapoi', () => tour.back(), true),
			btn('Următorul →', () => tour.next()),
		],
	});

	tour.addStep({
		id: 'inchirieri',
		attachTo: { element: '[data-tour="inchirieri"]', on: 'top' },
		title: 'Ai nevoie de o mașină?',
		text: 'Vezi <strong>flota de închirieri</strong> disponibilă. Alegi mașina, completezi datele și te sunăm rapid pentru confirmare.',
		buttons: [
			btn('← Înapoi', () => tour.back(), true),
			btn('Următorul →', () => tour.next()),
		],
	});

	tour.addStep({
		id: 'nav',
		attachTo: { element: '[data-tour="nav"]', on: 'top' },
		title: 'Navigare rapidă',
		text: 'Folosește bara de jos pentru a trece între <strong>Acasă</strong>, <strong>Mașini</strong>, <strong>Reparații</strong>, <strong>Călătorii</strong>, alerte și profil.',
		buttons: [
			btn('← Înapoi', () => tour.back(), true),
			btn('Următorul →', () => tour.next()),
		],
	});

	tour.addStep({
		id: 'done',
		title: 'Gata — ești pregătit',
		text: 'Acum cunoști elementele de bază din portal.<br><br>Pentru a re-vedea acest ghid oricând, apasă butonul <strong>?</strong> din colțul dreapta-jos.',
		buttons: [
			btn('← Înapoi', () => tour.back(), true),
			btn('Am înțeles ✓', () => tour.complete()),
		],
	});

	tour.on('show', ({ tour: t, step }: any) => {
		const idx = t.steps.indexOf(step);
		injectStepMeta(step, idx, t.steps.length);
	});

	tour.on('complete', markDone);
	tour.on('cancel', markDone);

	tour.start();
}
