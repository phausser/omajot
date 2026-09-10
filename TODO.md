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
Wesentliche Hinweise für die Umsetzung stehen in AGENTS.md.

## 1. Vertrag

- [x] `manifest.json`: id `io.github.phausser.omajot`, name `Omajot`
- [x] `schemaVersion`, version, author, license, description
- [x] description erwähnt `~/omajot.md`
- [x] `kinds: ["overlay"]`
- [x] `entryPoints.overlay` → `Overlay.qml`
- [x] `omarchy plugin validate .` ohne Fehler
- [x] GitHub-Actions-Pipeline für Pull Requests und Pushes anlegen; Plugin-Validierung ausführen, sobald Manifest und Overlay vorhanden sind
- [x] Dependabot für `github-actions` mit wöchentlichem Update-Intervall einrichten

- [x] Minimal-Overlay für den vorgezogenen lokalen Testaufruf erstellen, kopieren und aktivieren
- [x] Summon/Hide/Toggle gegen die laufende Shell prüfen

Validiert am 2026-09-10: installierter Validator und offizieller CI-Validator
(`basecamp/omarchy@8ea51516390320f8e768808b230098e67bdaa82c`) erfolgreich.
Preview als `omajot`-Layer im bestehenden Shell-Prozess auf dem fokussierten
Monitor nachgewiesen; Hide und beide Toggle-Richtungen geprüft.
GitHub-Workflow und Dependabot-Konfiguration angelegt, YAML geparst und den
CI-Validierungsbefehl lokal ausgeführt; GitHub-Lauf steht bis zum Push aus.
Der direkte qmllint-Aufruf löst die virtuellen `qs`-Imports noch nicht auf;
die vollständige Lint-Einrichtung folgt in Abschnitt 3. Escape ist implementiert,
aber noch nicht per Tastatureingabe geprüft. Noch keine Eingabe oder Persistenz.

## 2. Modell

- [x] `OmajotModel.js`
- [x] Pfad `~/omajot.md` auflösen (`~` → Home)
- [x] **kein** `mkdir` für Notes oder App-Datenordner
- [x] fehlt die Datei: nur `omajot.md` im Home anlegen
- [x] Zeile formatieren: `YYYY-MM-DD HH:mm  <text>\n`
- [x] Trim; leerer Text → kein Write
- [x] Cap bei 4000 Zeichen
- [x] Append UTF-8
- [x] Fehler als String zurück (asynchroner Callback)
- [x] Modelltests für Trim, leere Eingaben, lokales Zeitformat, Unicode und 4000-Zeichen-Grenze
- [x] Dateitests mit temporären Dateien: Anlegen, Append ohne Überschreiben und Schreibfehler
- [x] Modell- und Dateitests in der GitHub-Actions-Pipeline ausführen

Stand 2026-09-10: Modell- und Dateitests lokal mit `TZ=Europe/Berlin` und
`TZ=America/New_York` erfolgreich; Plugin-Validierung und `git diff --check`
erfolgreich. GitHub-Lauf [34492920398](https://github.com/phausser/omajot/actions/runs/34492920398)
für `a121b15` bestätigt Modell-/Dateitests und Plugin-Validierung erfolgreich.
Zeilenumbrüche werden zu Leerzeichen; das Limit zählt passend zu QML
UTF-16-Einheiten und trennt keine Surrogatpaare.
Nutzerentscheidung: lokaler Append-Hilfsprozess mit asynchroner Rückmeldung
erlaubt; SPEC und AGENTS entsprechend angepasst. `append(text, home, run, done)`
erhält den Prozessadapter vom Host; `done` liefert einen leeren String bei
Erfolg oder den festgelegten Fehlertext. Der feste Shell-Befehl übergibt Text
und Pfad als Argumente und öffnet ausschließlich mit Append.
Dateitests prüfen zusätzlich Literalübergabe, Prozessfehler und eine durch
Dateigrößenlimit erzwungene Schreibstörung (kein echter voller Datenträger).
Die QML-Process-Anbindung einschließlich Startfehlerbehandlung und Sperre
gegen parallele Writes sowie Erhalt der Eingabe ist in Abschnitt 3 umgesetzt.

## 3. Overlay-UI

- [x] `Overlay.qml` als Entry (Preview aus Abschnitt 1)
- [x] `moduleName` = Plugin-id
- [x] `open` / `close` / `toggle` für Shell-IPC
- [x] Ein `TextField`/`TextInput`, Fokus beim Öffnen (`Qt.callLater`)
- [x] Placeholder `jot ▸`
- [x] Maße: ~600 px breit, eine Zeile
- [x] Farben/Fonts über `qs.Ui` / `Style`, kein Hardcode-Hex
- [x] Enter → model.append → bei Erfolg close
- [x] Escape → close ohne Write
- [x] Ctrl+U → Feld leeren
- [x] Write-Fehler: Statuszeile (`couldn't write ~/omajot.md`), Overlay bleibt
- [x] `qmllint` in der CI einrichten, mit passenden Qt-, Quickshell- und Omarchy-Imports

Implementiert am 2026-09-10. Während eines Writes ist das Feld schreibgeschützt;
weiteres Enter startet keinen Prozess. Schließen nach bereits ausgelöstem Enter
macht den Write nicht rückgängig: Der Entwurf bleibt intern bis zum Ergebnis
erhalten; bei Fehler wird das Overlay samt Host-Zustand wieder geöffnet.
Ohne laufenden Write verwerfen Escape/Toggle wie vorgesehen.

Lokal bestanden: 19 Modell-, Datei- und Controller-Tests in zwei Zeitzonen,
Plugin-Validierung, `git diff --check` und `bash scripts/lint-qml.sh` mit null
Warnungen (Qt 6.11.2, Quickshell 0.3.1). Der Linter erhält eine temporäre Kopie
des Shell-Modulbaums als `qs`; keine Symlinks im Plugin. Zwei lokal begrenzte
Lint-Ausnahmen betreffen Quickshell-Metadaten (PanelWindow-Erzeugung und
QProcess::ExitStatus), keine global deaktivierten Warnungen.
CI verwendet Qt/Quickshell aus Arch und den festgelegten Omarchy-Commit;
der neue QML-Job wurde noch nicht auf GitHub ausgeführt.
Controller-Tests prüfen die tatsächlichen JS-Funktionen aus Overlay.qml mit
simuliertem Host/Prozess. QML-Signale, Tastatureingaben, Fokus, IME/Compose,
Theme und Darstellung sind noch nicht in der echten Sitzung geprüft;
die installierte Preview wurde in diesem Abschnitt nicht ersetzt.

## 4. Integration

- [x] Finale Version lokal nach `~/.config/omarchy/plugins/<id>/` kopieren (kein Symlink; Preview bereits installiert)
- [x] `omarchy plugin validate`
- [x] `omarchy plugin enable <id>`
- [x] Binding in `~/.config/hypr/bindings.lua` (Label: Omajot)
- [x] Summon/Hide/Toggle per CLI:

```bash
omarchy-shell shell toggle io.github.phausser.omajot
```

Lokal integriert am 2026-09-10: Laufzeitdateien in die bestehende Plugin-Kopie
übertragen, validiert, neu eingelesen und aktiviert. `Super + N` erneut als
frei geprüft und mit Label Omajot eingerichtet; Hyprland-Reload ohne
Konfigurationsfehler. Summon/Hide und beide Toggle-Richtungen über IPC
mit vorhandenem bzw. entferntem `omajot`-Layer bestätigt.
Backup: `~/.config/omarchy/backups/omajot-20260910-173115/`.
Tatsächliche Tastatureingabe, Darstellung und Fokus bleiben in Abschnitt 5
zu prüfen; bei diesen IPC-Checks wurden keine Notizen geschrieben.

## 5. Qualität

- [x] GitHub-Checks für Plugin-Validierung, Modell-/Dateitests und QML-Lint sind grün
- [x] Fokus-Rückgabe und Hotkeys in der echten Omarchy-Sitzung prüfen
- [ ] IME und Compose in der echten Omarchy-Sitzung prüfen
- [x] Theme wechseln, Overlay muss mitfärben
- [ ] Umlaut, Emoji, CJK in der Zeile
- [x] `~/omajot.md` fehlt → Datei wird angelegt, kein Ordner
- [x] Datei read-only → Fehlermeldung, kein Close
- [x] Enter auf leerem Feld → Close, keine Leerzeile
- [x] Zwei schnelle Toggles, kein Doppel-Write
- [x] `plugin disable` / `enable` / Shell-Restart
- [x] `plugin remove` löscht nicht `~/omajot.md`
- [x] QML-Lint mit Shell-Imports via `bash scripts/lint-qml.sh` (ergänzt den virtuellen `qs`-Importbaum)

Prüfstand 2026-09-10: [GitHub-Lauf 34496900835](https://github.com/phausser/omajot/actions/runs/34496900835)
für `a2574fc` vollständig erfolgreich: Plugin-Validierung, Modell-/Datei-/
Controller-Tests und QML-Lint. Lokaler QML-Lint ebenfalls ohne Warnungen.

Sitzung 2026-09-10, Fortsetzung: `Super + N` öffnet und schließt den `omajot`-Layer.
Escape und erfolgreiches Enter geben den Fokus an dasselbe VS-Code-Fenster
zurück. Ctrl+U leert auf den Placeholder. Leeres Enter schließt ohne Write.
Zwei schnelle Toggles schreiben nicht. Nach `omarchy restart shell` bleiben
Summon/Hide nutzbar; `plugin remove --yes` löscht `~/omajot.md` nicht, Plugin
danach aus Backup wieder aktiviert.

Datei: fehlende `~/omajot.md` wird als Datei angelegt, kein `~/Notes`.
Read-only: Overlay bleibt, Status `couldn't write ~/omajot.md`, Entwurf bleibt.
Theme: Overlay folgt `Tokyo Night` (dunkle Karte) und wieder `Catppuccin Latte`.

Ein schnelles Enter hat dieselbe Zeile zweimal angehängt, weil die Schreibsperre
vor `dismiss` fiel. Erfolgspfad räumt den Entwurf jetzt vor dem Freigeben der
Sperre ab; danach genau eine Zeile.

IME-Anlauf 2026-09-10: `TextInput` ist wieder das fokussierte Feld (SPEC), mit
Keysym-Fallback wenn `event.text` leer ist. Buchstaben und äöü erscheinen in
der Sitzung. Dead-Acute+a ergibt weiter nur `a`; `OnDemand` statt Exclusive
ändert das nicht. Ctrl+V liest `Quickshell.clipboardText` (Controller-Test mit
漢字😀); `wl-copy` füllt diesen Puffer hier nicht, natives TextInput-Paste
auf dem Layer ebenfalls nicht. Offen: IME/Compose in der Sitzung und
Emoji/CJK sichtbar in der Zeile.

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
