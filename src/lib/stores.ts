import { writable } from 'svelte/store';
import type { Client } from './api';

function createAuth() {
	const { subscribe, set } = writable<Client | null>(null);

	return {
		subscribe,
		login(client: Client, token: string) {
			localStorage.setItem('portal_token', token);
			localStorage.setItem('portal_client', JSON.stringify(client));
			set(client);
		},
		logout() {
			localStorage.removeItem('portal_token');
			localStorage.removeItem('portal_client');
			set(null);
		},
		restore() {
			const raw = localStorage.getItem('portal_client');
			if (raw) set(JSON.parse(raw));
		},
		token(): string | null {
			return localStorage.getItem('portal_token');
		}
	};
}

export const auth = createAuth();
