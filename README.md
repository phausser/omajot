# Omajot

A quick-note overlay for Omarchy: one shortcut, one line, Enter.
Appends timestamped plain-text notes to `~/omajot.md`.

## Installation

Under development; not yet installable. The plugin will run unsandboxed
inside `omarchy-shell`.

## Configuration

The planned v1 uses `~/omajot.md` with local timestamps and no configuration file.
Set the shortcut in your Hyprland bindings; `Super + N` is recommended if free.

## Usage

Planned controls:

- **Super + N:** open the overlay or dismiss it without saving.
- **Enter:** save and close; empty input closes without saving.
- **Escape:** discard and close.
- **Ctrl + U:** clear the input.

Notes will use this format:

```text
2026-09-10 15:01  add an index on users.email tomorrow
```
