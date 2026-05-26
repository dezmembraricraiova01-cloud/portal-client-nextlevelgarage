import { writable } from 'svelte/store';
import type { Client, Consilier } from './api';

// Token-ul NU mai e stocat in localStorage — sta in httpOnly cookie (setat de server).
// Pastram doar informatiile clientului (non-sensibile) pentru UI.

function createAuth() {
	let _current: Client | null = null;
	const { subscribe, set } = writable<Client | null>(null);

	function _persist(client: Client) {
		_current = client;
		localStorage.setItem('portal_client', JSON.stringify(client));
		set(client);
	}

	return {
		subscribe,
		login(client: Client) {
			_persist(client);
		},
		logout() {
			_current = null;
			localStorage.removeItem('portal_client');
			set(null);
		},
		restore() {
			try {
				const raw = localStorage.getItem('portal_client');
				if (raw) {
					_current = JSON.parse(raw);
					set(_current);
				}
			} catch {
				localStorage.removeItem('portal_client');
			}
		},
		patchConsilier(consilier: Consilier | null, consilier_inlocuitor: Consilier | null) {
			if (!_current) return;
			_persist({ ..._current, consilier, consilier_inlocuitor });
		},
		patchNotificari(necitite: number) {
			if (!_current) return;
			_persist({ ..._current, notificari_necitite: necitite });
		}
	};
}

export const auth = createAuth();

// UID-ul reparației active — setat de dashboard, citit de chat widget global
export const activeWoUid = writable<string | null>(null);

// Lista lucrărilor active (status != finalizat/livrat) — populată de layout
// pentru chat-ul global. Permite badge cu WO + nr. mașină și dropdown la 2+.
export interface ActiveWorkOrder {
	uid:    string;
	plate:  string;
	label:  string; // ex: "DJ-01-ABC · WO-..."
}
export const activeWorkOrders = writable<ActiveWorkOrder[]>([]);
