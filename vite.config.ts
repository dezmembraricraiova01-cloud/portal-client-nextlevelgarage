import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0',
		port: 5176,
		strictPort: true,
		allowedHosts: ['client.nextlevelgarage.test', 'nlg-portal.test'],
		// HMR WebSocket direct la Vite (bypass Apache reverse-proxy care nu support WS upgrade pe Windows)
		hmr: {
			host: 'nlg-portal.test',
			clientPort: 5176,
			protocol: 'ws'
		}
	}
});
