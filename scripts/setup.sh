#!/usr/bin/env bash
# Run explicitly after reviewing and installing the plugin; never from QML.
set -euo pipefail

fail() { printf 'Omajot setup: %s\n' "$*" >&2; exit 1; }

check_only=false
case "${1:-}" in
  --check) check_only=true ;;
  --help|-h)
    echo 'Usage: bash scripts/setup.sh [--check]'
    echo 'Set up Super+N and Super+Alt+N, then enable Omajot.'
    echo '--check checks the current configuration without changing it.'
    exit 0 ;;
  '') ;;
  *) fail "unknown argument: $1" ;;
esac
(( $# <= 1 )) || fail 'too many arguments'

for tool in hyprctl jq omarchy flock; do
  command -v "$tool" >/dev/null || fail "missing command: $tool"
done

plugin_id=io.github.phausser.omajot
config_dir=${XDG_CONFIG_HOME:-"$HOME/.config"}
bindings_file="$config_dir/hypr/bindings.lua"
[[ -f $bindings_file && ! -L $bindings_file ]] || fail "expected a regular file: $bindings_file"
omarchy plugin validate "$config_dir/omarchy/plugins/$plugin_id" >/dev/null

# Lock the existing file without truncating it. Concurrent setup runs must wait
# for a fresh view of the bindings, rather than append the same entries twice.
exec 9<"$bindings_file"
flock -n 9 || fail 'another setup is using the bindings file'

config_ok() {
  local errors
  errors=$(hyprctl configerrors) || return 1
  if [[ -n ${errors//[[:space:]]/} ]]; then
    printf '%s\n' "$errors" >&2
    return 1
  fi
}

if ! $check_only; then
  hyprctl reload >/dev/null || fail 'could not reload Hyprland'
fi
config_ok || fail 'fix the existing Hyprland configuration errors first'
bindings=$(hyprctl binds -j) || fail 'could not read active Hyprland bindings'
jq -e 'type == "array" and all(.[]; (.modmask | type) == "number")' \
  <<<"$bindings" >/dev/null || fail 'invalid Hyprland bindings response'

missing=()
for mask in 64 72; do
  if [[ $mask == 64 ]]; then
    shortcut='SUPER + N'
    labels='["Omajot"]'
  else
    shortcut='SUPER + ALT + N'
    labels='["Omajot editor", "Omajot im Editor"]'
  fi
  # Include physical N (XKB keycode 57) and catch-all bindings conservatively.
  matches=$(jq -c --argjson mask "$mask" '
    [.[] | select(.modmask == $mask) | select(
      ((.key // "" | ascii_downcase) == "n") or
      .keycode == 57 or .key == "code:57" or .catch_all == true)]
  ' <<<"$bindings")
  if [[ $(jq length <<<"$matches") == 0 ]]; then
    missing+=("$mask")
    printf '%s: free\n' "$shortcut"
  elif jq -e --argjson labels "$labels" '
    length == 1 and all(.[];
      (.description as $label | $labels | index($label)) != null and
      .dispatcher == "__lua" and (.submap // "") == "" and
      (.release // false) == false and (.catch_all // false) == false)
  ' <<<"$matches" >/dev/null; then
    # Omarchy o.bind exposes a Lua callback number, not its shell command.
    # Its action label is the available identity in hyprctl's public output.
    printf '%s: already configured for Omajot\n' "$shortcut"
  else
    jq -r '.[] | "  " + (.description // .arg // "unknown binding")' <<<"$matches" >&2
    fail "$shortcut is already bound; choose a shortcut manually in $bindings_file"
  fi
done

$check_only && exit 0

backup=''
rollback() {
  local status=$?
  trap - EXIT
  if (( status != 0 )) && [[ -n $backup ]]; then
    if cp -p -- "$backup" "$bindings_file"; then
      hyprctl reload >/dev/null && config_ok || true
      printf 'Restored bindings from %s\n' "$backup" >&2
    else
      printf 'Restore bindings manually from %s\n' "$backup" >&2
    fi
  fi
  exit "$status"
}
trap rollback EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if (( ${#missing[@]} )); then
  backup_candidate=$(mktemp "$bindings_file.omajot-backup.XXXXXX")
  cp -p -- "$bindings_file" "$backup_candidate"
  backup=$backup_candidate
  printf 'Backup: %s\n' "$backup"
  {
    printf '\n-- Omajot shortcuts\n'
    for mask in "${missing[@]}"; do
      if [[ $mask == 64 ]]; then
        cat <<'LUA'
o.bind("SUPER + N", "Omajot",
  "omarchy-shell shell toggle io.github.phausser.omajot")
LUA
      else
        cat <<'LUA'
o.bind("SUPER + ALT + N", "Omajot editor",
  [[omarchy-shell shell summon io.github.phausser.omajot '{"action":"editor"}']])
LUA
      fi
    done
  } >>"$bindings_file"
  hyprctl reload >/dev/null || fail 'could not reload Hyprland'
  config_ok || fail 'Hyprland rejected the new bindings'
  active=$(hyprctl binds -j) || fail 'could not verify the new bindings'
  for mask in "${missing[@]}"; do
    jq -e --argjson mask "$mask" '
      any(.[]; .modmask == $mask and (.key | ascii_downcase) == "n"
        and (.description == "Omajot" or .description == "Omajot editor"))
    ' <<<"$active" >/dev/null || fail 'bindings.lua was not loaded by Hyprland'
  done
fi

omarchy plugin enable "$plugin_id"
echo 'Omajot is ready: Super+N captures, Super+Alt+N opens the note file.'
