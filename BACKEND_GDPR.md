# Backend GDPR — specificație Laravel

Acest document descrie ce trebuie adăugat în backend-ul Laravel (`wms-main-6oacg2.laravel.cloud`)
pentru a susține fluxul GDPR din portal.

---

## 1. Migrare bază de date

### Tabel `consimtaminte_clienti`

```php
Schema::create('consimtaminte_clienti', function (Blueprint $t) {
    $t->id();
    $t->foreignId('client_id')->constrained('clienti')->cascadeOnDelete();
    $t->string('versiune', 16);                 // ex: "1.0"
    $t->string('tip', 32);                       // 'politica' | 'marketing' | 'foto' | 'apel'
    $t->boolean('acordat');                      // true = a dat acord; false = retras
    $t->timestamp('acordat_la');
    $t->timestamp('retras_la')->nullable();
    $t->string('canal', 32);                     // 'portal' | 'service' | 'register' | 'admin'
    $t->ipAddress('ip')->nullable();
    $t->string('user_agent', 500)->nullable();
    $t->text('continut_politica')->nullable();   // hash sau snapshot text politicii la momentul acordului
    $t->timestamps();

    $t->index(['client_id', 'tip']);
});
```

### Câmpuri suplimentare în tabelul `clienti`

```php
Schema::table('clienti', function (Blueprint $t) {
    $t->string('gdpr_versiune_acceptata', 16)->nullable();
    $t->timestamp('gdpr_acceptata_la')->nullable();
    $t->boolean('gdpr_marketing')->default(false);
    $t->timestamp('gdpr_marketing_acceptat_la')->nullable();
    $t->boolean('gdpr_foto')->default(false);
    $t->boolean('gdpr_apel')->default(false);
    $t->timestamp('cerere_stergere_la')->nullable();    // data programată ștergerii (azi + 30 zile)
    $t->text('cerere_stergere_motiv')->nullable();
});
```

### Tabel `cereri_gdpr` (pentru audit + cereri rectificare/restricționare)

```php
Schema::create('cereri_gdpr', function (Blueprint $t) {
    $t->id();
    $t->foreignId('client_id')->constrained('clienti')->cascadeOnDelete();
    $t->string('tip', 32);    // 'rectificare' | 'restrictionare' | 'opozitie' | 'stergere' | 'export'
    $t->string('status', 16)->default('deschisa'); // 'deschisa' | 'in_lucru' | 'rezolvata' | 'respinsa'
    $t->text('mesaj')->nullable();
    $t->text('raspuns')->nullable();
    $t->timestamp('rezolvata_la')->nullable();
    $t->foreignId('rezolvat_de')->nullable()->constrained('users');
    $t->timestamps();
});
```

---

## 2. Constanta versiune politică

```php
// config/gdpr.php
return [
    'versiune_politica' => '1.0',
    'data_versiune'     => '2026-05-03',
    'email_dpo'         => 'gdpr@nlg.ro',
    'durata_retentie' => [
        'documente_fiscale' => 10 * 365,    // 10 ani — Cod fiscal
        'contractual'       => 3 * 365,     // 3 ani după încheiere
        'log_acces'         => 365,         // 12 luni
        'cctv'              => 30,
        'cont_inactiv'      => 3 * 365,
    ],
];
```

---

## 3. Rute API (în `routes/api.php`, sub middleware portal/auth)

```php
Route::prefix('portal/gdpr')->middleware('auth:portal')->group(function () {
    Route::get('/consimtaminte',                 [GdprController::class, 'status']);
    Route::post('/consimtaminte',                [GdprController::class, 'accepta']);
    Route::delete('/consimtaminte/{tip}',        [GdprController::class, 'retrage']);

    Route::get('/export',                        [GdprController::class, 'export']);
    Route::post('/cerere-stergere',              [GdprController::class, 'cerereStergere']);
    Route::delete('/cerere-stergere',            [GdprController::class, 'anuleazaStergere']);
    Route::post('/cerere-rectificare',           [GdprController::class, 'cerereRectificare']);
});
```

Și ruta publică pentru `register` — modifică controller-ul existent să accepte
`acord_politica`, `acord_marketing`, `politica_versiune` și să creeze înregistrări
în `consimtaminte_clienti`.

---

## 4. Endpoint-uri — contract JSON

### `GET /api/portal/gdpr/consimtaminte`

```json
{
  "versiune_curenta":      "1.0",
  "versiune_acceptata":    "1.0",            // null dacă nu a acceptat încă
  "necesita_acceptare":    false,             // true → afișează modal blocant
  "politica_acceptata_la": "2026-05-03T10:22:11Z",
  "marketing":             true,
  "marketing_acceptat_la": "2026-05-03T10:22:11Z",
  "foto":                  false,
  "apel":                  false,
  "cerere_stergere_la":    null
}
```

`necesita_acceptare = true` când:
- `gdpr_versiune_acceptata` IS NULL, **sau**
- `gdpr_versiune_acceptata != config('gdpr.versiune_politica')`

### `POST /api/portal/gdpr/consimtaminte`

Body:
```json
{ "versiune": "1.0", "politica": true, "marketing": false, "foto": false, "apel": false }
```

Logică:
1. Validează `versiune == config('gdpr.versiune_politica')` și `politica == true`.
2. Salvează în `consimtaminte_clienti` un rând per `tip` (cu `ip`, `user_agent`, `canal: 'portal'`).
3. Update `clienti.gdpr_versiune_acceptata`, `gdpr_acceptata_la`, `gdpr_marketing`, etc.
4. Răspuns: `{ "ok": true }`.

### `DELETE /api/portal/gdpr/consimtaminte/{tip}`

`tip ∈ ['marketing', 'foto', 'apel']` (politica NU se poate retrage cât timp ai cont).

1. Marchează ultima înregistrare din `consimtaminte_clienti` cu `retras_la = now()`.
2. Update flag în `clienti`.
3. Răspuns: `{ "ok": true }`.

### `GET /api/portal/gdpr/export`

Răspuns: download JSON cu toate datele clientului — implementare:

```php
public function export(Request $r) {
    $client = $r->user();

    $payload = [
        'generat_la'    => now()->toIso8601String(),
        'profil'        => $client->only(['id','nume','prenume','telefon','email','cnp','adresa','ci_serie','ci_numar']),
        'consimtaminte' => $client->consimtaminte,
        'masini'        => $client->masini,
        'reparatii'     => $client->reparatii()->with('servicii','piese')->get(),
        'programari'    => $client->programari,
        'documente'     => $client->facturi,
        'mesaje'        => $client->mesajeDirecte,
        'notificari'    => $client->notificari,
    ];

    return response()->json($payload, 200, [
        'Content-Disposition' => 'attachment; filename="date-personale-' . now()->format('Y-m-d') . '.json"',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
```

### `POST /api/portal/gdpr/cerere-stergere`

Body opțional: `{ "motiv": "..." }`

```php
$client->update([
    'cerere_stergere_la'    => now()->addDays(30),
    'cerere_stergere_motiv' => $r->input('motiv'),
]);

CereriGdpr::create(['client_id' => $client->id, 'tip' => 'stergere', 'mesaj' => $r->input('motiv')]);

// Notifică echipa (mail / chat intern)
NotificaAdminGdpr::dispatch($client, 'stergere');

return response()->json([
    'message'        => 'Cererea a fost înregistrată.',
    'programata_la'  => $client->cerere_stergere_la->toIso8601String(),
]);
```

### `DELETE /api/portal/gdpr/cerere-stergere`

Anulează (cât timp `cerere_stergere_la > now()`).

### `POST /api/portal/gdpr/cerere-rectificare`

Body: `{ "mesaj": "..." }` → creează `CereriGdpr` cu tip `rectificare`, notifică operator.

---

## 5. Job de ștergere (Scheduler)

```php
// app/Console/Kernel.php
$schedule->command('gdpr:proceseaza-stergeri')->dailyAt('02:00');
```

```php
// app/Console/Commands/ProceseazaStergeriGdpr.php
Client::whereNotNull('cerere_stergere_la')
    ->where('cerere_stergere_la', '<=', now())
    ->each(function ($client) {
        // 1. Anonimizează datele NEobligatorii (păstrează facturile 10 ani)
        $client->update([
            'nume'       => 'CLIENT_STERS',
            'prenume'    => null,
            'telefon'    => 'STERS_' . $client->id,
            'email'      => null,
            'cnp'        => null,
            'ci_serie'   => null,
            'ci_numar'   => null,
            'adresa'     => null,
            'sters_la'   => now(),
        ]);

        // 2. Șterge mașini, fotografii, mesaje, notificări
        $client->masini()->delete();
        $client->mesajeDirecte()->delete();
        $client->notificari()->delete();

        // 3. NU șterge: facturi, devize semnate, comenzi reparație finalizate (10 ani)
    });
```

---

## 6. Modificări pe register-ul public

În `POST /api/portal/public/inregistrare` adaugă validare:

```php
$r->validate([
    // ... câmpurile existente
    'acord_politica'    => ['required', 'accepted'],
    'politica_versiune' => ['required', 'string', 'in:' . config('gdpr.versiune_politica')],
    'acord_marketing'   => ['boolean'],
]);
```

Și după create client, salvează 1-2 consimțăminte în `consimtaminte_clienti` (tip: `politica`,
și opțional `marketing`).

---

## 7. Notificare breșă de securitate (art. 33 GDPR)

Procedura internă:
- Detectare → log în `cereri_gdpr` cu tip `breach`.
- Notifică ANSPDCP în **72 ore** la <https://www.dataprotection.ro> (formular online).
- Dacă breșa prezintă risc ridicat pentru drepturile persoanelor → notifică direct utilizatorii afectați.

---

## 8. Checklist conformitate

- [ ] Migrările aplicate
- [ ] Configurarea `config/gdpr.php`
- [ ] GdprController implementat și testat
- [ ] Job scheduler configurat
- [ ] Email `gdpr@nlg.ro` configurat și monitorizat
- [ ] DPA-uri semnate cu: hosting (Laravel Cloud), SMS gateway, email provider, contabil
- [ ] Politica de confidențialitate publicată la `/legal/privacy`
- [ ] Formular consimțământ tipărit disponibil pentru clienții la sediu
- [ ] Personal instruit GDPR
- [ ] Registru activități prelucrare (art. 30) ținut la zi
- [ ] Procedură de notificare breșă documentată

---

## 9. Versionare politică

Când actualizezi politica de confidențialitate:
1. Crește `config('gdpr.versiune_politica')` (ex: `1.0` → `1.1`).
2. Actualizează `/legal/privacy` și `/legal/terms` în portal.
3. Toți utilizatorii vor primi automat modal blocant la următorul login.
4. Păstrează versiunile vechi într-un repo / arhivă pentru audit.
