# Omajot

Ein Quick-Note-Overlay für Omarchy: eine Taste, eine Zeile, Enter.
Notizen sollen mit lokalem Zeitstempel an `~/omajot.md` angehängt werden.

Status: Setup abgeschlossen; das Plugin ist noch nicht implementiert oder installierbar.
Spezifikation: [SPEC.md](SPEC.md). Umsetzung: [TODO.md](TODO.md).

## Projekt

- Plugin-ID: `io.github.phausser.omajot`
- Autor: Patrick Hausser
- Repository: https://github.com/phausser/omajot
- Lizenz: [MIT](LICENSE)
- Typ: Overlay im bestehenden `omarchy-shell`-Prozess

## Geplantes Verhalten

`Super + N` öffnet die Eingabe. Enter speichert und schließt; Escape verwirft.
Leere Eingaben schreiben nichts. Bei Schreibfehlern bleibt die Eingabe offen.
Die Datei ist UTF-8-Klartext, das Zeilenformat lautet:

```text
2026-09-10 15:01  morgen index auf users.email
```

Es wird nur `~/omajot.md` angelegt, kein eigenes Notizverzeichnis.
Das Plugin läuft **unsandboxed** innerhalb von `omarchy-shell`.
Sein vorgesehener Schreibpfad ist `~/omajot.md`; es benötigt kein Netzwerk.

## Hotkey-Prüfung

Am 2026-09-10 auf der Zielmaschine anhand von `hyprctl -j binds` geprüft:

| Kombination | Aktuelle Belegung |
|---|---|
| `Super + N` | Frei; für Omajot vorgesehen |
| `Super + Shift + N` | Editor; vorgeschlagener Fallback ist bereits belegt |
| `Super + Ctrl + N` | Toggle nightlight |

Das Binding wird in Abschnitt 4 eingerichtet. Vor der Integration erneut prüfen.
Falls `Super + N` dann belegt ist, muss eine freie Alternative gewählt werden.

## Gelesene Overlay-Referenz

Lokale Referenz: `/usr/share/omarchy/shell/plugins/emojis/manifest.json`
und `/usr/share/omarchy/shell/plugins/emojis/Emojis.qml`.

- Das Manifest deklariert `kinds: ["overlay"]` und einen QML-Entry-Point.
- Das Root-Item erhält `shell` und `manifest` und bietet `open`, `close`, `toggle`.
- `dismiss()` meldet das Schließen zusätzlich über `shell.hide(manifest.id)` an den Host.
- Ein transparentes `PanelWindow` füllt den Bildschirm mit Overlay-Layer und exklusivem Tastaturfokus; darin liegt eine zentrierte Karte.
- Fokus wird beim Öffnen über `Qt.callLater` gesetzt.
- `qs.Commons` und `qs.Ui` liefern `Color.menu`, `Style` und `BorderSurface` für das Theme.

Die Emoji-Suche verarbeitet Zeichen manuell; Omajot soll gemäß SPEC ein normales
`TextField`/`TextInput` für IME und Compose verwenden. Die Referenz setzt kein
`moduleName`; diesen Punkt aus Abschnitt 3 beim Prüfen des Host-Vertrags abgleichen.

## Installation und Entfernen

Folgen mit der Implementierung und Integration. Beim Entfernen des Plugins soll
`~/omajot.md` erhalten bleiben.
