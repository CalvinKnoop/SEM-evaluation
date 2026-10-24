# SEM Circle Study – v0.2 (zentrale Datenspeicherung)

Website für die Kreisannotation von synthetischen und später echten SEM-Bildern. Hosting über **GitHub Pages**, Speicherung über **Supabase**. Die Annotation bleibt lokal nutzbar, bis die zentrale Speicherung eingerichtet wurde.

**Vorbereitete Funktionen:** Drei Kalibrierungsbilder, Maus-/Tastatursteuerung, anschließend beliebig viele weitere Bilder; Speichern der fertigen Annotationen als JSON im Browser, optionaler Upload nach Einwilligung, Warteschlange bei Netzwerkfehlern, JSON-Gesamtexport als Backup. Die bereits gesammelten Daten aus v0.1 bleiben im selben Browser erhalten (`sem-circle-study-v01-data`). Bei einer Einwilligung werden sie ebenfalls übertragen, einschließlich früherer Testdaten.

## 1. Supabase-Projekt erstellen

1. Öffne <https://supabase.com/dashboard> und melde dich an.
2. **New project** erstellen, Namen zum Beispiel `sem-circle-study`. Sichere das erzeugte Datenbankpasswort, es gehört nicht auf GitHub.
3. Wähle eine geeignete Region (für Forschung und Datenschutz den Standort mit deiner Institution abstimmen).
4. Warte, bis dein Projekt bereitsteht.

## 2. Datenbanktabelle und Schutzregeln anlegen

1. Im Supabase-Dashboard links **SQL Editor** öffnen.
2. Den **gesamten Inhalt** von [`supabase_setup.sql`](supabase_setup.sql) einfügen.
3. Auf **Run** klicken.
4. Unter **Table Editor** sollte `sem_annotations` sichtbar sein.

Das SQL-Skript aktiviert **Row Level Security** (RLS). Teilnehmende dürfen nach anonymer Anmeldung **nur neue Zeilen schreiben**, sie dürfen über die Website **keine Daten anderer Personen lesen, ändern oder löschen**. Projektadministratoren können die Daten über ihr Supabase-Dashboard lesen und exportieren. RLS niemals für diese Tabelle deaktivieren.

## 3. Anonyme Anmeldung aktivieren

Im Supabase-Dashboard zu **Authentication → Sign In / Providers** bzw. in den Einstellungen zu **Allow anonymous sign-ins** navigieren und die anonymen Logins aktivieren. Diese Anmeldung verlangt weder Name noch E-Mail. Sie dient der getrennten Zuordnung von Browser-Sitzungen und der sicheren RLS-Prüfung.

Bei öffentlicher Nutzung sollten außerdem CAPTCHA/Turnstile, Rate Limits und die Supabase-Quoten geprüft werden, um automatisierte Spam-Einträge zu begrenzen.

## 4. URL und öffentlichen Schlüssel eintragen

1. Im Supabase-Projekt **Connect** oder **Settings → API Keys** öffnen.
2. **Project URL** und den **publishable key** kopieren (`sb_publishable_...`).
3. Die Datei `supabase-config.js` öffnen und eintragen:

```javascript
window.SUPABASE_CONFIG = {
  url: 'https://DEINE-PROJEKT-ID.supabase.co',
  publishableKey: 'sb_publishable_DEIN_OEFFENTLICHER_KEY'
};
```

**Wichtig:** Nur der *publishable* Key darf in GitHub Pages stehen. **Niemals** einen `service_role`-Key oder `sb_secret_...` in Website-Dateien, GitHub, Screenshots oder Chat-Nachrichten veröffentlichen! Die Sicherheit kommt von der Kombination aus anonymem Login und RLS.

## 5. GitHub Pages aktualisieren

Repository: <https://github.com/CalvinKnoop/SEM-evaluation>.

Auf **Add file → Upload files** die neuen und geänderten Dateien aus diesem ZIP hochladen. Achte darauf, dass sich `index.html`, `app.js`, `cloud.js`, `supabase-config.js` usw. **direkt im Hauptverzeichnis** befinden. Vorhandene Dateien mit gleichem Namen müssen ersetzt werden. Anschließend **Commit changes** klicken.

GitHub Pages bleibt bei **Settings → Pages** auf `Deploy from a branch`, `main` und `/ (root)`.

Website: <https://calvinknoop.github.io/SEM-evaluation/>.

**Alternative zum Upload vieler Dateien:** In deinem lokalen Repository die Dateien ersetzen, dann mit Git commit und push hochladen. Lade nicht das ZIP selbst als Website hoch.

## 6. Testen – bevor du weitere Freunde einlädst

1. Öffne die Website und aktualisiere mit `Strg + F5`, damit die neuen Skripte geladen werden.
2. Auf der Startseite die Einwilligung zur **zentralen Übertragung** aktivieren.
3. Einen Kreis im ersten Testbild zeichnen und auf **Test abschließen** klicken.
4. Der obere Status sollte zunächst den Upload anzeigen und anschließend **Alle Annotationen zentral gespeichert** melden.
5. Im Supabase-Dashboard **Table Editor → sem_annotations** öffnen und prüfen, dass eine neue Zeile eingetroffen ist.
6. Prüfe `image_id = calibration_01`, `mode = calibration`, `circles` mit den Kreisparametern.
7. Für die Fehlerprobe die Internetverbindung kurz unterbrechen oder den Browser in den DevTools auf Offline schalten, ein weiteres Bild abschließen und später **Jetzt synchronisieren** klicken. Bis dahin bleibt die Annotation lokal vorhanden.
8. Weiterhin regelmäßig **Alle Daten exportieren** für ein unabhängiges JSON-Backup nutzen.

**Statusmeldungen:**
- `Nur lokal · Supabase nicht konfiguriert`: URL/Key fehlt, ungültig oder Supabase-JavaScript konnte nicht laden.
- `Nur lokal · keine Einwilligung`: keine Übertragung; lokale Annotation ist weiter möglich.
- `X lokal gesichert · Upload fehlgeschlagen`: Daten bleiben im Browser; **Jetzt synchronisieren** und die Browser-Konsole (F12) auf Fehlermeldungen prüfen.
- `Alle Annotationen zentral gespeichert`: Alle lokalen fertigen Einträge wurden erfolgreich übertragen oder bereits in der Datenbank erkannt.

Wenn der Upload fehlschlägt, kontrolliere zuerst: anonyme Anmeldung aktiviert, SQL-Skript ausgeführt, `supabase-config.js` wirklich hochgeladen, kein Secret-Key versehentlich eingetragen.

## 7. Daten in Supabase prüfen und exportieren

Im Dashboard als Projektadministrator: **Table Editor → sem_annotations**. Zur Übersicht kann auch im SQL Editor dieser Befehl laufen:

```sql
select mode, image_id, count(*) as annotations,
       sum(jsonb_array_length(circles)) as circles
from public.sem_annotations
 group by mode, image_id
 order by mode, image_id;
```

Der CSV-Export der Tabelle enthält das Feld `circles` als JSON-Text. Du kannst es später mit Python (`json.loads`) verarbeiten. `annotation_id` ist eindeutig pro angemeldetem Nutzer; doppelte Uploads desselben Datensatzes werden abgewiesen und vom Browser als bereits gespeichert erkannt.

## 8. Was vor öffentlicher Rekrutierung noch nötig ist

- **`datenschutz.html` ergänzen:** Verantwortliche Forschungseinrichtung, Ansprechpartner, Rechtsgrundlage, Hosting/Datenbankregion, Fristen, Lösch-/Widerrufsverfahren und erforderliche weitere Datenschutzinformationen.
- **Institutionellen Datenschutz / Forschungsethik klären**, besonders wenn weitere Teilnehmende außerhalb des Freundeskreises rekrutiert werden.
- Die aktuell öffentlich verfügbaren `calibration_truth.js` und `calibration_truth.json` enthalten die Referenzradien. Für wissenschaftlich blinde Kalibrierung muss die Auswertung später serverseitig erfolgen; das derzeitige Ergebnis ist **nicht gegen Einsicht in die Ground Truth geschützt**.
- Bilder sind weiterhin synthetisch. **Echte SEM-Bilder** und ein balancierter Vergabemechanismus folgen in der nächsten Projektphase.
- Supabase schützt nicht automatisch gegen Massen-Spam von neu registrierten anonymen Nutzern; CAPTCHA, Limits und Monitoring sind sinnvoll, bevor der Link breit verteilt wird.

## Dateiliste

- `index.html`, `styles.css`: Oberfläche
- `app.js`: Kreisannotation, bestehender Datenexport und neue Synchronisationswarteschlange
- `cloud.js`: Supabase-Anmeldung und Upload
- `supabase-config.js`: Projekt-URL und öffentlicher API-Key
- `supabase_setup.sql`: Datenbanktabelle und RLS
- `datenschutz.html`: noch zu vervollständigende Informationsvorlage
- `images/`: synthetische Test- und Demobilder
- `calibration_truth.js`, `.json`: **nur Demo, öffentlich einsehbar**
- `tools/export_to_numpy.py`: bestehendes Offline-Exportwerkzeug

