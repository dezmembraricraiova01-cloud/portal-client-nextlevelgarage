import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const API = import.meta.env.VITE_API_URL ?? 'https://wms-main-6oacg2.laravel.cloud';
const IS_PROD = import.meta.env.PROD;

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json();

	const upstream = await fetch(`${API}/api/portal/auth/schimba-telefon/confirma`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body)
	});

	if (!upstream.ok) {
		const err = await upstream.json().catch(() => ({ message: 'Eroare necunoscută.' }));
		return json(err, { status: upstream.status });
	}

	const data = await upstream.json();

	cookies.set('portal_token', data.token, {
		httpOnly: true,
		secure: IS_PROD,
		sameSite: 'strict',
		path: '/',
		maxAge: 60 * 60 * 24 * 7
	});

	return json({ client: data.client });
};
