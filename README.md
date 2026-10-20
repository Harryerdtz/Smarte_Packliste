# PackForge

Smarte Packlisten-PWA im Pixel-Art-Look. Reisedauer, Kategorie und Wetter rein – Menge und Zusatz-Items kommen automatisch.

## Starten

Kein Build, keine Abhängigkeiten. Einfach den Ordner statisch ausliefern:

```bash
python3 -m http.server 4173
# http://127.0.0.1:4173
```

Alternativ über einen beliebigen Static-Host ausliefern. Für Service Worker und Installation wird HTTPS (oder `localhost`) benötigt.

## Funktionen

- **Generator**: Reise-Name, 1–60 Tage, Städtetrip / Strand / Outdoor / Business, Sonnig / Kalt / Gemischt.
- **Auto-Mengen**: Unterwäsche und Socken = Tage + 1, T-Shirts = Tage, Hosen gestaffelt nach Kategorie.
- **Wetter- und Kategorie-Items**: Badezeug, Wanderschuhe, Laptop, Regenschirm, Sonnencreme, Kulturbeutel und mehr.
- **Kategorien**: Kleidung, Elektronik, Dokumente, Kosmetik, Sonstiges.
- **Checkliste**: Pixel-Checkbox, durchgestrichene Optik, Fortschritt nach Stückzahl, Mengen anpassen, löschen.
- **Eigene Items** mit Kategorie.
- **Archiv**: alte Reisen laden oder löschen.
- **Lokal**: LocalStorage, Export/Import als JSON, Reset.
- **PWA**: Manifest, Icons, Offline-Cache, Safe Areas, große Touch-Flächen.
- **Ohne Emojis**: ausschließlich CSS/SVG-Pixelgrafik.

## Struktur

```
index.html            App-Shell und Pixel-Icon-Sprite
app.css               Retro-Design, Mobile/Safe-Area-Layout
app.js                UI-Controller, LocalStorage, Import/Export
packing.js            reine Packlogik (auch per Node testbar)
sw.js                 Service Worker (App-Shell offline)
manifest.webmanifest  PWA-Manifest
tools/make-icons.py   erzeugt die PNG-Icons ohne Abhängigkeiten
```

## Tests

Die Packlogik ist ohne DOM testbar:

```bash
node --test tests/
```

## Datenformat

Alles liegt unter dem LocalStorage-Key `packforge:v1`:

```json
{
  "version": 1,
  "active": { "id": "...", "name": "Wochenende Berlin", "days": 3, "category": "Städtetrip", "weather": "Sonnig", "createdAt": 0, "items": [] },
  "archive": [],
  "prefs": { "category": "Städtetrip", "weather": "Sonnig" }
}
```
