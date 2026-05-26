import Shepherd from 'shepherd.js';

const TOUR_KEY = 'nlg_tour_v1';

export const hasSeenTour = () =>
	typeof localStorage !== 'undefined' && localStorage.getItem(TOUR_KEY) === 'done';

const markDone = () => localStorage.setItem(TOUR_KEY, 'done');

const btn = (text: string, action: () => void, secondary = false) => ({
	text,
	action,
	classes: secondary ? 'shepherd-btn-secondary' : 'shepherd-btn-primary',
});

export function startTour() {
	if (hasSeenTour()) return;

	const tour = new Shepherd.Tour({
		useModalOverlay: true,
		defaultStepOptions: {
			cancelIcon: { enabled: true },
			scrollTo: { behavior: 'smooth', block: 'center' },
			modalOverlayOpeningRadius: 12,
			modalOverlayOpeningPadding: 6,
		},
	});

	tour.addStep({
		id: 'welcome',
		title: 'Bun venit în Garajul Meu! 👋',
		text: 'Îți arătăm rapid ce poți face în câțiva pași.',
		buttons: [
			btn('Nu acum', () => tour.cancel(), true),
			btn('Hai să vedem →', () => tour.next()),
		],
	});

	tour.addStep({
		id: 'status',
		attachTo: { element: '[data-tour="status"]', on: 'bottom' },
		title: 'Statusul mașinii tale',
		text: 'Când mașina e în service apare aici cu statusul curent, estimarea și un link direct spre detalii.',
		buttons: [
			btn('← Înapoi', () => tour.back(), true),
			btn('Următorul →', () => tour.next()),
		],
	});

	tour.addStep({
		id: 'actiuni',
		attachTo: { element: '[data-tour="actiuni"]', on: 'top' },
		title: 'Acces rapid',
		text: 'Fă o programare, urmărește istoricul reparațiilor sau descarcă facturi și documente.',
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

	tour.on('complete', markDone);
	tour.on('cancel', markDone);

	tour.start();
}
