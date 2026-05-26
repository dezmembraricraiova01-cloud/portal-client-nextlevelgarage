// Apelurile publice (sendOtp) merg direct la Laravel — nu necesita token.
// Apelurile protejate merg prin /api/portal/... (SvelteKit proxy) care adauga
// automat token-ul din httpOnly cookie — JS-ul nu vede niciodata token-ul.

const LARAVEL = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (body !== undefined) headers['Content-Type'] = 'application/json';

	const res = await fetch(url, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ message: 'Eroare necunoscută.' }));
		throw { status: res.status, message: err.message ?? 'Eroare.', ...err };
	}

	return res.json();
}

// Apel public direct la Laravel (fara auth)
const pub = <T>(method: string, path: string, body?: unknown) =>
	request<T>(method, `${LARAVEL}/api/portal${path}`, body);

// Apel protejat prin proxy SvelteKit (token din httpOnly cookie)
const priv = <T>(method: string, path: string, body?: unknown) =>
	request<T>(method, `/api/portal${path}`, body);

export const api = {
	// Înregistrare nouă (public)
	marci:    () =>
		pub<MarcaAuto[]>('GET', '/public/marci'),
	modele:   (marcaId: number) =>
		pub<ModelAuto[]>('GET', `/public/modele?marca_id=${marcaId}`),
	register: (data: RegisterForm) =>
		pub<{ message: string }>('POST', '/public/inregistrare', data),

	// Auth
	sendOtp:  (telefon: string) =>
		pub<{ message: string; needs_registration: boolean }>('POST', '/auth/send-otp', { telefon }),
	verifyOtp: (telefon: string, cod: string) =>
		request<{ client: Client }>('POST', '/api/auth/verify', { telefon, cod }),
	cerereSchimbareTelefon: (telefonCurent: string, telefonContact: string) =>
		pub<{ message: string; schimbat_imediat?: boolean; telefon_nou?: string }>(
			'POST', '/public/cerere-schimbare-telefon',
			{ telefon_curent: telefonCurent, telefon_contact: telefonContact }
		),
	devLogin: () =>
		request<{ client: Client }>('GET', '/api/auth/dev'),
	logout: () =>
		request<{ message: string }>('POST', '/api/auth/logout'),
	me: () => priv<Client>('GET', '/auth/me'),
	consilier: () => priv<{ consilier: Consilier | null; consilier_inlocuitor: Consilier | null }>('GET', '/consilier'),
	cerereRealocare: (motiv?: string) =>
		priv<{ message: string }>('POST', '/consilier/realocare', motiv ? { motiv } : {}),

	// Notificări portal
	notificari: () => priv<{ notificari: PortalNotificare[]; necitite: number }>('GET', '/notificari'),
	marcheazaCitita: (id: number) => priv<{ ok: boolean }>('POST', `/notificari/${id}/citit`),
	toateCitite: () => priv<{ ok: boolean }>('POST', '/notificari/toate-citite'),
	stergeNotificare: (id: number) => priv<{ ok: boolean }>('DELETE', `/notificari/${id}`),

	// Chat direct consilier
	mesajeDirecte: (after?: number) =>
		priv<{ mesaje: MesajDirect[]; necitite: number; conversation_id: number | null }>('GET', after ? `/mesaje-directe?after=${after}` : '/mesaje-directe'),
	trimiteDirecte: (mesaj: string) =>
		priv<MesajDirect>('POST', '/mesaje-directe', { mesaj }),
	necititeDirecte: () => priv<{ count: number }>('GET', '/mesaje-directe/necitite'),

	// Profil
	updateProfil: (data: { email?: string | null }) =>
		priv<{ ok: boolean; email: string | null }>('PATCH', '/profil', data),

	// GDPR — consimțăminte
	consimtaminteStatus: () =>
		priv<ConsimtaminteStatus>('GET', '/gdpr/consimtaminte'),
	acceptaConsimtamant: (data: { versiune: string; politica: boolean; marketing: boolean; foto?: boolean; apel?: boolean }) =>
		priv<{ ok: boolean }>('POST', '/gdpr/consimtaminte', data),
	retrageConsimtamant: (tip: 'marketing' | 'foto' | 'apel') =>
		priv<{ ok: boolean }>('DELETE', `/gdpr/consimtaminte/${tip}`),

	// GDPR — drepturile persoanei vizate
	exportDate: async (format: 'json' | 'pdf' = 'json'): Promise<void> => {
		const path = format === 'pdf' ? '/gdpr/export-pdf' : '/gdpr/export';
		const ext  = format === 'pdf' ? 'pdf' : 'json';
		const res = await fetch(`/api/portal${path}`);
		if (!res.ok) throw { status: res.status, message: 'Export indisponibil.' };
		const blob = await res.blob();
		const url  = URL.createObjectURL(blob);
		const a    = document.createElement('a');
		a.href = url;
		a.download = `date-personale-${new Date().toISOString().slice(0,10)}.${ext}`;
		a.click();
		URL.revokeObjectURL(url);
	},
	cerereStergereCont: (motiv?: string) =>
		priv<{ message: string; programata_la: string }>('POST', '/gdpr/cerere-stergere', motiv ? { motiv } : {}),
	anuleazaCerereStergere: () =>
		priv<{ message: string }>('DELETE', '/gdpr/cerere-stergere'),
	cerereRectificare: (mesaj: string) =>
		priv<{ message: string }>('POST', '/gdpr/cerere-rectificare', { mesaj }),

	// Dashboard "Garajul Meu"
	dashboard:  () => priv<GarajDashboard>('GET', '/dashboard'),
	activitate: () => priv<ActivitateItem[]>('GET', '/activitate'),

	// Mașini
	masini:       ()           => priv<Masina[]>('GET', '/masini'),
	masina:       (id: number) => priv<{ masina: Masina; reparatii: WoSummary[]; fotos: MasinaFoto[] }>('GET', `/masini/${id}`),
	addMasina:    (data: MasinaForm) => priv<Masina>('POST', '/masini', data),
	updateMasina: (id: number, data: MasinaUpdateForm) => priv<Masina>('PATCH', `/masini/${id}`, data),
	deleteMasina: (id: number) => priv<{ message: string }>('DELETE', `/masini/${id}`),

	uploadMasinaFoto: async (id: number, file: File): Promise<MasinaFoto> => {
		const form = new FormData();
		form.append('foto', file);
		const res = await fetch(`/api/portal/masini/${id}/foto`, { method: 'POST', body: form });
		if (!res.ok) { const e = await res.json().catch(() => ({})); throw { status: res.status, message: e.message ?? 'Eroare upload.' }; }
		return res.json();
	},
	deleteMasinaFoto: (masinaId: number, fotoId: number) =>
		priv<{ message: string }>('DELETE', `/masini/${masinaId}/foto/${fotoId}`),
	reorderFotos: (masinaId: number, ids: number[]) =>
		priv<{ message: string }>('POST', `/masini/${masinaId}/foto/reorder`, { ids }),

	// Reparații
	reparatii:     ()           => priv<Paginated<WorkOrder>>('GET', '/reparatii'),
	reparatiiPage: (page: number) => priv<Paginated<WorkOrder>>('GET', `/reparatii?page=${page}`),
	reparatie: (uid: string) =>
		priv<{ wo: WorkOrder; timeline: TimelineStep[]; feedback: Feedback | null }>('GET', `/reparatii/${uid}`),
	aprobaDeviz:    (uid: string, ids_aprobate: number[]) =>
		priv<{ message: string }>('POST', `/reparatii/${uid}/aproba-deviz`, { ids_aprobate }),
	refuzaDeviz:    (uid: string) =>
		priv<{ message: string }>('POST', `/reparatii/${uid}/refuza-deviz`),
	intrebareDeviz: (uid: string, mesaj: string) =>
		priv<{ message: string }>('POST', `/reparatii/${uid}/intrebare-deviz`, { mesaj }),
	submitFeedback: (uid: string, rating: number, comentariu?: string) =>
		priv<Feedback>('POST', `/reparatii/${uid}/feedback`, { rating, comentariu }),

	// Programări
	programariConfig: (data?: string) =>
		priv<ProgramariConfig>('GET', data ? `/programari/config?data=${encodeURIComponent(data)}` : '/programari/config'),
	programariZileBlocate: (from: string, to: string) =>
		priv<{ zile: ZiBlocata[]; ocupare: Record<string, number>; total_sloturi: number }>(
			'GET', `/programari/zile-blocate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
	programari:       (includeAnulate = false) =>
		priv<Paginated<Programare>>('GET', includeAnulate ? '/programari?include_anulate=1' : '/programari'),
	programariPage:   (page: number, includeAnulate = false) =>
		priv<Paginated<Programare>>('GET', `/programari?page=${page}${includeAnulate ? '&include_anulate=1' : ''}`),
	addProgramare:    (data: ProgramareForm) => priv<Programare>('POST', '/programari', data),
	anulareProgramare:(id: number) => priv<{ message: string }>('POST', `/programari/${id}/anulare`),

	// Alerte mașină
	alertSummary: () =>
		priv<AlertSummary>('GET', '/alerte/summary'),
	toateAlertele: () =>
		priv<AlertaMasinaFull[]>('GET', '/alerte'),
	alerte:      (masinaId: number) =>
		priv<AlertaMasina[]>('GET', `/masini/${masinaId}/alerte`),
	saveAlerta:  (masinaId: number, data: AlertaSaveForm) =>
		priv<AlertaMasina>('POST', `/masini/${masinaId}/alerte`, data),
	updateAlertaSettings: (masinaId: number, alertaId: number, data: AlertaSettingsForm) =>
		priv<AlertaMasina>('PATCH', `/masini/${masinaId}/alerte/${alertaId}`, data),
	deleteAlerta:(masinaId: number, alertaId: number) =>
		priv<{ message: string }>('DELETE', `/masini/${masinaId}/alerte/${alertaId}`),

	// Alerte personale globale (custom, fără mașină)
	savePersonalAlerta: (data: AlertaSaveForm) =>
		priv<AlertaMasina>('POST', '/alerte-personale', data),
	updatePersonalAlertaSettings: (alertaId: number, data: AlertaSettingsForm) =>
		priv<AlertaMasina>('PATCH', `/alerte-personale/${alertaId}`, data),
	deletePersonalAlerta: (alertaId: number) =>
		priv<{ message: string }>('DELETE', `/alerte-personale/${alertaId}`),

	// Trips
	trips:             ()                              => priv<TripResult[]>('GET', '/trips'),
	trip:              (id: number)                    => priv<TripResult>('GET', `/trips/${id}`),
	createTrip:        (data: TripForm)                => priv<TripResult>('POST', '/trips', data),
	createOfferRequest:(tripId: number, data: OfferRequestForm) =>
		priv<OfferRequest>('POST', `/trips/${tripId}/offer-request`, data),
	offerRequest:      (tripId: number)                =>
		priv<OfferRequest>('GET', `/trips/${tripId}/offer-request`),

	// Închirieri auto — flotă + cereri rezervare
	inchirieriFlota: (filters?: { q?: string; combustibil?: string; transmisie?: string; from?: string; to?: string }) => {
		const qs = new URLSearchParams();
		if (filters?.q)           qs.set('q', filters.q);
		if (filters?.combustibil) qs.set('combustibil', filters.combustibil);
		if (filters?.transmisie)  qs.set('transmisie', filters.transmisie);
		if (filters?.from)        qs.set('from', filters.from);
		if (filters?.to)          qs.set('to', filters.to);
		const query = qs.toString();
		return priv<{ masini: MasinaInchiriereCard[]; interval: { from: string; to: string; zile: number } | null }>(
			'GET', `/inchirieri/flota${query ? `?${query}` : ''}`);
	},
	inchiriereMasina: (masinaId: number) =>
		priv<{ masina: MasinaInchiriereDetaliu; intervale_blocate: IntervalBlocat[]; extras: ExtraOferit[] }>(
			'GET', `/inchirieri/flota/${masinaId}`),
	inchirieriCereri: () =>
		priv<{ cereri: InchiriereCerere[] }>('GET', '/inchirieri/cereri'),
	rezervaInchiriere: (masinaId: number, data: InchiriereForm) =>
		priv<{ cerere: InchiriereCerere }>('POST', `/inchirieri/flota/${masinaId}/rezerva`, data),
	anuleazaCerereInchiriere: (cerereId: number) =>
		priv<{ cerere: InchiriereCerere }>('POST', `/inchirieri/cereri/${cerereId}/anulare`),

	// Documente
	documente:    () => priv<Paginated<Factura>>('GET', '/documente'),
	expirari:     () => priv<ExpirareDoc[]>('GET', '/documente/expirari'),
	soldRestant:  () => priv<SoldRestant>('GET', '/documente/sold-restant'),
	factura:      (id: number) => priv<FacturaDetalii>('GET', `/documente/${id}`),

	// PDF — prin proxy (token din cookie), download ca blob
	downloadPdf: async (id: number, filename?: string): Promise<void> => {
		const res = await fetch(`/api/portal/documente/${id}/pdf`);
		if (!res.ok) throw { status: res.status, message: 'PDF indisponibil.' };
		const blob = await res.blob();
		const url  = URL.createObjectURL(blob);
		const a    = document.createElement('a');
		a.href     = url;
		a.download = filename ?? `factura-${id}.pdf`;
		a.click();
		URL.revokeObjectURL(url);
	}
};

// ─── Utility ─────────────────────────────────────────────────────────────────

export function formatActualizare(iso: string): string {
	const d    = new Date(iso);
	const now  = new Date();
	const time = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
	const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const tDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	if (dDay === tDay)            return `azi, ${time}`;
	if (dDay === tDay - 86400000) return `ieri, ${time}`;
	return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) + `, ${time}`;
}

export function timeAgo(iso: string): string {
	const diff  = Date.now() - new Date(iso).getTime();
	const min   = Math.floor(diff / 60_000);
	const ore   = Math.floor(min / 60);
	const zile  = Math.floor(ore / 24);
	if (min < 1)  return 'acum';
	if (min < 60) return `acum ${min} min`;
	if (ore < 24) return `acum ${ore}h`;
	if (zile === 1) return 'ieri';
	if (zile < 7)   return `acum ${zile} zile`;
	return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Paginated<T> {
	data: T[];
	current_page: number;
	last_page: number;
	per_page: number;
	total: number;
}

// Dashboard "Garajul Meu"
export interface GarajDashboard {
	salut:                 string;
	masina_activa:         MasinaActiva | null;
	masina_principala:     MasinaPrincipala | null;
	actiune_principala:    ActiunePrincipala | null;
	expirari:              Expirare[];
	activitate_recenta:    ActivitateItem[];
	urmatoarea_programare: ProgramareMini | null;
}

export interface MasinaPrincipala {
	masina_id:           number;
	numar_inmatriculare: string;
	marca:               string;
	model:               string;
	an:                  number | null;
	foto_url:            string | null;
}

export interface MasinaActiva {
	masina_id:            number;
	numar_inmatriculare:  string;
	marca:                string;
	model:                string;
	an:                   number | null;
	wo_uid:               string;
	status_label:         string;
	portal_color:         'green' | 'blue' | 'yellow' | 'red' | 'gray';
	ultima_actualizare:   string | null;
	eta:                  string | null;
	deviz_pending:        boolean;
	foto_url:             string | null;
}

export interface ActiunePrincipala {
	tip:       'deviz' | 'ridicare' | 'rca' | 'casco' | 'itp' | 'carte_verde' | 'programare';
	titlu:     string;
	descriere: string;
	cta_label: string;
	cta_link:  string;
	urgenta:   'high' | 'medium' | 'low';
}

export interface Expirare {
	tip:            string;
	label:          string;
	custom_icon?:   string | null;
	masina:         string | null;
	data_sfarsit:   string;
	expira_in_zile: number;
	urgent:         boolean;
}

export interface ActivitateItem {
	tip:        string;
	label:      string;
	created_at: string;
}

export interface ProgramareMini {
	id:                  number;
	start_at:            string;
	nr_inmatriculare:    string;
	status:              string;
	tip_serviciu:        string | null;
	tip_serviciu_label:  string | null;
}

export interface TipServiciu {
	cod:   string;
	label: string;
	icon:  string;
}

// Entitati de baza

export interface PresenceStatus {
	status:    'online' | 'away' | 'offline';
	label:     string;   // ex: "Online", "Văzut acum 3 min", "Offline · Sărbătoare legală — 1 Mai"
	motiv:     string | null;
	last_seen: string | null;
}

export interface Consilier {
	id:                number;
	name:              string;
	initials:          string;
	avatar:            string | null;
	telefon:           string | null;
	functie:           string | null;
	status:            PresenceStatus;
	arata_inlocuitor?: boolean; // prezent doar pe consilierul principal, nu și pe inlocuitor
}

export interface Client {
	id:                    number;
	nume:                  string;
	telefon:               string;
	email:                 string | null;
	vip:                   boolean;
	ci_lipsa:              boolean;
	permis_lipsa:          boolean;
	are_restante:          boolean;
	notificari_necitite:   number;
	consilier:             Consilier | null;
	consilier_inlocuitor:  Consilier | null;
	// GDPR — versiunea politicii acceptate; null = trebuie să accepte la login
	gdpr_versiune_acceptata?: string | null;
	gdpr_marketing?:          boolean;
	cerere_stergere_la?:      string | null;
}

export interface ConsimtaminteStatus {
	versiune_curenta:      string;
	versiune_acceptata:    string | null;
	necesita_acceptare:    boolean;
	politica_acceptata_la: string | null;
	marketing:             boolean;
	marketing_acceptat_la: string | null;
	foto:                  boolean;
	apel:                  boolean;
	cerere_stergere_la:    string | null;
}

export interface PortalNotificare {
	id:         number;
	tip:        string;
	titlu:      string;
	mesaj:      string;
	link:       string | null;
	citita:     boolean;
	citita_la:  string | null;
	created_at: string;
}

export interface MesajDirect {
	id:            number;
	expeditor_tip: 'client' | 'service';
	sender_name:   string;
	mesaj:         string;
	created_at:    string;
}

export interface MasinaFoto {
	id:  number;
	url: string;
}

export interface Masina {
	id:                   number;
	numar_inmatriculare:  string;
	marca:                string;
	model:                string;
	an:                   number | null;
	vin:                  string | null;
	combustibil:          string | null;
	km_actuali:           number | null;
	itp_valabil_pana:     string | null;
	observatii:           string | null;
	created_at:           string;
	foto_url:             string | null;
}

export interface MasinaUpdateForm {
	km_actuali?:       number | null;
	itp_valabil_pana?: string | null;
	observatii?:       string | null;
}

export interface MasiniMini {
	id:                  number;
	numar_inmatriculare: string;
	marca:               string;
	model:               string;
}

export interface MasinaForm {
	numar_inmatriculare: string;
	marca:               string;
	model:               string;
	an?:         number;
	vin?:        string;
	combustibil?: string;
}

export interface DevizItem {
	id:             number;
	tip:            'piesa' | 'manopera' | string;
	descriere:      string;
	cantitate:      number;
	pret_unitar:    number;
	total:          number;
	aprobat_client: boolean | null;
}

export interface VmMasina {
	marca:               string | null;
	model:               string | null;
	an:                  number | null;
	vin:                 string | null;
	numar_inmatriculare: string | null;
	pret:                number;
	moneda:              string;
}

export interface VmFactura {
	id:     number;
	numar:  string;
	tip:    'oferta' | 'proforma' | 'fiscala' | string;
	status: string;
	total:  number;
	data:   string | null;
}

export interface VmInfo {
	masina:           VmMasina | null;
	factura:          VmFactura | null;
	stare_vanzare:    'reparata' | 'avariata' | null;
	descriere_avarii: string | null;
	observatii:       string | null;
}

export interface MsMasinaSchimb {
	marca:               string | null;
	model:               string | null;
	an:                  number | null;
	numar_inmatriculare: string | null;
	clasa:               string | null;
	tarif_zi:            number;
}

export interface MsPremiumOption {
	id:                  number;
	marca:               string | null;
	model:               string | null;
	an:                  number | null;
	clasa:               string | null;
	tarif_zi:            number;
	tarif_extra:         number;
	tip_caroserie:       string | null;
	nr_locuri:           number | null;
	transmisie:          string | null;
	numar_inmatriculare: string | null;
}

export interface MsInfo {
	masina_schimb:    MsMasinaSchimb | null;
	mesaj_principal:  string;
	premium:          MsPremiumOption[];
}

export interface WorkOrder {
	uid:                 string;
	dept:                string | null;
	status:              string;
	portal_color:        'green' | 'red' | 'yellow' | null;
	portal_label:        string | null;
	reception_at:        string | null;
	predare_la:          string | null;
	deviz_trimis_la:     string | null;
	deviz_aprobat_la:    string | null;
	deviz_refuzat_la:    string | null;
	deviz_status:        string | null;
	ultima_actualizare:  string | null;
	masina:              MasiniMini | null;
	costuri?:            DevizItem[];
	vm?:                 VmInfo;
	ms?:                 MsInfo;
}

export interface WoSummary {
	uid:          string;
	status:       string;
	reception_at: string | null;
	predare_la:   string | null;
}

export interface TimelineStep {
	label:    string;
	sublabel: string | null;
	done:     boolean;
	active:   boolean;
	declined?: boolean;
	icon:     string;
}

export interface Feedback {
	rating:      number;
	comentariu:  string | null;
}

export interface Programare {
	id:                  number;
	start_at:            string;
	status:              string;
	nr_inmatriculare:    string;
	tip_serviciu:        string | null;
	tip_serviciu_label:  string | null;
	notita:              string | null;
	durata_minute:       number;
	anulat_la:           string | null;
}

export interface ProgramareForm {
	data:             string;
	ora:              string;
	nr_inmatriculare: string;
	tip_serviciu:     string;
	notita?:          string;
}

export interface ProgramariConfig {
	ore:               string[];
	ore_ocupate:       string[];
	masini:            MasiniMini[];
	tipuri_serviciu:   TipServiciu[];
	cancel_min_hours:  number;
	max_future_days:   number;
}

export interface ZiBlocata {
	data:  string; // YYYY-MM-DD
	motiv: 'weekend' | 'sarbatoare';
	label: string;
}

export interface AlertaMasinaFull extends AlertaMasina {
	masina_id:            number | null;
	numar_inmatriculare:  string | null;
	marca:                string | null;
	model:                string | null;
}

export interface AlertaMasina {
	id:             number;
	tip:            string;
	custom_label:   string | null;
	custom_icon:    string | null;
	data_expirare:  string | null;
	zile_inainte:   number;
	activa:         boolean;
	source:         'wms' | 'client';
	thresholds:     number[] | null;
	channels:       string[] | null;
	billing_cycle:  'monthly' | 'quarterly' | 'yearly' | null;
}

export interface AlertaSaveForm {
	tip:            string;
	custom_label?:  string | null;
	custom_icon?:   string | null;
	data_expirare:  string | null;
	zile_inainte:   number;
	thresholds?:    number[] | null;
	channels?:      string[] | null;
	billing_cycle?: 'monthly' | 'quarterly' | 'yearly' | null;
}

export interface AlertaSettingsForm {
	activa?:        boolean;
	thresholds?:    number[] | null;
	channels?:      string[] | null;
	billing_cycle?: 'monthly' | 'quarterly' | 'yearly' | null;
	custom_label?:  string;
	custom_icon?:   string;
}

// ── Alert Summary (GET /alerte/summary) ──────────────────────────────────────

export type Severitate = 'critic' | 'warning' | 'missing' | 'unknown_date' | 'ok';

export interface AlertSummary {
	summary:   AlertSummaryCounts;
	alerts:    AlertSummaryItem[];
	documents: AlertSummaryItem[];
	vehicles:  AlertSummaryVehicle[];
	settings:  AlertSummarySetting[];
}

export interface AlertSummaryCounts {
	urgent_count:       number;
	warning_count:      number;
	missing_count:      number;
	unknown_date_count: number;
	message:            string;
}

export interface AlertSummaryItem {
	tip:                  string;
	label:                string;
	custom_icon:          string | null;
	scope:                'client' | 'masina';
	source_capability:    'wms' | 'manual_only';
	masina_id:            number | null;
	numar_inmatriculare:  string | null;
	marca:                string | null;
	model:                string | null;
	data_expirare:        string | null;
	wms_date:             string | null;
	client_date:          string | null;
	has_conflict:         boolean;
	expira_in_zile:       number | null;
	expirat:              boolean;
	source:               'wms' | 'client' | 'missing';
	severitate:           Severitate;
	alerta_id:            number | null;
	activa:               boolean;
	cta:                  { label: string; tip: string } | null;
}

export interface AlertSummaryVehicle {
	id:                   number;
	numar_inmatriculare:  string | null;
	marca:                string | null;
	model:                string | null;
	an:                   number | null;
	worst_severitate:     Severitate;
	documente_count:      number;
}

export interface AlertSummarySetting {
	alerta_id:      number;
	masina_id:      number | null;
	tip:            string;
	custom_label:   string | null;
	custom_icon:    string | null;
	activa:         boolean;
	zile_inainte:   number;
	thresholds:     number[] | null;
	channels:       string[] | null;
	billing_cycle:  'monthly' | 'quarterly' | 'yearly' | null;
	source:         'wms' | 'client';
}

// ── Trips ────────────────────────────────────────────────────────────────────

export interface TripForm {
	masina_id:      number;
	destination:    string;
	transit?:       string[];
	departure_date: string;
	return_date:    string;
}

export type TripStatus = 'ok' | 'atentie';
export type CheckStatus = 'ok' | 'critic' | 'missing' | 'warning' | 'unknown_date';

export interface TripResult {
	trip: {
		id:             number;
		status:         TripStatus;
		destination:    string;
		transit:        string[];
		departure_date: string;
		return_date:    string;
		masina: {
			id:                   number;
			numar_inmatriculare:  string | null;
			marca:                string | null;
			model:                string | null;
		};
	};
	checks: TripDocCheck[];
	checklist: TripChecklistItem[];
	road_requirements: TripRoadRequirement[];
	trip_alerts: TripAlert[];
}

export interface TripDocCheck {
	tip:           string;
	label:         string;
	status:        CheckStatus;
	data_expirare: string | null;
	message:       string | null;
	has_conflict:  boolean;
	wms_date:      string | null;
	client_date:   string | null;
}

export interface TripChecklistItem {
	tip:         string;
	label:       string;
	obligatoriu: boolean;
}

export interface TripRoadRequirement {
	country:      string;
	tip:          string;
	label:        string;
	obligatoriu:  boolean;
}

export interface TripAlert {
	tip:   string;
	zile:  number;
	mesaj: string;
}

// ── Offer Requests ───────────────────────────────────────────────────────────

export type OfferRequestStatus = 'created' | 'in_progress' | 'finalizata' | 'anulata';

export interface OfferProduct {
	country: string;
	type:    string;
	label:   string;
}

export interface OfferRequestForm {
	products: { country: string; type: string }[];
	note?:    string;
}

export interface OfferRequest {
	id:             number;
	trip_id:        number;
	status:         OfferRequestStatus;
	products:       OfferProduct[];
	trip_snapshot:  {
		destination:    string;
		transit:        string[];
		departure_date: string;
		return_date:    string;
		masina:         { numar_inmatriculare: string | null; marca: string | null; model: string | null };
	};
	note:           string | null;
	created_at:     string | null;
}

// ── Înregistrare ─────────────────────────────────────────────────────────────

export interface MarcaAuto {
	id:   number;
	nume: string;
}

export interface ModelAuto {
	id:          number;
	denumire:    string;
	an_start:    number | null;
	an_sfarsit:  number | null;
}

export interface RegisterForm {
	prenume:  string;
	nume:     string;
	telefon:  string;
	marca:    string;
	model:    string;
	an:       number;
	pe_firma: boolean;
	acord_politica:    boolean;
	acord_marketing:   boolean;
	politica_versiune: string;
}

export interface ExpirareDoc {
	tip:            string;
	label:          string;
	masina:         string;
	masina_id:      number;
	asigurator:     string | null;
	numar_polita:   string | null;
	data_sfarsit:   string | null;
	expira_in_zile: number | null;
	expirat:        boolean;
	urgent:         boolean;
}

export interface Factura {
	id:              number;
	serie:           string;
	numar:           string;
	numar_complet:   string;
	tip_document:    'fiscala' | 'storno';
	tip_label:       string;
	status:          'emisa' | 'incasata' | 'anulata' | string;
	status_label:    string;
	is_restanta:     boolean;
	total:           number;
	moneda:          string;
	data_factura:    string;
	data_scadenta:   string | null;
	masina:          { numar_inmatriculare: string; marca: string; model: string } | null;
	work_order_uid:  string | null;
}

export interface FacturaLinie {
	tip:             string;
	descriere:       string;
	cantitate:       number;
	pret_unitar:     number;
	tva_procent:     number;
	total_fara_tva:  number;
	total_cu_tva:    number;
}

export interface FacturaDetalii extends Factura {
	subtotal:    number;
	tva_procent: number;
	tva_valoare: number;
	observatii:  string | null;
	parent:      { id: number; numar_complet: string; tip_document: string } | null;
	linii:       FacturaLinie[];
}

export interface SoldRestant {
	total_neincasat:       number;
	total_restant:         number;
	nr_facturi_emise:      number;
	nr_facturi_restante:   number;
}

// Închirieri auto
export interface MasinaInchiriereCard {
	id:                  number;
	marca:               string;
	model:               string;
	an:                  string | null;
	numar_inmatriculare: string | null;
	combustibil:         string | null;
	transmisie:          string | null;
	nr_locuri:           number | null;
	nr_usi:              number | null;
	are_ac:              boolean;
	is_4wd:              boolean;
	putere_cp:           number | null;
	tarif_zi:            number;
	km_inclusi_zi:       number;
	tarif_km_extra:      number;
	foto_url:            string | null;
	clasa:               string | null;
	categoria:           string;
	rezervari_azi:       number;
	disponibila_interval: boolean | null;
}

export interface MasinaInchiriereDetaliu extends MasinaInchiriereCard {
	vin:           string | null;
	motorizare:    string | null;
	cilindree:     string | null;
	culoare:       string | null;
	kilometraj:    number | null;
	are_ac:        boolean;
	is_4wd:        boolean;
	nr_viteze:     number | null;
	nr_usi:        number | null;
	tip_caroserie: string | null;
	dotari:        string[];
	observatii:    string | null;
	poze:          string[];
}

export interface IntervalBlocat {
	from: string;
	to:   string;
}

export interface InchiriereForm {
	data_start: string;
	data_end:   string;
	telefon?:   string;
	observatii?: string;
	extras?:    string[];
}

export interface ExtraOferit {
	cod:       string;
	label:     string;
	descriere: string;
	pret:      number;
	tip:       'per_zi' | 'o_data';
	icon:      string;
}

export interface ExtraSelectat {
	cod:     string;
	label:   string;
	pret:    number;
	tip:     'per_zi' | 'o_data';
	valoare: number;
}

export interface InchiriereCerere {
	id:               number;
	status:           'in_asteptare' | 'acceptata' | 'respinsa' | 'anulata';
	status_label:     string;
	data_start:       string;
	data_end:         string;
	nr_zile:          number;
	tarif_zi:         number;
	cost_estimat:     number;
	extras:           ExtraSelectat[];
	extras_total:     number;
	telefon:          string;
	observatii:       string | null;
	motiv_respingere: string | null;
	created_at:       string;
	masina: {
		id:                  number;
		marca:               string;
		model:               string;
		an:                  string | null;
		numar_inmatriculare: string | null;
		foto_url:            string | null;
	} | null;
}
