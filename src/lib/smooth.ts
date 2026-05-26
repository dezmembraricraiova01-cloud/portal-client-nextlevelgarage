import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;
let tickerCallback: ((time: number) => void) | null = null;

export function initSmooth(): Lenis {
	// Dacă există instanță veche, curăță complet (inclusiv ticker callback orfan)
	destroySmooth();

	lenis = new Lenis({
		duration: 1.1,
		easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
		smoothWheel: true,
		touchMultiplier: 1.8,
		infinite: false,
	});

	// Lenis condus de GSAP ticker — frame perfect.
	// Pastram referinta callback-ului ca sa-l putem deinregistra la destroy
	// (altfel ramane orfan dupa navigare → null.raf loop pe pagina urmatoare).
	tickerCallback = (time: number) => {
		if (lenis) lenis.raf(time * 1000);
	};
	gsap.ticker.add(tickerCallback);
	gsap.ticker.lagSmoothing(0);

	// ScrollTrigger știe de scroll-ul Lenis
	lenis.on('scroll', ScrollTrigger.update);

	return lenis;
}

export function destroySmooth(): void {
	if (tickerCallback) {
		gsap.ticker.remove(tickerCallback);
		tickerCallback = null;
	}
	lenis?.destroy();
	lenis = null;
}

export function getLenis(): Lenis | null {
	return lenis;
}

/** Animează cu stagger toate elementele cu [data-reveal] când intră în viewport */
export function bindReveal(): void {
	// Mică întârziere pentru ca DOM-ul să fie complet
	requestAnimationFrame(() => {
		const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
		if (!els.length) return;

		els.forEach((el) => {
			const delay = parseFloat(el.dataset['delay'] ?? '0');
			// Setăm starea inițială imediat — elimină flash-ul
			gsap.set(el, { opacity: 0, y: 28, scale: 0.97 });
			gsap.to(el, {
				opacity: 1, y: 0, scale: 1,
				duration: 0.55,
				delay,
				ease: 'power3.out',
				scrollTrigger: {
					trigger: el,
					start: 'top 94%',
					once: true,
				},
			});
		});
	});
}
