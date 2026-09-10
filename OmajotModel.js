// Plain JavaScript, importable by QML without Node or filesystem imports.
var maximumLength = 4000
var writeError = "couldn't write ~/omajot.md"

function resolvePath(home) {
  if (typeof home !== "string" || home.charAt(0) !== "/")
    throw new Error(writeError)
  return home.replace(/\/+$/, "") + "/omajot.md"
}

function normalizeText(text) {
  // Count UTF-16 units like QML TextInput.maximumLength; preserve surrogate pairs.
  var value = text.replace(/[\r\n\u2028\u2029]+/g, " ").trim()
  value = value.slice(0, maximumLength)
  var last = value.charCodeAt(value.length - 1)
  if (last >= 0xd800 && last <= 0xdbff)
    value = value.slice(0, -1)
  return value.trim()
}

function pad(value, width) {
  var result = String(value)
  while (result.length < width) result = "0" + result
  return result
}

function formatLine(text, now) {
  var value = normalizeText(text)
  if (value === "") return ""
  var date = now === undefined ? new Date() : now
  return pad(date.getFullYear(), 4) + "-" + pad(date.getMonth() + 1, 2)
    + "-" + pad(date.getDate(), 2) + " " + pad(date.getHours(), 2)
    + ":" + pad(date.getMinutes(), 2) + "  " + value + "\n"
}

// run(command, finished) is supplied by the host's Process adapter.
// finished(exitCode, exitStatus) uses QProcess conventions (0 = normal exit).
// The adapter must also report startup failures, and serialize writes.
// done(error) receives "" on success (including empty input), otherwise writeError.
function append(text, home, run, done, now) {
  var completed = false
  function finish(error) {
    if (completed) return
    completed = true
    done(error)
  }

  var command
  try {
    var line = formatLine(text, now)
    if (line === "") {
      finish("")
      return
    }
    var path = resolvePath(home)
    // OS argument strings cannot carry NUL. Fail rather than silently truncate.
    if (line.indexOf("\u0000") !== -1 || path.indexOf("\u0000") !== -1)
      throw new Error(writeError)
    // Only this fixed script is shell code. Path and text are separate arguments.
    // >> opens with O_APPEND and creates only the file if it is missing.
    command = ["/bin/sh", "-c", 'printf "%s" "$2" >> "$1"', "omajot", path, line]
  } catch (error) {
    finish(writeError)
    return
  }

  try {
    run(command, function(exitCode, exitStatus) {
      finish(exitCode === 0 && exitStatus === 0 ? "" : writeError)
    })
  } catch (error) {
    finish(writeError)
  }
}
