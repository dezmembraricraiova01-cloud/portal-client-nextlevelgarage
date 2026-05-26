import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
	interface Window { Pusher: typeof Pusher }
}

let echoInstance: Echo<'reverb'> | null = null;

export type EchoStatus = 'connecting' | 'connected' | 'disconnected';

const listeners = new Set<(s: EchoStatus) => void>();
let currentStatus: EchoStatus = 'connecting';

function setStatus(s: EchoStatus) {
	currentStatus = s;
	listeners.forEach(fn => fn(s));
}

export function onStatusChange(fn: (s: EchoStatus) => void) {
	listeners.add(fn);
	fn(currentStatus);
	return () => listeners.delete(fn);
}

export function getEcho(): Echo<'reverb'> {
	if (echoInstance) return echoInstance;

	window.Pusher = Pusher;

	echoInstance = new Echo({
		broadcaster:       'reverb',
		key:               import.meta.env.VITE_REVERB_APP_KEY,
		wsHost:            import.meta.env.VITE_REVERB_HOST ?? 'localhost',
		wsPort:            Number(import.meta.env.VITE_REVERB_PORT ?? 8081),
		wssPort:           Number(import.meta.env.VITE_REVERB_PORT ?? 8081),
		forceTLS:          import.meta.env.VITE_REVERB_SCHEME === 'https',
		enabledTransports: ['ws', 'wss'],
		// Auth prin proxy SvelteKit (adaugă httpOnly cookie automat)
		authEndpoint:      '/api/portal/broadcasting/auth',
	});

	const connector = (echoInstance as any).connector;

	connector?.pusher?.connection?.bind('connected',      () => setStatus('connected'));
	connector?.pusher?.connection?.bind('disconnected',   () => setStatus('disconnected'));
	connector?.pusher?.connection?.bind('unavailable',    () => setStatus('disconnected'));
	connector?.pusher?.connection?.bind('connecting',     () => setStatus('connecting'));

	return echoInstance;
}

export function destroyEcho() {
	echoInstance?.disconnect();
	echoInstance = null;
	setStatus('disconnected');
}
