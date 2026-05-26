import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const API = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';

async function proxy(method: string, event: Parameters<RequestHandler>[0]): Promise<Response> {
	const token = event.locals.portalToken;

	if (!token) {
		return json({ message: 'Neautentificat.' }, { status: 401 });
	}

	const search = new URL(event.request.url).search;
	const upstream = `${API}/api/portal/${event.params.path}${search}`;

	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		Accept: 'application/json'
	};

	let body: string | ArrayBuffer | undefined;
	if (['POST', 'PUT', 'PATCH'].includes(method)) {
		const contentType = event.request.headers.get('Content-Type') ?? '';
		if (contentType.startsWith('multipart/form-data')) {
			headers['Content-Type'] = contentType;
			body = await event.request.arrayBuffer();
		} else {
			headers['Content-Type'] = 'application/json';
			body = await event.request.text().catch(() => undefined);
		}
	}

	const res = await fetch(upstream, { method, headers, body });

	// Pastram Content-Type din upstream (JSON sau octet-stream pentru PDF)
	const contentType = res.headers.get('Content-Type') ?? 'application/json';

	if (contentType.includes('application/pdf') || contentType.includes('octet-stream')) {
		const buffer = await res.arrayBuffer();
		return new Response(buffer, {
			status: res.status,
			headers: {
				'Content-Type': contentType,
				'Content-Disposition': res.headers.get('Content-Disposition') ?? 'attachment'
			}
		});
	}

	const responseBody = await res.text();
	return new Response(responseBody, {
		status: res.status,
		headers: { 'Content-Type': 'application/json' }
	});
}

export const GET: RequestHandler    = (event) => proxy('GET', event);
export const POST: RequestHandler   = (event) => proxy('POST', event);
export const DELETE: RequestHandler = (event) => proxy('DELETE', event);
export const PUT: RequestHandler    = (event) => proxy('PUT', event);
export const PATCH: RequestHandler  = (event) => proxy('PATCH', event);
