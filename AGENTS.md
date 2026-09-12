# Omajot — Arbeitsanweisungen

## Quellen und Umfang

- Vor Änderungen [SPEC.md](SPEC.md) und [TODO.md](TODO.md) lesen. Die SPEC beschreibt den Produktvertrag; TODO legt die verbindliche Reihenfolge fest.
- Nur den beauftragten Abschnitt umsetzen und erledigte Punkte im TODO aktualisieren. Unerledigte oder ungeprüfte Punkte offen lassen.
- v1 ist ein schnelles Einzeilen-Capture-Overlay. Keine Notizverwaltung, Suche, Tags, Markdown-Vorschau, Sync, LLM-Funktionen oder Bar-Widgets ergänzen. v2 bleibt im Parkplatz.

## Identität und Architektur

- Name: `Omajot`; Plugin-ID: `io.github.phausser.omajot`; Autor: Patrick Hausser; Lizenz: MIT.
- Manifest: `schemaVersion: 1`, `kinds: ["overlay"]`, `entryPoints.overlay: "Overlay.qml"`; initiale Version `0.1.0`. Beschreibung nennt `~/omajot.md`.
- `Overlay.qml` übernimmt Darstellung, Fokus, Tasten und Öffnen/Schließen; `OmajotModel.js` übernimmt Pfadauflösung, Formatierung, Append und Fehlertexte.
- Im bestehenden `omarchy-shell`-Prozess laufen. Kein zweiter Quickshell-Prozess, kein Netzwerk und kein sudo zur Laufzeit.
- Keine Symlinks im Plugin-Ordner. `$OMARCHY_PATH` nur als Referenz lesen, dort nichts editieren.
- Shell-IPC für Summon/Hide/Toggle unterstützen. Den konkreten Host-Vertrag anhand der installierten Shell prüfen; Manifest-Skizzen nicht ungeprüft übernehmen.
- Lokale Referenz: `/usr/share/omarchy/shell/plugins/emojis/Emojis.qml` und zugehöriges Manifest. Beim Schließen den Shell-Zustand über den Host-Vertrag synchron halten.

## Nutzerfluss und UI

- Ein schmales Overlay auf dem fokussierten Monitor; eine Karte mit etwa 560–640 px Breite, oben oder mittig zentriert im Fullscreen-Host.
- Normales QML `TextField`/`TextInput` für IME und Compose verwenden. Sofortiger Eingabefokus beim Öffnen, nötigenfalls über `Qt.callLater`; Placeholder: `jot ▸`.
- Enter speichert genau eine Zeile und schließt erst nach erfolgreichem Write. Leere/getrimmte leere Eingabe schließt ohne Write.
- Escape und erneutes Toggle verwerfen ohne Write. Ctrl+U leert die Eingabe. Nach dem Schließen kehrt der Fokus zum vorherigen Fenster zurück.
- Farben, Schrift, Radius und Abstände aus `qs.Ui`, `qs.Commons` und Theme-Tokens wie `Style` beziehen. Kein eigenes Farbschema, Logo oder zusätzliche Spalten.
- Eingaben als Plaintext darstellen. Harte Grenze von 4000 Zeichen.
- Hotkeys gehören in die Hyprland-Konfiguration, nicht in den Plugin-Code. Vor Integration die aktive Belegung prüfen.
- Setup-Befund vom 2026-09-10: `Super + N` frei; der in der SPEC vorgeschlagene Fallback `Super + Shift + N` ist bereits mit „Editor“ belegt und darf nicht als frei angenommen werden.

## Persistenz und Fehler

- v1 schreibt ausschließlich nach dem konfigurierten Pfad (Default `~/omajot.md`); `~` zum Home-Verzeichnis auflösen. Den Konfigurationsvertrag anhand der installierten Shell prüfen.
- Pfeil-hoch lädt den letzten gespeicherten Text ohne Zeitstempel aus dieser Datei. Erneutes Speichern hängt eine neue Zeile an, ohne bestehende Zeilen zu ändern.
- Ein separater Hyprland-Hotkey öffnet dieselbe konfigurierte Datei im Standard-Editor; die freie Belegung vor Integration prüfen.
- Fehlt die Datei, nur diese Datei anlegen. Kein `~/Notes`, kein eigenes Datenverzeichnis und kein `mkdir` für Notizen.
- UTF-8, ausschließlich Append; vorhandenen Inhalt niemals überschreiben.
- Zeilenformat: `YYYY-MM-DD HH:mm  <getrimmter Text>\n`, lokale Zeit, genau zwei Leerzeichen zwischen Zeitstempel und Text.
- Schreiboperationen klein halten. Ein lokaler Lese-Hilfsprozess für die letzte Zeile sowie ein Append-Hilfsprozess mit asynchroner Erfolgs-/Fehlerrückmeldung sind erlaubt (Nutzerentscheidung vom 2026-09-10); kein weiterer Quickshell-Prozess. Schreibfehler als Fehlertext zurückgeben; bei fehlenden Rechten, vollem Datenträger oder Verzeichnis als Ziel die Eingabe erhalten und das Overlay offen lassen. Erst nach bestätigtem Erfolg schließen; parallele Schreibstarts verhindern.
- Fehlerstatus: `couldn't write <Pfad>` (Default: `couldn't write ~/omajot.md`). Keine stillen Datenverluste.
- Für Pfeil-hoch nur die konfigurierte Notizdatei lesen; keine fremden Dateien lesen. Notizen sind Klartext; v1 enthält keine Secrets-Erkennung.
- README nennt Schreibpfad und unsandboxed Ausführung. Entfernen des Plugins muss `~/omajot.md` erhalten.

## Prüfung und GitHub

- GitHub Actions für Pull Requests und Pushes schrittweise gemäß TODO ergänzen: Plugin-Validierung ab Vertrag, Modell-/Dateitests mit Modell, QML-Lint mit Overlay.
- `omarchy plugin validate .` ausführen, sobald Manifest und Overlay vorhanden sind.
- Modelltests prüfen Trim, leere Eingaben, lokales Zeitformat, Unicode und Zeichenlimit. Dateitests prüfen Anlegen, Append ohne Überschreiben und Schreibfehler ausschließlich mit temporären Testdateien.
- QML mit `qmllint -I "$OMARCHY_PATH/shell" Overlay.qml` prüfen; die CI benötigt passende Qt-, Quickshell- und Omarchy-Imports.
- Fokus-Rückgabe, Hotkeys, IME/Compose, Theme-Wechsel, schnelle Toggles und Plugin-Lebenszyklus zusätzlich in einer echten Omarchy-Sitzung prüfen.
- Dependabot wöchentlich für `github-actions` einrichten. Weitere Ökosysteme erst bei tatsächlichen Paketabhängigkeiten ergänzen.
- Nur tatsächlich ausgeführte Checks als bestanden melden; Einschränkungen festhalten.

## Commits

- Verbindlich sind semantische Commit-Nachrichten nach Conventional Commits: `<type>(<scope>): <beschreibung>`. Scope ist optional.
- Typen passend zur Änderung verwenden: `feat`, `fix`, `docs`, `test`, `ci`, `refactor`, `perf`, `build`, `chore`, `revert`.
- Beschreibung kurz, konkret und im Imperativ formulieren. Zusammengehörige Änderungen in einem Commit bündeln.
- Beispiele: `docs: add project instructions`, `feat(model): append timestamped notes`, `ci: add QML lint checks`.
- Inkompatible Änderungen mit `!` vor dem Doppelpunkt und einem erklärenden `BREAKING CHANGE:`-Footer kennzeichnen.
