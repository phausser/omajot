# Omajot

One key, one line, appended to `~/omajot.md`.

Plugin id: `io.github.phausser.omajot`. Overlay for [Omarchy](https://omarchy.org/).

The plugin runs **unsandboxed** inside the existing `omarchy-shell` process. It
appends plaintext to the configured file (default `~/omajot.md`). Read the code before
enabling. Removing the plugin does **not** delete `~/omajot.md`.

## Install

```bash
omarchy plugin add https://github.com/phausser/omajot.git
```

That clones the plugin. It does not enable it. Open
`~/.config/omarchy/plugins/io.github.phausser.omajot/` and read
`Overlay.qml` and `OmajotModel.js` first.

```bash
omarchy plugin enable io.github.phausser.omajot
```

## Hotkey

No shortcut is installed automatically. Add one in `~/.config/hypr/bindings.lua`:

```lua
o.bind("SUPER + N", "Omajot",
  "omarchy-shell shell toggle io.github.phausser.omajot")
```

`Super + N` was free on the development machine. The spec fallback
`Super + Shift + N` is already bound to Editor on current Omarchy and is not
a free substitute.

To open the configured note file in Omarchy's default editor, add:

```lua
o.bind("SUPER + ALT + N", "Omajot im Editor",
  [[omarchy-shell shell summon io.github.phausser.omajot '{"action":"editor"}']])
```

`Super + Alt + N` was free on the development machine on 2026-09-12; check
bindings on your machine first. This uses the same configured path as capture.
The editor opens independently, and the overlay closes without saving its draft.

You can also toggle without a key:

```bash
omarchy-shell shell toggle io.github.phausser.omajot
```

## Usage

- Type, then **Enter** to append one timestamped line and close.
- **Escape** or **Super + N** again discards and closes. Nothing is written.
- **Enter** on an empty (or whitespace-only) field closes without a write.
- **Ctrl+U** clears the field.
- **Up** loads the last line from the configured note file without its timestamp.
  **Enter** appends the edited text as a new line; the original stays unchanged.
  Empty or missing history leaves your draft unchanged. Read errors preserve it too.

Each saved line looks like:

```text
2026-09-10 15:01  morgen index auf users.email
```

Local time, two spaces, UTF-8, append only. Missing `~/omajot.md` is created as
that file alone; Omajot never creates `~/Notes`.

On write failure the overlay stays open with `couldn't write ~/omajot.md` and
keeps the draft.

## Configuration

Optionally create `~/.config/omajot.json`:

```json
{
  "path": "~/inbox.md"
}
```

Without this file or its `path` entry, Omajot uses `~/omajot.md`. Use an
absolute path or `~/…`; environment variables and `~user` are not expanded.
The parent directory must already exist. Omajot creates only the note file,
never directories. Configuration changes are reloaded automatically.

Invalid or unreadable configuration blocks saving and preserves your draft.
Write errors show the configured path. Removing the plugin preserves your
configured note file too.

## Input

Latin letters and German umlaut keys (äöü) work. Dead-key compose, IME, emoji
pickers, and CJK input often do not on layer-shell with fcitx. That is a known
v1 limit, not a missing config knob.

## Remove

```bash
omarchy plugin remove io.github.phausser.omajot
```

`~/omajot.md` stays on disk.

## Spec

The product contract is [SPEC.md](SPEC.md).
