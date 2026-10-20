# PackForge

Smarte Packlisten als dependency-freie PWA – Apple-Liquid-Glass-Oberfläche, keine Build-Kette, alles lokal.

## Features

- **Reise-Generator**: Reisename, Tages-Slider mit Stepper, Mehrfachauswahl der Reiseart (Städtetrip, Strand, Wandern, Business) und Wetter (Sonnig, Kalt, Regen).
- **Rule Configurator**: Für Unterwäsche, Socken, Oberteile und Hosen/Unterteile lässt sich je Formel „1 pro 2 Tage“, „1 pro Tag“, „2 pro Tag“ oder „3 pro Tag“ plus Puffer (0–10) einstellen. Die Vorschau rechnet live mit der aktuellen Reisedauer; gespeichert wird automatisch.
- **Interaktive Checkliste**: Glas-Karten nach Kategorien (Kleidung, Kulturbeutel, Dokumente, Technik, Sonstiges), animierte Checkboxen, Fortschrittsring nach Stückzahl, Mengen-Stepper, Löschen, eigene Items.
- **Mengen neu berechnen**: übernimmt geänderte Formeln in eine bestehende Liste und behält Custom-Items sowie Haken.
- **LocalStorage**: aktive Reise, Archiv (max. 30 Listen), Formeln und Vorlieben; JSON-Export/-Import und Reset.
- **iPhone-PWA**: Safe-Area-Insets, 16px-Inputs gegen Auto-Zoom, `viewport-fit=cover`, Haptik via `navigator.vibrate` (wo unterstützt), Offline-App-Shell.

## Starten

```bash
python3 -m http.server 4173
# http://127.0.0.1:4173
```

Für den Service Worker muss die App über `http://localhost` oder HTTPS laufen.

## Struktur

| Datei | Zweck |
| --- | --- |
| `index.html` | App-Shell, Inline-SVG-Icon-Sprite, drei Tabs |
| `app.css` | Liquid-Glass-Designsystem, Animationen, Responsive |
| `app.js` | State, Rendering, Events, Persistenz |
| `packing.js` | Pure Packlogik und Formel-Engine (Node-testbar) |
| `sw.js` | Offline-Cache der App-Shell |
| `manifest.webmanifest` | PWA-Metadaten |
| `icons/` | generierte Glas-Icons |
| `tools/make-icons.py` | Icongenerator (Python-Standardbibliothek) |

## Tests

```bash
node --test tests/
```

16 Tests decken Tages-Clamping, Formel-Normalisierung, Ratio/Puffer-Rechnung, Wetter- und Reiseart-Regeln, Kategorien, Fortschritt und Neuberechnung ab.

## Speicherformat

`localStorage["packforge:v2"]`:

```json
{
  "version": 2,
  "active": { "id": "…", "name": "Paris", "days": 5, "types": ["Städtetrip"], "weather": "Sonnig", "items": [] },
  "archive": [],
  "prefs": { "days": 5, "types": ["Städtetrip"], "weather": "Sonnig" },
  "rules": {
    "underwear": { "perDay": 1, "buffer": 1 },
    "socks": { "perDay": 1, "buffer": 1 },
    "tops": { "perDay": 1, "buffer": 0 },
    "bottoms": { "perDay": 0.5, "buffer": 0 }
  }
}
```

Beim ersten Start werden Daten aus dem alten `packforge:v1`-Format (Pixel-Edition) automatisch übernommen: `Elektronik` → `Technik`, `Kosmetik` → `Kulturbeutel`, `Outdoor` → `Wandern`, `Gemischt` → `Regen`.
