const BASE = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';

function getToken(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem('portal_token');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'application/json'
	};

	const token = getToken();
	if (token) headers['Authorization'] = `Bearer ${token}`;

	const res = await fetch(`${BASE}/api/portal${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ message: 'Eroare necunoscută.' }));
		throw { status: res.status, message: err.message ?? 'Eroare.' };
	}

	return res.json();
}

export const api = {
	// Auth
	sendOtp: (telefon: string) =>
		request<{ message: string }>('POST', '/auth/send-otp', { telefon }),

	verifyOtp: (telefon: string, cod: string) =>
		request<{ token: string; client: Client }>('POST', '/auth/verify-otp', { telefon, cod }),

	devLogin: () =>
		request<{ token: string; client: Client }>('GET', '/auth/dev-login'),

	logout: () => request<{ message: string }>('POST', '/auth/logout'),

	me: () => request<Client>('GET', '/auth/me'),

	// Dashboard
	dashboard: () => request<DashboardData>('GET', '/dashboard'),

	// Mașini
	masini: () => request<Masina[]>('GET', '/masini'),
	masina: (id: number) => request<{ masina: Masina; reparatii: WoSummary[] }>('GET', `/masini/${id}`),
	addMasina: (data: MasinaForm) => request<Masina>('POST', '/masini', data),
	deleteMasina: (id: number) => request<{ message: string }>('DELETE', `/masini/${id}`),

	// Reparații
	reparatii: () => request<WorkOrder[]>('GET', '/reparatii'),
	reparatie: (uid: string) =>
		request<{ wo: WorkOrder; timeline: TimelineStep[]; feedback: Feedback | null }>('GET', `/reparatii/${uid}`),
	aprobaDeviz: (uid: string) => request<{ message: string }>('POST', `/reparatii/${uid}/aproba-deviz`),
	refuzaDeviz: (uid: string) => request<{ message: string }>('POST', `/reparatii/${uid}/refuza-deviz`),
	intrebareDeviz: (uid: string, mesaj: string) =>
		request<{ message: string }>('POST', `/reparatii/${uid}/intrebare-deviz`, { mesaj }),

	// Programări
	programariConfig: () => request<{ ore: string[]; masini: MasiniMini[] }>('GET', '/programari/config'),
	programari: () => request<Programare[]>('GET', '/programari'),
	addProgramare: (data: ProgramareForm) => request<Programare>('POST', '/programari', data),

	// Documente
	documente: () => request<Factura[]>('GET', '/documente'),
	documentPdfUrl: (id: number) => `${BASE}/api/portal/documente/${id}/pdf`
};

// Types
export interface Client {
	id: number;
	nume: string;
	telefon: string;
	email: string | null;
}

export interface Masina {
	id: number;
	numar_inmatriculare: string;
	marca: string;
	model: string;
	an: number | null;
	vin: string | null;
	combustibil: string | null;
	created_at: string;
}

export interface MasiniMini {
	id: number;
	numar_inmatriculare: string;
	marca: string;
	model: string;
}

export interface MasinaForm {
	numar_inmatriculare: string;
	marca: string;
	model: string;
	an?: number;
	vin?: string;
	combustibil?: string;
}

export interface WorkOrder {
	uid: string;
	status: string;
	portal_color: 'green' | 'red' | 'yellow' | null;
	portal_label: string | null;
	reception_at: string | null;
	predare_la: string | null;
	deviz_trimis_la: string | null;
	deviz_aprobat_la: string | null;
	deviz_refuzat_la: string | null;
	deviz_status: string | null;
	ultima_actualizare: string | null;
	masina: MasiniMini | null;
}

export interface WoSummary {
	uid: string;
	status: string;
	reception_at: string | null;
	predare_la: string | null;
}

export interface TimelineStep {
	label: string;
	sublabel: string | null;
	done: boolean;
	active: boolean;
	declined?: boolean;
	icon: string;
}

export interface Feedback {
	rating: number;
	comentariu: string | null;
}

export interface Programare {
	id: number;
	start_at: string;
	status: string;
	nr_inmatriculare: string;
	notita: string | null;
	durata_minute: number;
}

export interface ProgramareForm {
	data: string;
	ora: string;
	nr_inmatriculare: string;
	notita?: string;
}

export interface Factura {
	id: number;
	serie: string;
	numar: string;
	data_factura: string;
	masina: { numar_inmatriculare: string; marca: string; model: string } | null;
	work_order_uid: string | null;
}

export interface DashboardData {
	active: WorkOrder[];
	history: WorkOrder[];
	programari: Programare[];
	masini: MasiniMini[];
}
