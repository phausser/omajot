#!/usr/bin/env bash
set -euo pipefail

omajot_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
omajot_shell=${OMARCHY_PATH:-/usr/share/omarchy}/shell
omajot_linter=${QMLLINT:-/usr/lib/qt6/bin/qmllint}
omajot_imports=$(mktemp -d)
trap 'rm -rf -- "$omajot_imports"' EXIT

# Quickshell supplies the virtual qs namespace at runtime. Give the standalone
# linter the same module tree, without symlinks or changes to the installed shell.
cp -R -- "$omajot_shell" "$omajot_imports/qs"
"$omajot_linter" --max-warnings 0 -I "$omajot_shell" -I "$omajot_imports" "$omajot_root/Overlay.qml"
