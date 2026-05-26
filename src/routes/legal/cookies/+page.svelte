<script lang="ts">
	function openBanner() {
		window.dispatchEvent(new CustomEvent('open-cookie-banner'));
	}
</script>

<svelte:head>
	<title>Politica de cookies · NLG Portal</title>
</svelte:head>

<h1>Politica de cookies</h1>
<p class="meta">Versiunea 1.0 · în vigoare din 03.05.2026</p>

<div class="box">
	Această politică explică ce cookies folosim, de ce și cum le poți gestiona. Respectă <strong>Legea nr. 506/2004</strong>
	(transpunerea Directivei ePrivacy) și <strong>GDPR</strong>.
</div>

<h2>1. Ce sunt cookies-urile</h2>
<p>
	Cookies-urile sunt fișiere mici text salvate pe dispozitivul tău de browser când vizitezi un site.
	Permit site-ului să te „recunoască" la următoarea vizită și să rețină preferințele tale.
</p>

<h2>2. Ce cookies folosim</h2>

<table>
	<thead>
		<tr><th>Nume</th><th>Tip</th><th>Scop</th><th>Durată</th></tr>
	</thead>
	<tbody>
		<tr>
			<td><code>portal_token</code></td>
			<td>Strict necesar (httpOnly)</td>
			<td>Autentificare în portal — fără el nu te poți loga</td>
			<td>7 zile</td>
		</tr>
		<tr>
			<td><code>theme</code></td>
			<td>Funcțional</td>
			<td>Reține preferința de temă (light/dark)</td>
			<td>1 an</td>
		</tr>
		<tr>
			<td><code>alerts-shown</code></td>
			<td>Funcțional (sessionStorage)</td>
			<td>Evită afișarea repetată a notificărilor în aceeași sesiune</td>
			<td>Sesiune</td>
		</tr>
		<tr>
			<td><code>gdpr_consent_v</code></td>
			<td>Strict necesar</td>
			<td>Reține că ai acceptat politica de confidențialitate (versiune)</td>
			<td>2 ani</td>
		</tr>
	</tbody>
</table>

<h2>3. Cookies de la terți</h2>
<p>
	În prezent <strong>NU</strong> folosim cookies de tracking publicitar (Google Ads, Meta Pixel, TikTok)
	în portal. Dacă vom integra astfel de servicii pe viitor, vei primi un banner de consimțământ
	conform legii.
</p>

<h2>4. Cum gestionezi cookies-urile</h2>
<ul>
	<li>Cookies-urile <strong>strict necesare</strong> nu pot fi dezactivate — fără ele aplicația nu funcționează.</li>
	<li>Cookies-urile <strong>funcționale</strong> sunt setate doar la prima preferință (ex: temă).</li>
	<li>Poți șterge oricând cookies-urile din setările browserului tău:
		<ul>
			<li><strong>Chrome:</strong> Setări → Confidențialitate → Cookies</li>
			<li><strong>Firefox:</strong> Opțiuni → Confidențialitate → Cookies</li>
			<li><strong>Safari:</strong> Preferințe → Confidențialitate</li>
			<li><strong>Edge:</strong> Setări → Cookies și permisiuni</li>
		</ul>
	</li>
</ul>

<h2>5. Modificări</h2>
<p>
	Vom actualiza această politică dacă schimbăm cookies-urile folosite. Versiunea curentă este afișată mereu mai sus.
</p>

<h2>6. Schimbă preferințele cookies</h2>
<p>
	Vrei să modifici acordul tău pentru cookies? Apasă butonul de mai jos pentru a redeschide panoul de preferințe.
</p>
<p>
	<button onclick={openBanner}
		style="background: var(--accent); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-size: 0.85rem;">
		⚙️ Deschide setări cookies
	</button>
</p>

<h2>7. Contact</h2>
<p>
	Întrebări? <a href="mailto:gdpr@nlg.ro">gdpr@nlg.ro</a>
</p>
