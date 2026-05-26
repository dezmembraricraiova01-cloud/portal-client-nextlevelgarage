<script lang="ts">
	let { class: cls = '', rounded = 'rounded-xl', height = 'h-4' } = $props<{
		class?: string;
		rounded?: string;
		height?: string;
	}>();
</script>

<div class="skeleton {rounded} {height} {cls}"></div>

<style>
	.skeleton {
		background: linear-gradient(
			90deg,
			var(--surface2) 25%,
			color-mix(in srgb, var(--surface2) 60%, var(--text)) 50%,
			var(--surface2) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s infinite;
	}

	@keyframes shimmer {
		0%   { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}
</style>
