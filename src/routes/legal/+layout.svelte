<script lang="ts">
	let { children } = $props();
</script>

<div class="min-h-screen px-4 py-8 max-w-3xl mx-auto" style="background: transparent">
	<a href="/" class="inline-flex items-center gap-2 text-xs mb-6" style="color: var(--muted)">
		<span>←</span> Înapoi
	</a>

	<div class="legal-content rounded-2xl px-5 py-6 sm:px-8 sm:py-10"
		style="background: var(--surface); border: 1px solid var(--border); color: var(--text);">
		{@render children()}
	</div>

	<nav class="flex flex-wrap gap-3 justify-center mt-6 text-xs" style="color: var(--muted)">
		<a href="/legal/privacy" style="color: var(--muted)">Confidențialitate</a>
		<span>·</span>
		<a href="/legal/terms" style="color: var(--muted)">Termeni</a>
		<span>·</span>
		<a href="/legal/cookies" style="color: var(--muted)">Cookies</a>
		<span>·</span>
		<a href="/legal/drepturi" style="color: var(--muted)">Drepturile mele</a>
	</nav>
</div>

<style>
	.legal-content :global(h1) { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.5rem; }
	.legal-content :global(h2) { font-size: 1.1rem; font-weight: 700; margin: 1.75rem 0 0.5rem; }
	.legal-content :global(h3) { font-size: 0.95rem; font-weight: 700; margin: 1.25rem 0 0.4rem; }
	.legal-content :global(p)  { font-size: 0.9rem; line-height: 1.6; margin-bottom: 0.75rem; }
	.legal-content :global(ul), .legal-content :global(ol) { font-size: 0.9rem; line-height: 1.6; padding-left: 1.25rem; margin-bottom: 0.75rem; }
	.legal-content :global(li) { margin-bottom: 0.25rem; }
	.legal-content :global(strong) { font-weight: 700; }
	.legal-content :global(.meta) { font-size: 0.75rem; color: var(--muted); margin-bottom: 1.5rem; }
	.legal-content :global(.box) { background: var(--surface2); border: 1px solid var(--border); border-radius: 0.75rem; padding: 0.75rem 1rem; margin: 0.75rem 0; font-size: 0.85rem; }
	.legal-content :global(table) { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin: 0.75rem 0; }
	.legal-content :global(th), .legal-content :global(td) { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
	.legal-content :global(th) { background: var(--surface2); font-weight: 600; }
	.legal-content :global(a) { color: var(--accent); text-decoration: underline; }
</style>
