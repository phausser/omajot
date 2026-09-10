# Omajot

A quick-note overlay for Omarchy, designed to append timestamped notes to
`~/omajot.md`. Currently a preview: opening and closing work; saving comes next.

## Installation

Requires Omarchy with shell plugin support. From this repository:

```bash
omarchy plugin validate .
mkdir -p ~/.config/omarchy/plugins/io.github.phausser.omajot
cp manifest.json Overlay.qml LICENSE README.md ~/.config/omarchy/plugins/io.github.phausser.omajot/
omarchy-shell shell rescanPlugins
```

Review the code before enabling: the plugin runs unsandboxed inside `omarchy-shell`.

```bash
omarchy plugin enable io.github.phausser.omajot
```

## Configuration

No settings yet. The planned v1 writes to `~/omajot.md` using local timestamps.
A `Super + N` binding is planned; no shortcut is installed automatically.

## Usage

```bash
omarchy-shell shell toggle io.github.phausser.omajot
```

Press **Escape** or run the command again to close the preview.
