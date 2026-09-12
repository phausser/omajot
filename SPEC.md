# Omajot — Quick-Note Overlay für Omarchy

Status: Entwurf  
Zielversion: v1  
Name: Omajot  
Plugin-id: `io.github.phausser.omajot`  
Kind: `overlay`

## 1. Zweck

Ein Tastendruck fängt einen Gedanken, ohne den Fokus im aktuellen Fenster zu verlieren.

Keine Notiz-App. Kein Markdown-Editor. Kein zweites Obsidian.

Capture: eine Zeile, Enter, weg.

## 2. Problem

Beim Coden entstehen ständig kurze Notizen, die nicht in die Datei unter dem Cursor gehören:

- morgen-Todos
- URLs
- ein Satz für Slack oder die PR
- ein Stacktrace-Schnipsel

Heute landet das in der Clipboard-History, in zufälligen Kommentaren oder nirgendwo.

## 3. Nicht-Ziele (v1)

- Mehrere Notizbücher, Tags, Ordner, Volltextsuche
- Rich text, Markdown-Preview, Syntax-Highlighting
- Neovim-Remote-Buffer als Pflichtpfad
- Sync (Notion, Obsidian-Vault-API, Cloud)
- Bar-Widget, Badge, ungelesene-Zähler
- LLM-Sortierung
- Verlaufs-UI mit Löschen/Umbenennen (Review passiert in der Datei)
- Eigenes Notiz-Verzeichnis (`~/Notes` o. ä.)

## 4. Nutzerfluss

1. `Super + N` (falls belegt: eine zuvor geprüfte freie Alternative) öffnet ein schmales Overlay über dem fokussierten Monitor.
2. Ein Textfeld hat sofort den Fokus. Placeholder: `jot ▸`
3. Tippen.
4. `Enter` hängt die Zeile an den konfigurierten Pfad (Default: `~/omajot.md`) an und schließt das Overlay.
5. Fokus kehrt zum vorherigen Fenster zurück.
6. `Escape` verwirft und schließt, nichts wird geschrieben.
7. Leere Zeile + `Enter` ist ein No-op (schließen ohne Write).
8. `Super + N` bei offenem Overlay schließt ohne Write (Toggle).

Weitere v1-Funktionen:

- Pfeil-hoch lädt den Text der zuletzt gespeicherten Zeile aus der konfigurierten Datei ohne Zeitstempel zum Bearbeiten. Erneutes Enter hängt eine neue Zeile an; die bestehende Zeile bleibt erhalten.
- Ein separater Hotkey öffnet die konfigurierte Datei (Default: `~/omajot.md`) im Standard-Editor. Die konkrete freie Belegung vor Integration prüfen; `Super + Shift + N` ist bereits mit „Editor“ belegt.

## 5. Persistenz

Default-Senke: **eine Datei im Home**, kein extra Ordner.

```text
~/omajot.md
```

Keine Anlage von `~/Notes` oder `~/.local/share/omajot/`. Fehlt die Zieldatei, wird nur diese Datei erzeugt. Das Elternverzeichnis muss existieren; es werden keine Verzeichnisse angelegt.

Jede gespeicherte Zeile:

```markdown
2026-09-10 15:01  morgen index auf users.email
```

Format:

- ISO-Datum lokal `YYYY-MM-DD HH:mm`
- zwei Leerzeichen
- getrimmter Text
- abschließendes `\n`
- UTF-8
- Append only, keine Rewrite der Datei

Pfad-Konfiguration ist in v1 verpflichtend; ohne Einstellung gilt der Default.
Konfiguration in `~/.config/omajot.json` (optional anzulegen):

```json
{
  "path": "~/omajot.md"
}
```

Die installierte Shell übergibt Overlays keine eigenen Einstellungen aus `shell.json`; daher liest das Overlay diese separate JSON-Datei. Fehlende Datei oder fehlender `path`-Eintrag verwendet den Default. Ungültige oder unlesbare Konfiguration verhindert Writes und erhält die Eingabe. Änderungen werden automatisch neu geladen.

Erlaubt sind absolute Pfade und `~/…`; keine Expansion von Umgebungsvariablen oder `~user`. Pfad-Expansion: `~` → Home. Schreiben, Laden der letzten Zeile und Öffnen im Editor verwenden denselben konfigurierten Pfad. Zeitstempel bleiben in v1 verpflichtend.

Keine Secrets-Erkennung in v1. Die Datei ist Klartext.

## 6. UI

- Kind `overlay`, fullscreen-host, Inhalt zentriert oben oder mittig, nicht kantenfüllend.
- Eine Karte / eine Zeile, Breite ca. 560–640 px, Höhe einer Input-Zeile plus Padding.
- Schrift, Farben, Radius, Spacing über `qs.Ui` / `qs.Commons` / `Style.*`.
- Kein eigenes Farbschema.
- Kein Drop-Shadow-Theater, keine zweite Spalte, kein Logo.
- Vergleichbare Dichte wie `omarchy.emojis` / `omarchy.clipboard` / Reminders-Flow.

Tasten im Overlay:

| Taste | Aktion |
|---|---|
| Zeichen | Eingabe |
| Enter | Speichern + schließen |
| Escape | Verwerfen + schließen |
| Ctrl+U | Zeile leeren |
| Pfeil-hoch | Letzten gespeicherten Text ohne Zeitstempel laden |

IME / Compose müssen funktionieren (normales QML `TextField` / `TextInput`).

## 7. Shell-Vertrag

Manifest (Skizze):

```json
{
  "schemaVersion": 1,
  "id": "io.github.phausser.omajot",
  "name": "Omajot",
  "version": "0.1.0",
  "author": "Patrick Hausser",
  "license": "MIT",
  "description": "Eine Taste, eine Zeile, Anhang an ~/omajot.md.",
  "kinds": ["overlay"],
  "entryPoints": {
    "overlay": "Overlay.qml"
  }
}
```

Summon:

```bash
omarchy-shell shell summon io.github.phausser.omajot '{}'
omarchy-shell shell hide io.github.phausser.omajot
omarchy-shell shell toggle io.github.phausser.omajot
```

Hotkey liegt in `~/.config/hypr/bindings.lua` (oder der aktuellen Bindings-Datei), nicht im Plugin-Code fest verdrahtet. Das Plugin muss über IPC erreichbar sein, damit der User das Binding selbst setzt.

Vorschlag Binding:

```lua
o.bind("SUPER + N", "Omajot",
  "omarchy-shell shell toggle io.github.phausser.omajot")
```

Vor dem Mergen prüfen, ob `Super + N` auf der Ziel-Omarchy-Version frei ist.

## 8. Architektur

Dateien:

```text
omajot/
├── manifest.json
├── Overlay.qml
├── OmajotModel.js
├── README.md
├── LICENSE
└── SPEC.md
```

Verantwortlichkeiten:

- `Overlay.qml` — Darstellung, Fokus, Tasten, open/close.
- `OmajotModel.js` — konfigurierten Pfad auflösen (Default `~/omajot.md`), letzte Zeile laden, Datei anlegen falls nötig, Zeile formatieren, append, Fehlertext zurückgeben.
- Kein zweiter Quickshell-Prozess.
- Kein Netzwerk.
- Kein sudo.
- Keine Symlinks im Plugin-Ordner.
- Kein Anlegen eines eigenen Datenverzeichnisses.

Schreiboperationen klein halten. Ein kurzer lokaler Append-Hilfsprozess meldet
Erfolg oder Fehler asynchron zurück (Nutzerentscheidung vom 2026-09-10).
Kein weiterer Quickshell-Prozess. Das Overlay schließt erst nach bestätigtem
Erfolg; während eines Writes keine weiteren Schreibstarts zulassen.
Bei Write-Fehler Overlay offen lassen und eine Statuszeile zeigen
(`couldn't write <Pfad>`, beim Default `couldn't write ~/omajot.md`).

## 9. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Zieldatei fehlt | Nur Datei anlegen; beim Laden der letzten Zeile kein Write |
| Elternverzeichnis fehlt | Schreibfehler, kein Verzeichnis anlegen |
| Datei nicht schreibbar | Fehlermeldung, Overlay bleibt |
| Disk voll | Fehlermeldung, Overlay bleibt |
| Pfad zeigt auf Verzeichnis | Fehlermeldung |
| Sehr lange Zeile | hart cap bei 4000 Zeichen |

Keine stillen Verluste: Enter ohne erfolgreichen Write schließt nicht.

## 10. Sicherheit und Vertrauen

- Plugin läuft unsandboxed im `omarchy-shell`.
- Schreibt nur `~/omajot.md` (bzw. den konfigurierten Pfad).
- Liest für Pfeil-hoch nur die konfigurierte Notizdatei; keine fremden Dateien.
- Rendert die Eingabe als Plaintext, nicht als Rich-Text/HTML.
- README muss den Schreibpfad `~/omajot.md` und den Unsandbox-Hinweis enthalten.

## 11. Abgrenzung zu existierenden Plugins

- Built-in Clipboard (`omarchy.clipboard`): Vergangenheit von Kopiertem, kein absichtliches Capture.
- Reminders: Timer + Nachricht, anderer Vertrag.
- Community „Floating Notes“: kleiner nvim-Editor mit Liste. Zu schwer für Capture.
- Inbox-Mapping in Neovim: greift nur, wenn nvim schon das aktive Fenster ist.

Omajot ist das Capture *bevor* Review in `~/omajot.md` oder in Neovim stattfindet.

## 12. Erfolgskriterien v1

- `omarchy plugin validate` ist grün.
- Overlay öffnet in unter einer wahrnehmbaren Verzögerung nach dem Hotkey.
- Enter schreibt genau eine formatierte Zeile an den konfigurierten Pfad (Default `~/omajot.md`) und gibt Fokus zurück.
- Pfeil-hoch lädt den zuletzt gespeicherten Text; erneutes Speichern erhält bestehende Zeilen.
- Ein separater, auf freie Belegung geprüfter Hotkey öffnet dieselbe Datei im Editor.
- Der Pfad ist konfigurierbar; ohne Einstellung wird `~/omajot.md` verwendet.
- Escape schreibt nichts.
- Theme-Wechsel färbt das Overlay mit.
- Nach `plugin remove` bleibt `~/omajot.md` erhalten (Daten gehören dem User).

## 13. v2 (bewusst später)

- Option Neovim-Server-Append
- optionales Bar-Widget nur als unsichtbarer Service-Zähler
- Mehrzeiler via `Alt+Enter`
