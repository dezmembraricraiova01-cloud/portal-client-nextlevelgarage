import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import './tours/tour-theme.css';

const TOUR_KEY = 'nlg_tour_v2'; // Bump v2 (tema premium + step counter)

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
 * Apelat la fiecare `show` — re-rulează dacă elementul e re-randat.
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
			modalOverlayOpeningRadius: 10,
			modalOverlayOpeningPadding: 6,
			classes: 'app-tour-step',
		},
	});

	tour.addStep({
		id: 'welcome',
		title: 'Bun venit în Garajul Meu',
		text: 'Te ghidăm rapid prin câteva funcții cheie. Durează <strong>~1 minut</strong>.',
		buttons: [
			btn('Nu acum', () => tour.cancel(), true),
			btn('Hai să vedem →', () => tour.next()),
		],
	});

	tour.addStep({
		id: 'status',
		attachTo: { element: '[data-tour="status"]', on: 'bottom' },
		title: 'Statusul mașinii tale',
		text: 'Când mașina e în service apare aici cu statusul curent, estimarea și link direct la detalii.',
		buttons: [
			btn('← Înapoi', () => tour.back(), true),
			btn('Următorul →', () => tour.next()),
		],
	});

	tour.addStep({
		id: 'actiuni',
		attachTo: { element: '[data-tour="actiuni"]', on: 'top' },
		title: 'Acces rapid',
		text: 'Fă o <strong>programare</strong>, urmărește istoricul reparațiilor sau descarcă <strong>facturi</strong> și documente.',
		buttons: [
			btn('← Înapoi', () => tour.back(), true),
			btn('Următorul →', () => tour.next()),
		],
	});

	tour.addStep({
		id: 'nav',
		attachTo: { element: '[data-tour="nav"]', on: 'top' },
		title: 'Navigare',
		text: 'Folosește bara de jos pentru a trece rapid între secțiuni.',
		buttons: [
			btn('← Înapoi', () => tour.back(), true),
			btn('Am înțeles ✓', () => tour.complete()),
		],
	});

	// Step counter + progress la fiecare schimbare
	tour.on('show', ({ tour: t, step }: any) => {
		const idx = t.steps.indexOf(step);
		injectStepMeta(step, idx, t.steps.length);
	});

	tour.on('complete', markDone);
	tour.on('cancel', markDone);

	tour.start();
}
