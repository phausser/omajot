// Plain JavaScript, importable by QML without Node or filesystem imports.
var maximumLength = 4000
var writeError = "couldn't write ~/omajot.md"

var defaultPath = "~/omajot.md"

function parseConfig(text) {
  var config = JSON.parse(text)
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("invalid configuration")
  var path = config.path === undefined ? defaultPath : config.path
  if (typeof path !== "string" || !path || path.indexOf("\u0000") !== -1
      || (path.charAt(0) !== "/" && path !== "~" && path.indexOf("~/") !== 0))
    throw new Error("invalid path")
  return path
}

function resolvePath(home, configuredPath) {
  var path = configuredPath === undefined ? defaultPath : configuredPath
  // Validate explicitly supplied values; never silently redirect a bad setting.
  parseConfig(JSON.stringify({ path: path }))
  if (path.charAt(0) === "/") return path
  if (typeof home !== "string" || home.charAt(0) !== "/" || home.indexOf("\u0000") !== -1)
    throw new Error(writeError)
  var base = home.replace(/\/+$/, "")
  return path === "~" ? (base || "/") : base + "/" + path.slice(2)
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
// done(error) receives "" on success (including empty input), otherwise a path-specific write error.
function append(text, home, run, done, now, configuredPath) {
  var failure = "couldn't write " + (configuredPath === undefined ? defaultPath : configuredPath)
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
    var path = resolvePath(home, configuredPath)
    // OS argument strings cannot carry NUL. Fail rather than silently truncate.
    if (line.indexOf("\u0000") !== -1 || path.indexOf("\u0000") !== -1)
      throw new Error(writeError)
    // Only this fixed script is shell code. Path and text are separate arguments.
    // >> opens with O_APPEND and creates only the file if it is missing.
    command = ["/bin/sh", "-c", 'printf "%s" "$2" >> "$1"', "omajot", path, line]
  } catch (error) {
    finish(failure)
    return
  }

  try {
    run(command, function(exitCode, exitStatus) {
      finish(exitCode === 0 && exitStatus === 0 ? "" : failure)
    })
  } catch (error) {
    finish(failure)
  }
}

function recalledText(line) {
  // tail returns the final physical line, with or without its terminating LF.
  var text = line.replace(/\r?\n$/, "")
  text = text.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}  /, "")
  return normalizeText(text)
}

// run also supplies collected UTF-8 stdout as its third callback argument.
function readLast(home, configuredPath, run, done) {
  var failure = "couldn't read " + (configuredPath === undefined ? defaultPath : configuredPath)
  var completed = false
  function finish(error, text) {
    if (completed) return
    completed = true
    done(error, text)
  }
  try {
    var path = resolvePath(home, configuredPath)
    // Missing file is empty history. Directories and unreadable files are errors.
    var command = ["/bin/sh", "-c",
      'if [ ! -e "$1" ] && [ ! -L "$1" ]; then exit 0; fi; [ -f "$1" ] || exit 1; exec tail -n 1 -- "$1"',
      "omajot", path]
    run(command, function(code, status, output) {
      if (code !== 0 || status !== 0) finish(failure, "")
      else finish("", recalledText(output || ""))
    })
  } catch (error) {
    finish(failure, "")
  }
}

function editorCommand(home, configuredPath) {
  return ["omarchy", "launch", "editor", resolvePath(home, configuredPath)]
}
