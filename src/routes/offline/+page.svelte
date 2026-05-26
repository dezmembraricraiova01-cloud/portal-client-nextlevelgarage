<div class="min-h-screen flex flex-col items-center justify-center px-6 text-center"
	style="background: transparent">
	<div class="space-y-4 max-w-xs">
		<div class="text-6xl">📡</div>
		<h1 class="text-xl font-bold" style="color: var(--text)">Ești offline</h1>
		<p class="text-sm leading-relaxed" style="color: var(--muted)">
			Nu există conexiune la internet. Conectează-te și încearcă din nou.
		</p>
		<button
			onclick={() => window.location.reload()}
			class="w-full py-3 rounded-2xl font-semibold text-sm"
			style="background: var(--accent); color: white;">
			Încearcă din nou
		</button>
	</div>
</div>
