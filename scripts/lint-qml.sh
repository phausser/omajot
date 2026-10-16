#!/usr/bin/env bash
set -euo pipefail

# Qt 6.12 counts warnings and exits 255 under --max-warnings 0, but can drop
# the console text (QTBUG-150075). The JSON report still lists each finding.
omajot_emit_lint_diagnostics() {
  local json=$1 root=$2
  local workspace=${GITHUB_WORKSPACE:-}
  if [[ ! -s "$json" ]]; then
    echo "qmllint exited ${omajot_status:-?} without diagnostics" >&2
    return 0
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    echo "qmllint diagnostics:" >&2
    cat -- "$json" >&2
    return 0
  fi
  if ! python3 - "$json" "$root" "$workspace" "${GITHUB_ACTIONS:-}" "${omajot_status:-?}" >&2 <<'PY'
import json
import sys

path, root, workspace, actions, status = sys.argv[1:6]
with open(path, encoding="utf-8") as handle:
    report = json.load(handle)

def relative(name):
    name = name or "Overlay.qml"
    for prefix in (workspace, root):
        prefix = prefix.rstrip("/")
        if prefix and name.startswith(prefix + "/"):
            return name[len(prefix) + 1 :]
    return name

def one_line(text):
    return " ".join(part.strip() for part in (text or "").splitlines() if part.strip())

def workflow_text(text):
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")

count = 0
for item in report.get("files") or []:
    name = relative(item.get("filename"))
    for warning in item.get("warnings") or []:
        count += 1
        kind = warning.get("type") or "warning"
        identifier = warning.get("id") or ""
        text = one_line(warning.get("message"))
        line = warning.get("line") or 0
        column = warning.get("column") or 0
        print(f"{name}:{line}:{column}: {kind}: [{identifier}] {text}")
        if actions == "true":
            command = "warning" if kind in ("warning", "info", "debug") else "error"
            print(
                f"::{command} file={name},line={line},col={column}::[{identifier}] {workflow_text(text)}"
            )
if count == 0:
    print(f"qmllint exited {status} without recognized diagnostics")
    sys.stdout.write(open(path, encoding="utf-8").read())
    print()
PY
  then
    echo "qmllint diagnostics:" >&2
    cat -- "$json" >&2
  fi
}

omajot_lint_main() {
  local omajot_root omajot_shell omajot_linter omajot_imports omajot_json omajot_log
  omajot_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
  omajot_shell=${OMARCHY_PATH:-/usr/share/omarchy}/shell
  omajot_linter=${QMLLINT:-/usr/lib/qt6/bin/qmllint}
  omajot_imports=$(mktemp -d)
  omajot_json=$(mktemp)
  omajot_log=$(mktemp)
  trap 'rm -rf -- "$omajot_imports" "$omajot_json" "$omajot_log"' RETURN

  # Quickshell supplies the virtual qs namespace at runtime. Give the standalone
  # linter the same module tree, without symlinks or changes to the installed shell.
  cp -R -- "$omajot_shell" "$omajot_imports/qs"
  set +e
  "$omajot_linter" --max-warnings 0 --json "$omajot_json" \
    -I "$omajot_shell" -I "$omajot_imports" \
    "$omajot_root/Overlay.qml" >"$omajot_log" 2>&1
  omajot_status=$?
  set -e
  if [[ -n "$(tr -d '[:space:]' <"$omajot_log")" ]]; then
    cat -- "$omajot_log" >&2
  elif [[ "$omajot_status" -ne 0 ]]; then
    omajot_emit_lint_diagnostics "$omajot_json" "$omajot_root"
  fi
  return "$omajot_status"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  omajot_lint_main "$@"
fi
