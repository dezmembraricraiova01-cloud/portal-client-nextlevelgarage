<script lang="ts">
	function tipareste() { window.print(); }
</script>

<svelte:head>
	<title>Formular consimÈ›ÄƒmÃ¢nt GDPR â€” service</title>
</svelte:head>

<div class="page">
	<div class="no-print toolbar">
		<button onclick={tipareste}>ðŸ–¨ï¸ TipÄƒreÈ™te formular</button>
		<a href="/legal/privacy" class="link">Vezi politica de confidenÈ›ialitate</a>
	</div>

	<div class="paper">
		<header class="hdr">
			<div>
				<h1>FORMULAR DE INFORMARE È˜I CONSIMÈšÄ‚MÃ‚NT</h1>
				<p class="sub">privind prelucrarea datelor cu caracter personal</p>
			</div>
			<div class="firma">
				<strong>[Denumire firmÄƒ SRL]</strong><br/>
				CUI: [______________]<br/>
				Sediu: [_________________________________]<br/>
				Tel: [_____________]  Email: contact@nlg.ro
			</div>
		</header>

		<section>
			<h2>I. Datele clientului</h2>
			<table class="form">
				<tbody>
				<tr><td>Nume È™i prenume</td><td class="fill"></td></tr>
				<tr><td>CNP</td><td class="fill"></td></tr>
				<tr><td>Serie / nr. CI</td><td class="fill"></td></tr>
				<tr><td>Domiciliu</td><td class="fill"></td></tr>
				<tr><td>Telefon</td><td class="fill"></td></tr>
				<tr><td>Email</td><td class="fill"></td></tr>
				<tr><td>Nr. Ã®nmatriculare auto</td><td class="fill"></td></tr>
				</tbody>
			</table>
		</section>

		<section>
			<h2>II. Operatorul de date</h2>
			<p>
				<strong>[Denumire firmÄƒ SRL]</strong>, CUI <strong>[______]</strong>, cu sediul Ã®n
				<strong>[___________________________]</strong>, Ã®n calitate de <em>operator de date cu caracter
				personal</em> conform Regulamentului (UE) 2016/679 (GDPR) È™i Legii nr. 190/2018.
			</p>
			<p>Contact protecÈ›ia datelor: <strong>gdpr@nlg.ro</strong> Â· DPO (dacÄƒ este desemnat): [______________]</p>
		</section>

		<section>
			<h2>III. Categorii de date prelucrate</h2>
			<ul>
				<li>date de identificare (nume, CNP, CI, semnÄƒturÄƒ)</li>
				<li>date de contact (telefon, email, adresÄƒ)</li>
				<li>date despre vehicul (marcÄƒ, model, VIN, nr. Ã®nmatriculare, talon, ITP, RCA, CASCO)</li>
				<li>date despre lucrÄƒri (devize, facturi, fotografii, istoric service)</li>
				<li>date de platÄƒ (sume, metode â€” fÄƒrÄƒ date de card)</li>
				<li>imagini CCTV (la sediu, pÄƒstrate 30 de zile)</li>
			</ul>
		</section>

		<section>
			<h2>IV. Scopuri È™i temeiuri legale</h2>
			<table class="info">
				<thead><tr><th>Scop</th><th>Temei legal</th><th>DuratÄƒ pÄƒstrare</th></tr></thead>
				<tbody>
					<tr><td>Executarea contractului de service</td><td>Art. 6(1)(b) GDPR â€” contract</td><td>Durata contractului + 3 ani</td></tr>
					<tr><td>Emiterea facturii È™i contabilitate</td><td>Art. 6(1)(c) â€” Legea contabilitÄƒÈ›ii, Cod fiscal</td><td>10 ani</td></tr>
					<tr><td>ObligaÈ›ii fiscale È™i de raportare</td><td>Art. 6(1)(c) â€” obligaÈ›ie legalÄƒ</td><td>10 ani</td></tr>
					<tr><td>ApÄƒrarea drepturilor Ã®n instanÈ›Äƒ</td><td>Art. 6(1)(f) â€” interes legitim</td><td>Termen prescripÈ›ie (max. 10 ani)</td></tr>
					<tr><td>Reminder ITP/RCA/revizii</td><td>Art. 6(1)(f) â€” interes legitim</td><td>Durata relaÈ›iei + 1 an</td></tr>
					<tr><td>CCTV</td><td>Art. 6(1)(f) â€” interes legitim, securitate</td><td>30 de zile</td></tr>
					<tr><td>Marketing direct (SMS/email cu oferte)</td><td>Art. 6(1)(a) â€” consimÈ›ÄƒmÃ¢nt explicit</td><td>PÃ¢nÄƒ la retragere</td></tr>
				</tbody>
			</table>
		</section>

		<section>
			<h2>V. Destinatari</h2>
			<p>Datele pot fi transmise cÄƒtre: furnizori de piese, RAR, asigurÄƒtori (cu acordul clientului),
			furnizori IT (hosting, email/SMS), contabil, autoritÄƒÈ›i publice (la cerere oficialÄƒ), avocaÈ›i.</p>
			<p><strong>Nu transferÄƒm date Ã®n afara UE/SEE</strong> fÄƒrÄƒ mÄƒsuri adecvate (clauze contractuale standard).</p>
		</section>

		<section>
			<h2>VI. Drepturile dumneavoastrÄƒ (art. 15â€“22 GDPR)</h2>
			<ul class="dense">
				<li>dreptul de acces la date</li>
				<li>dreptul la rectificare</li>
				<li>dreptul la È™tergere (â€ždreptul de a fi uitat")</li>
				<li>dreptul la restricÈ›ionarea prelucrÄƒrii</li>
				<li>dreptul la portabilitatea datelor</li>
				<li>dreptul de opoziÈ›ie (Ã®n special pentru marketing direct)</li>
				<li>dreptul de a nu fi supus unor decizii automate</li>
				<li>dreptul de a-È›i retrage consimÈ›ÄƒmÃ¢ntul oricÃ¢nd</li>
				<li>dreptul de a depune plÃ¢ngere la <strong>ANSPDCP</strong> (B-dul G. Magheru 28-30, BucureÈ™ti â€” dataprotection.ro)</li>
			</ul>
			<p>Cererile se adreseazÄƒ Ã®n scris la sediu sau pe email <strong>gdpr@nlg.ro</strong>.
			RÄƒspundem Ã®n maximum 30 de zile.</p>
		</section>

		<section class="acord">
			<h2>VII. DeclaraÈ›ii È™i consimÈ›ÄƒmÃ¢nt</h2>

			<p class="check">
				<span class="box-check"></span>
				<span><strong>Confirm</strong> cÄƒ am citit È™i am Ã®nÈ›eles informaÈ›iile de mai sus È™i sunt de acord
				cu prelucrarea datelor mele personale pentru executarea contractului de service È™i obligaÈ›iile legale.
				<em>(obligatoriu pentru prestarea serviciului)</em></span>
			</p>

			<p class="check">
				<span class="box-check"></span>
				<span>Sunt de acord sÄƒ primesc <strong>SMS/email cu oferte È™i promoÈ›ii</strong> de la NLG.
				<em>(opÈ›ional â€” Ã®l poÈ›i retrage oricÃ¢nd)</em></span>
			</p>

			<p class="check">
				<span class="box-check"></span>
				<span>Sunt de acord ca service-ul sÄƒ <strong>fotografieze vehiculul</strong> (interior/exterior)
				pentru documentarea stÄƒrii la primire/predare. <em>(opÈ›ional)</em></span>
			</p>

			<p class="check">
				<span class="box-check"></span>
				<span>Sunt de acord cu <strong>Ã®nregistrarea apelurilor telefonice</strong> pentru Ã®mbunÄƒtÄƒÈ›irea
				serviciilor. <em>(opÈ›ional)</em></span>
			</p>
		</section>

		<section class="semnaturi">
			<div class="sig">
				<p>Data: <span class="line short"></span></p>
				<p>Locul: <span class="line short"></span></p>
			</div>
			<div class="sig">
				<p><strong>SemnÄƒtura clientului</strong></p>
				<div class="sig-box"></div>
			</div>
			<div class="sig">
				<p><strong>Reprezentant NLG</strong></p>
				<p>Nume: <span class="line"></span></p>
				<p>FuncÈ›ie: <span class="line"></span></p>
				<div class="sig-box"></div>
			</div>
		</section>

		<footer class="ftr">
			<p>Acest formular se completeazÄƒ Ã®n 2 exemplare â€” unul rÄƒmÃ¢ne la client, unul la operator.
			Versiunea documentului: <strong>1.0 / 03.05.2026</strong>.</p>
		</footer>
	</div>
</div>

<style>
	.page { background: #f3f4f6; min-height: 100vh; padding: 1.5rem 1rem 4rem; }

	.toolbar {
		max-width: 800px; margin: 0 auto 1rem; display: flex; gap: 1rem; align-items: center;
		flex-wrap: wrap;
	}
	.toolbar button {
		background: #2563eb; color: white; border: none; padding: 0.6rem 1.2rem;
		border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-size: 0.9rem;
	}
	.toolbar button:hover { background: #1d4ed8; }
	.toolbar .link { color: #2563eb; font-size: 0.85rem; text-decoration: underline; }

	.paper {
		background: white; color: #111;
		max-width: 800px; margin: 0 auto;
		padding: 2.5rem 2.5rem 3rem;
		box-shadow: 0 8px 24px rgba(0,0,0,0.08);
		font-family: 'Times New Roman', Georgia, serif;
		font-size: 11pt; line-height: 1.45;
	}

	.hdr { display: flex; justify-content: space-between; gap: 2rem; align-items: flex-start;
		border-bottom: 2px solid #111; padding-bottom: 0.8rem; margin-bottom: 1.2rem; }
	.hdr h1 { font-size: 14pt; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
	.hdr .sub { font-size: 10pt; font-style: italic; margin: 0.2rem 0 0; }
	.hdr .firma { font-size: 9.5pt; text-align: right; line-height: 1.5; }

	section { margin-bottom: 1rem; page-break-inside: avoid; }
	h2 { font-size: 11.5pt; font-weight: 700; margin: 0.8rem 0 0.4rem; text-transform: uppercase; }
	p, li { font-size: 10.5pt; }

	ul { padding-left: 1.3rem; margin: 0.3rem 0; }
	ul.dense li { margin-bottom: 0.15rem; }

	table { width: 100%; border-collapse: collapse; margin: 0.4rem 0; }
	table.form td { border: 1px solid #444; padding: 0.4rem 0.6rem; font-size: 10pt; }
	table.form td:first-child { width: 35%; background: #f8f8f8; font-weight: 600; }
	table.form td.fill { height: 1.3rem; }

	table.info th, table.info td { border: 1px solid #555; padding: 0.35rem 0.5rem; font-size: 9.5pt; vertical-align: top; }
	table.info th { background: #e5e7eb; font-weight: 700; }

	.acord .check { display: flex; gap: 0.6rem; align-items: flex-start; margin: 0.55rem 0; }
	.box-check { display: inline-block; width: 14pt; height: 14pt; border: 1.5px solid #111;
		flex-shrink: 0; margin-top: 1pt; }
	.acord em { color: #444; font-size: 9.5pt; }

	.semnaturi {
		display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem;
		margin-top: 1.6rem; padding-top: 1rem; border-top: 1px solid #aaa;
	}
	.sig p { margin: 0.25rem 0; font-size: 10pt; }
	.line { display: inline-block; border-bottom: 1px solid #111; min-width: 6rem; height: 1em; }
	.line.short { min-width: 4rem; }
	.sig-box { border: 1px solid #111; height: 50pt; margin-top: 0.4rem; }

	.ftr { font-size: 8.5pt; color: #555; border-top: 1px solid #ddd; padding-top: 0.6rem;
		margin-top: 1.4rem; text-align: center; }

	@media print {
		.page { background: white; padding: 0; }
		.no-print { display: none !important; }
		.paper { box-shadow: none; max-width: none; padding: 1.2cm 1.4cm; margin: 0; }
		@page { size: A4; margin: 0.8cm; }
	}
</style>
