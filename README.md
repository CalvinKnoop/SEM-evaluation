# SEM Circle Study · v0.1 (lokaler Prototyp)

**Zweck:** Eine einfache Website zum Testen des manuellen Einzeichnens von Kugeln in synthetischen SEM-ähnlichen Bildern. Noch **keine Online-Studie**: Annotationen werden ausschließlich im Browser gespeichert und lassen sich als JSON exportieren.

## 1. Sofort ausprobieren

1. ZIP-Datei entpacken.
2. `index.html` in Firefox, Chrome oder Edge öffnen (Doppelklick). Falls lokale Dateien eingeschränkt sind, die folgende Alternative benutzen.
3. Auf **Drei Testbilder beginnen** klicken.
4. Kreise mit gedrückter linker Maustaste zeichnen und bei Bedarf nachjustieren.
5. Die drei Kalibrierungsbilder abschließen. Anschließend weitere Demo-Bildausschnitte ohne festes Ende annotieren.
6. **Alle Daten exportieren** drücken: Der Browser lädt eine JSON-Datei herunter.

**Stabilere Alternative** (wenn Bilder im Browser nicht laden): Terminal im entpackten Ordner öffnen, `python -m http.server 8000` ausführen und `http://localhost:8000/` aufrufen. Terminal offen lassen, solange die Seite läuft.

## 2. Steuerung

| Aktion | Eingabe |
|---|---|
| Neuen Kreis zeichnen | Linke Maustaste drücken und nach außen ziehen |
| Kreis verschieben | Mittelpunkt anklicken und ziehen |
| Radius korrigieren | Kreisrand ziehen oder Mausrad über dem Bild bei ausgewähltem Kreis |
| Mittelpunkt 1 px | Pfeiltasten |
| Mittelpunkt 0,1 px | Shift + Pfeiltasten |
| Radius 1 px | Mausrad |
| Radius 0,1 px | Shift + Mausrad |
| Zoom | `+`, `-` oder Buttons |
| Bildausschnitt verschieben | Alt + ziehen oder rechte Maustaste ziehen |
| Auswahl löschen | Entf |
| Rückgängig | Strg + Z |

Die Kreislinie ist um den mathematischen Radius zentriert. Alle exportierten Koordinaten beziehen sich auf **Originalbildpixel** (unabhängig von Zoom oder Fenstergröße).

## 3. JSON in Cellpose-kompatible Instanzmatrix umwandeln

Python-Script ist im Ordner `tools` enthalten. Voraussetzung: NumPy.

```bash
python -m pip install numpy
python tools/export_to_numpy.py "sem_circle_annotations_XXXXXXXX.json"
```

Ausgabe pro Bild im Ordner `exported_annotations/`:

- `instance_masks.npy`: `(height,width)` Integer-Array, 0 Hintergrund, positive Werte Kreis-IDs
- `circles.csv`: Mittelpunkt, Radius, Durchmesser, Zeichenreihenfolge
- `metadata.json`: Provenienz und Konventionen

**Wichtig:** Dies sind Masken von *ganzen Kreismodellen*, keine pixelgenau handsegmentierten SEM-Konturen. Bei Überlappung gewinnt der zuletzt eingezeichnete Kreis. Die CSV erhält alle ursprünglichen Kreisparameter.

## 4. Dateien

```text
sem-circle-study-v01/
├── index.html                Startseite + Annotationstool
├── styles.css                Design
├── app.js                    Maussteuerung, Auswertung, JSON-Export
├── calibration_truth.js      Referenzkreise NUR für lokalen Demo-Score
├── calibration_truth.json    Referenzdaten für reproduzierbare Demo
├── images/                   3 Kalibrierungs- + 3 weitere Demo-Bilder
└── tools/
    ├── make_demo_images.py   Generiert die sechs Demo-Bilder deterministisch neu
    └── export_to_numpy.py    JSON -> CSV und `.npy` Instanzmasken
```

## 5. Bilder durch eigene Aufnahmen ersetzen

Für die lokale Erprobung kann man `images/demo_sem_01.png`, `demo_sem_02.png` und `demo_sem_03.png` durch PNG-Dateien mit gleichem Dateinamen ersetzen. Die Datenbank für die spätere Studie wird eine explizite Bild-ID und Bildversion speichern, damit Annotationen immer der exakt verwendeten Aufnahme zugeordnet werden können. Achte auf Nutzungsrechte und ob SEM-Aufnahmen öffentlich gezeigt werden dürfen.

## 6. GitHub Pages: Schritt für Schritt (erst für Testversion)

1. GitHub-Konto erstellen oder anmelden unter https://github.com .
2. **New repository** anlegen, zum Beispiel `sem-circle-study`. Für GitHub Pages im kostenlosen Standardworkflow empfiehlt sich ein öffentliches Repository (geprüfte aktuelle Planregeln beachten).
3. **Add file -> Upload files** und alle Dateien und den Ordner `images` hochladen (nicht nur das ZIP, sondern dessen entpackten Inhalt). `index.html` muss im Repository-Hauptverzeichnis liegen.
4. **Settings -> Pages -> Build and deployment -> Deploy from a branch** auswählen, Branch `main`, Ordner `/ (root)`, **Save**.
5. Nach erfolgreichem Deployment auf `https://DEIN-NAME.github.io/sem-circle-study/` öffnen.

Offizielle Anleitung: https://docs.github.com/en/pages/quickstart .

GitHub Pages stellt nur die Website bereit. **Es speichert keine Annotationen auf dem Server.** Die erste öffentliche Testversion würde ausschließlich JSON-Downloads erzeugen. Andere Teilnehmende müssten dir diese Dateien selbst zusenden.

## 7. Vor einer echten öffentlichen Datenerhebung

- **Keine** `calibration_truth.js` oder Referenzradien an den öffentlichen Browser ausliefern, wenn eine nicht manipulierbare Qualitätsprüfung erforderlich ist. Für produktive Kalibrierung Referenzwerte serverseitig halten und nach Einreichung dort auswerten.
- Datenbank / API: z. B. Supabase. Niemals geheime `service_role`-Schlüssel im Browser ablegen. Row Level Security (RLS) mit minimalen Schreibrechten einsetzen; anonyme Authentisierung, Rate-Limits und Missbrauchsschutz testen. Unbegrenzt Bilder annotieren heißt **nicht** unbegrenzt ungeprüfte Schreibanfragen zulassen.
- Einwilligung, Datenschutzinformation, wissenschaftliche Dokumentation, Versions- und Bildprotokollierung vorbereiten. Auch pseudonyme IDs und Nutzungsmetadaten können datenschutzrelevant sein.
- Für echte Aufnahmen keine automatische Ground-Truth-Behauptung: menschliche Annotationen liefern Wiederholbarkeits- und Konsensinformationen, nicht zwingend den echten 3D-Kugelradius.
- Browser-Zwischenspeicher (`localStorage`) ist **kein Backup**. Regelmäßig JSON exportieren; Browserdaten können gelöscht werden.

## 8. Technische Grenzen von v0.1

Die Testbilder sind synthetisch und illustrieren die Bedienung. Das Zuordnungsverfahren für die Kalibrierung ist eine vereinfachte heuristische Paarung und noch kein validierter Score. Der Browser speichert lokal, nicht online. Die drei Bilder nach der Kalibrierung sind vorläufig ebenfalls synthetische Demos, keine echten SEM-Bilder.

---

Projektname **SEM Circle Study** ist ein vorläufiger Arbeitstitel, keine markenrechtlich geprüfte Produktbezeichnung.
