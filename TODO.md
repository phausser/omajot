# TODO — Omajot

Reihenfolge ist bindend. Nichts aus v2 anfangen, solange der Block darüber offen ist.

Arbeitsanweisungen: [AGENTS.md](AGENTS.md). Commits folgen Conventional Commits:
`<type>(<scope>): <beschreibung>` (Scope optional), z. B. `docs: add project instructions`.

## 0. Setup

- [x] Endgültige Plugin-id: `io.github.phausser.omajot` (Git-Remote: `phausser/omajot`)
- [x] Prüfen, ob `Super + N` auf der Maschine frei ist; Fallback `Super + Shift + N` notieren
- [x] Repo-Ordner `omajot/` anlegen, **keine Symlinks**
- [x] Overlay-Referenz lesen (`omarchy.emojis` oder `omarchy.reminders`) — nicht in `$OMARCHY_PATH` editieren
- [x] LICENSE MIT + README-Rohgerüst (Name: Omajot, Datei: `~/omajot.md`)
- [x] `AGENTS.md` mit wesentlichen SPEC-Vorgaben, GitHub-Checks und semantischem Commit-Format anlegen

Setup geprüft am 2026-09-10: `Super + N` ist laut aktiven Hyprland-Bindings frei.
Der vorgesehene Fallback `Super + Shift + N` ist mit „Editor“ belegt und daher
kein freier Ersatz. Bestehender Repo-Ordner: `/home/pat/Code/omajot`, keine Symlinks.
Referenz: `/usr/share/omarchy/shell/plugins/emojis/{manifest.json,Emojis.qml}`;
Details und Hinweise für die Umsetzung stehen im README.

## 1. Vertrag

- [ ] `manifest.json`: id `io.github.phausser.omajot`, name `Omajot`
- [ ] `schemaVersion`, version, author, license, description
- [ ] description erwähnt `~/omajot.md`
- [ ] `kinds: ["overlay"]`
- [ ] `entryPoints.overlay` → `Overlay.qml`
- [ ] `omarchy plugin validate .` ohne Fehler
- [ ] GitHub-Actions-Pipeline für Pull Requests und Pushes anlegen; Plugin-Validierung ausführen, sobald Manifest und Overlay vorhanden sind
- [ ] Dependabot für `github-actions` mit wöchentlichem Update-Intervall einrichten

## 2. Modell

- [ ] `OmajotModel.js`
- [ ] Pfad `~/omajot.md` auflösen (`~` → Home)
- [ ] **kein** `mkdir` für Notes oder App-Datenordner
- [ ] fehlt die Datei: nur `omajot.md` im Home anlegen
- [ ] Zeile formatieren: `YYYY-MM-DD HH:mm  <text>\n`
- [ ] Trim; leerer Text → kein Write
- [ ] Cap bei 4000 Zeichen
- [ ] Append UTF-8
- [ ] Fehler als String zurück
- [ ] Modelltests für Trim, leere Eingaben, lokales Zeitformat, Unicode und 4000-Zeichen-Grenze
- [ ] Dateitests mit temporären Dateien: Anlegen, Append ohne Überschreiben und Schreibfehler
- [ ] Modell- und Dateitests in der GitHub-Actions-Pipeline ausführen

## 3. Overlay-UI

- [ ] `Overlay.qml` als Entry
- [ ] `moduleName` = Plugin-id
- [ ] `open` / `close` / `toggle` für Shell-IPC
- [ ] Ein `TextField`/`TextInput`, Fokus beim Öffnen (`Qt.callLater`)
- [ ] Placeholder `jot ▸`
- [ ] Maße: ~600 px breit, eine Zeile
- [ ] Farben/Fonts über `qs.Ui` / `Style`, kein Hardcode-Hex
- [ ] Enter → model.append → bei Erfolg close
- [ ] Escape → close ohne Write
- [ ] Ctrl+U → Feld leeren
- [ ] Write-Fehler: Statuszeile (`couldn't write ~/omajot.md`), Overlay bleibt
- [ ] `qmllint` in der CI einrichten, mit passenden Qt-, Quickshell- und Omarchy-Imports

## 4. Integration

- [ ] Lokal nach `~/.config/omarchy/plugins/<id>/` kopieren (kein Symlink)
- [ ] `omarchy plugin validate`
- [ ] `omarchy plugin enable <id>`
- [ ] Binding in `~/.config/hypr/bindings.lua` (Label: Omajot)
- [ ] Summon/Hide/Toggle per CLI:

```bash
omarchy-shell shell toggle io.github.phausser.omajot
```

## 5. Qualität

- [ ] GitHub-Checks für Plugin-Validierung, Modell-/Dateitests und QML-Lint sind grün
- [ ] Fokus-Rückgabe und Hotkeys in der echten Omarchy-Sitzung prüfen
- [ ] IME und Compose in der echten Omarchy-Sitzung prüfen
- [ ] Theme wechseln, Overlay muss mitfärben
- [ ] Umlaut, Emoji, CJK in der Zeile
- [ ] `~/omajot.md` fehlt → Datei wird angelegt, kein Ordner
- [ ] Datei read-only → Fehlermeldung, kein Close
- [ ] Enter auf leerem Feld → Close, keine Leerzeile
- [ ] Zwei schnelle Toggles, kein Doppel-Write
- [ ] `plugin disable` / `enable` / Shell-Restart
- [ ] `plugin remove` löscht nicht `~/omajot.md`
- [ ] `qmllint -I "$OMARCHY_PATH/shell" Overlay.qml`

## 6. Docs zum Shippen

- [ ] README: Unsandbox-Hinweis, Schreibpfad `~/omajot.md`, Install, Hotkey, Remove
- [ ] Install-Befehl:

```bash
omarchy plugin add https://github.com/phausser/omajot.git
```

- [ ] Enable bewusst getrennt, Code erst lesen
- [ ] SPEC.md im Repo halten
- [ ] id in Manifest/QML/README identisch

## 7. Release

- [ ] Öffentliches Git-Repo (Name: `omajot`)
- [ ] Keine lokalen Secrets, keine `clonedFrom`-Reste
- [ ] Tag `v0.1.0` = Manifest-version
- [ ] Optional: Listing auf plugins.omarchy.org

---

## Parkplatz v2 (nicht anfassen)

- Pfeil-hoch lädt letzte Zeile
- Hotkey öffnet `~/omajot.md` im Editor
- Config-Pfad statt Hardcode
- Neovim `--server` Append
- `Alt+Enter` Mehrzeiler
- Bar-Badge

## Definition of done (v1)

Eine Taste öffnet Omajot. Eine Zeile landet in `~/omajot.md`. Escape schreibt nichts. Kein `~/Notes`. Validate ist grün.
