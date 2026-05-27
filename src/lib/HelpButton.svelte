<script lang="ts">
	import { onMount } from 'svelte';
	import { startTour, hasSeenTour } from '$lib/tour';

	let hasTour = $state(true);     // Tour-ul welcome există mereu pe dashboard
	let isNew   = $state(false);    // True dacă userul NU a văzut tour-ul

	onMount(() => {
		isNew = !hasSeenTour();
	});

	function handleClick() {
		startTour({ force: true });
		// Marcăm vizual ca "văzut" — dacă userul completează / skipează tour-ul,
		// hasSeenTour devine true și dot-ul roșu dispare.
		setTimeout(() => { isNew = !hasSeenTour(); }, 100);
	}
</script>

<button
	type="button"
	class="help-fab"
	class:has-tour={hasTour}
	class:new-tour={isNew}
	aria-label="Ajutor & Ghid interactiv"
	onclick={handleClick}
>
	?
	<span class="help-dot"></span>
	<span class="help-fab-tip">{isNew ? 'Tour disponibil' : 'Reia ghidul'}</span>
</button>

<style>
	.help-fab {
		position: fixed;
		/* Stack DEASUPRA chat FAB (chat: bottom 72px height 52px → top edge la 124px) */
		/* Help la 138px = 14px gap deasupra chat-ului */
		bottom: 138px;
		right: 18px;
		z-index: 60;
		width: 46px; height: 46px; border-radius: 50%;
		background: linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%);
		color: #fff; border: 1px solid rgba(255,255,255,0.18);
		font-size: 21px; font-weight: 700; cursor: pointer;
		box-shadow:
			0 8px 22px rgba(99, 102, 241, 0.45),
			0 0 0 1px rgba(99, 102, 241, 0.12),
			inset 0 1px 0 rgba(255,255,255,0.25);
		transition: all .25s cubic-bezier(.16, 1, .3, 1);
		display: flex; align-items: center; justify-content: center;
		font-family: 'Inter', -apple-system, sans-serif;
		letter-spacing: -0.02em;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
	.help-fab:hover {
		transform: translateY(-2px) scale(1.05);
		box-shadow:
			0 14px 32px rgba(99, 102, 241, 0.6),
			0 0 0 1px rgba(99, 102, 241, 0.2),
			inset 0 1px 0 rgba(255,255,255,0.3);
	}
	.help-fab:active {
		transform: translateY(0) scale(0.96);
		transition-duration: .1s;
	}

	.help-fab.has-tour.new-tour::before,
	.help-fab.has-tour.new-tour::after {
		content: '';
		position: absolute; inset: -3px;
		border-radius: 50%;
		border: 2px solid rgba(99, 102, 241, 0.6);
		animation: helpFabPulse 2s cubic-bezier(.16, 1, .3, 1) infinite;
		pointer-events: none;
	}
	.help-fab.has-tour.new-tour::after { animation-delay: 1s; }

	@keyframes helpFabPulse {
		0%   { transform: scale(0.95); opacity: 0.9; }
		80%  { transform: scale(1.6);  opacity: 0; }
		100% { transform: scale(1.6);  opacity: 0; }
	}

	.help-dot {
		position: absolute; top: 2px; right: 2px;
		width: 11px; height: 11px; border-radius: 50%;
		background: linear-gradient(135deg, #ef4444, #f97316);
		border: 2px solid #0d0f1a;
		display: none;
		box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
	}
	.help-fab.new-tour .help-dot { display: block; }

	.help-fab-tip {
		position: absolute; right: 60px; top: 50%;
		transform: translateY(-50%) translateX(8px);
		background: rgba(13, 15, 26, 0.95);
		backdrop-filter: blur(8px);
		color: #f1f5f9;
		padding: 8px 12px; border-radius: 8px;
		font-size: 12px; font-weight: 600; white-space: nowrap;
		opacity: 0; pointer-events: none;
		transition: all .2s cubic-bezier(.16, 1, .3, 1);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}
	.help-fab:hover .help-fab-tip {
		opacity: 1;
		transform: translateY(-50%) translateX(0);
	}

	/* Pe desktop: păstrăm stacking-ul vertical deasupra chat-ului ca să nu fie surpriza
	   de poziții diferite pe viewport-uri diferite. */
	@media (min-width: 768px) {
		.help-fab {
			bottom: 138px;
			right: 24px;
		}
	}
</style>
