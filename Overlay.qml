import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui
import "OmajotModel.js" as Model

Item {
  id: root

  property var shell: null
  property var manifest: null
  readonly property string moduleName: "io.github.phausser.omajot"
  property string notePath: Model.defaultPath
  property bool configReady: false
  property string configError: ""
  property bool editorPending: false
  onConfigReadyChanged: if (configReady && editorPending) Qt.callLater(root.openEditor)
  property bool opened: false
  property bool saving: false
  property bool recalling: false
  property int recallGeneration: 0
  property var readFinished: null
  property int pendingDead: 0
  property string errorText: ""
  property var writeFinished: null
  // These host token groups are declared as QtObject, with dynamic members.
  readonly property var menuColors: Color.menu
  readonly property var spacingTokens: Style.spacing
  readonly property var fontTokens: Style.font

  function open(payloadJson) {
    var monitor = Hyprland.focusedMonitor
    if (monitor) {
      for (var i = 0; i < Quickshell.screens.length; i++) {
        if (Quickshell.screens[i].name === monitor.name) {
          panel.screen = Quickshell.screens[i]
          break
        }
      }
    }
    root.opened = true
    root.pendingDead = 0
    var payload = {}
    try { payload = JSON.parse(payloadJson || "{}") || {} } catch (error) {}
    if (payload.action === "editor") {
      root.editorPending = true
      root.openEditor()
    }
    Qt.callLater(function() { if (root.opened) input.forceActiveFocus() })
  }

  function close() {
    root.opened = false
    root.editorPending = false
    root.recallGeneration++
    if (!root.saving) {
      input.clear()
      root.errorText = ""
      root.pendingDead = 0
    }
  }

  function dismiss() {
    root.close()
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide(root.moduleName)
  }

  function toggle() {
    if (root.opened) root.dismiss()
    else root.open("{}")
  }

  function openEditor() {
    if (!root.editorPending || !root.opened) return
    if (!root.configReady) return
    root.editorPending = false
    if (root.configError !== "") {
      root.errorText = root.configError
      return
    }
    if (root.saving) {
      root.errorText = "wait for the note to finish saving"
      return
    }
    try {
      var command = Model.editorCommand(Quickshell.env("HOME"), root.notePath)
      Quickshell.execDetached(command)
      root.dismiss()
    } catch (error) {
      root.errorText = "couldn't open " + root.notePath
    }
  }

  function runWrite(command, finished) {
    root.writeFinished = finished
    writer.command = command
    writer.running = true
  }

  function finishWrite(exitCode, exitStatus) {
    var finished = root.writeFinished
    root.writeFinished = null
    if (finished) finished(exitCode, exitStatus)
  }

  function runRead(command, finished) {
    root.readFinished = finished
    reader.exited = false
    reader.collected = false
    reader.output = ""
    reader.command = command
    reader.running = true
  }

  function finishRead(exitCode, exitStatus, output) {
    var finished = root.readFinished
    root.readFinished = null
    if (finished) finished(exitCode, exitStatus, output)
  }

  function recall() {
    if (root.saving || root.recalling || !root.opened || input.inputMethodComposing) return
    if (!root.configReady || root.configError !== "") {
      root.errorText = root.configError || "loading ~/.config/omajot.json"
      return
    }
    var generation = root.recallGeneration
    var path = root.notePath
    var draft = input.text
    root.recalling = true
    root.errorText = ""
    Model.readLast(Quickshell.env("HOME"), path, root.runRead, function(error, text) {
      root.recalling = false
      // Discard results after dismissal, config changes, or edits while reading.
      if (!root.opened || generation !== root.recallGeneration
          || path !== root.notePath || !root.configReady || root.configError !== ""
          || input.text !== draft) return
      if (error !== "") root.errorText = error
      else if (text !== "") {
        input.text = text
        input.cursorPosition = text.length
        root.pendingDead = 0
      }
    })
  }

  function loadConfig(text) {
    root.recallGeneration++
    root.configReady = true
    try {
      root.notePath = Model.parseConfig(text)
      root.configError = ""
    } catch (error) {
      root.configError = "couldn't read ~/.config/omajot.json"
    }
  }

  function save() {
    if (root.saving || root.recalling || !root.opened || input.inputMethodComposing) return
    if (Model.normalizeText(input.text) === "") {
      root.dismiss()
      return
    }
    if (!root.configReady || root.configError !== "") {
      root.errorText = root.configError || "loading ~/.config/omajot.json"
      return
    }
    root.saving = true
    root.errorText = ""
    Model.append(input.text, Quickshell.env("HOME"), root.runWrite, function(error) {
      if (error === "") {
        // Drop the draft and host panel before releasing the write lock.
        // A second Enter can arrive after a fast printf and must not append again.
        input.clear()
        root.errorText = ""
        root.dismiss()
        root.saving = false
      } else {
        root.saving = false
        root.errorText = error
        if (!root.opened && root.shell && typeof root.shell.summon === "function")
          root.shell.summon(root.moduleName, "{}")
        root.open("{}")
      }
    }, undefined, root.notePath)
  }

  function isDeadKey(key) {
    return key >= Qt.Key_Dead_Grave && key <= Qt.Key_Dead_Longsolidusoverlay
  }

  // Pair string: letter then replacement, for dead-key compose without IME.
  function composeChar(dead, letter) {
    if (!letter) return ""
    var table = ""
    if (dead === Qt.Key_Dead_Acute)
      table = "aáeéiíoóuúyýAÁEÉIÍOÓUÚYÝcćCĆnńNŃsśSŚzźZŹ"
    else if (dead === Qt.Key_Dead_Grave)
      table = "aàeèiìoòuùAÀEÈIÌOÒUÙ"
    else if (dead === Qt.Key_Dead_Circumflex)
      table = "aâeêiîoôuûAÂEÊIÎOÔUÛ"
    else if (dead === Qt.Key_Dead_Tilde)
      table = "aãeñoõAÃEÑOÕ"
    else if (dead === Qt.Key_Dead_Diaeresis)
      table = "aäeëiïoöuüyÿAÄEËIÏOÖUÜYŸ"
    var i = 0
    while (i + 1 < table.length) {
      if (table.charAt(i) === letter)
        return table.charAt(i + 1)
      i += 2
    }
    return ""
  }

  function insertChunk(chunk) {
    var current = input.text
    var pos = typeof input.cursorPosition === "number" ? input.cursorPosition : current.length
    var next = "" + current.slice(0, pos) + chunk + current.slice(pos)
    if (next.length > Model.maximumLength)
      next = next.slice(0, Model.maximumLength)
    var inserted = next.length - current.length
    input.text = next
    if (typeof input.cursorPosition === "number")
      input.cursorPosition = pos + inserted
  }

  // fcitx often leaves KeyEvent.text empty on layer-shell while still
  // delivering keysyms (Escape works, letters do not). Prefer event.text
  // when present; otherwise map the keysym like a US/Latin key.
  // Dead keys are composed here: fcitx on layer-shell often swallows them
  // before TextInput sees a preedit, and leaves the follow-up letter empty.
  function textFromEvent(event) {
    if (event.text) {
      var out = ""
      for (var i = 0; i < event.text.length; i++) {
        var code = event.text.charCodeAt(i)
        if (code >= 32 && code !== 127) out += event.text.charAt(i)
      }
      if (out.length) return out
    }
    if (event.modifiers & (Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier))
      return ""
    var key = event.key
    var shift = !!(event.modifiers & Qt.ShiftModifier)
    if (key === Qt.Key_Space) return " "
    if (key >= Qt.Key_A && key <= Qt.Key_Z)
      return shift ? String.fromCharCode(key) : String.fromCharCode(key + 32)
    if (key >= 32 && key <= 255 && key !== 127) {
      var ch = String.fromCharCode(key)
      return shift ? ch : ch.toLowerCase()
    }
    return ""
  }

  function handleKey(event) {
    if (root.saving) {
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Escape) {
      root.pendingDead = 0
      root.dismiss()
      event.accepted = true
      return
    }
    if (input.inputMethodComposing) {
      event.accepted = false
      return
    }
    if (event.key === Qt.Key_Up && event.modifiers === Qt.NoModifier) {
      root.recall()
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
      root.pendingDead = 0
      root.save()
      event.accepted = true
      return
    }
    if (event.modifiers & (Qt.AltModifier | Qt.MetaModifier)) {
      event.accepted = false
      return
    }
    if (event.key === Qt.Key_U && event.modifiers === Qt.ControlModifier) {
      input.clear()
      root.errorText = ""
      root.pendingDead = 0
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_V && event.modifiers === Qt.ControlModifier) {
      var clip = Quickshell.clipboardText || ""
      clip = clip.replace(/[\r\n\u2028\u2029]+/g, " ")
      if (clip) {
        root.insertChunk(clip)
        root.pendingDead = 0
        event.accepted = true
        return
      }
      event.accepted = false
      return
    }
    if (root.isDeadKey(event.key)) {
      root.pendingDead = event.key
      event.accepted = true
      return
    }
    if (root.pendingDead) {
      var dead = root.pendingDead
      root.pendingDead = 0
      var letter = root.textFromEvent(event)
      var composed = root.composeChar(dead, letter)
      if (composed) {
        root.insertChunk(composed)
        event.accepted = true
        return
      }
      if (letter) {
        root.insertChunk(letter)
        event.accepted = true
        return
      }
      event.accepted = false
      return
    }
    if (Util.editsFilter(event, input.text)) {
      input.text = Util.editedFilter(event, input.text)
      if (typeof input.cursorPosition === "number")
        input.cursorPosition = input.text.length
      event.accepted = true
      return
    }
    var chunk = root.textFromEvent(event)
    if (chunk) {
      root.insertChunk(chunk)
      event.accepted = true
      return
    }
    event.accepted = false
  }

  FileView {
    id: configFile
    path: Quickshell.env("HOME") + "/.config/omajot.json"
    preload: true
    printErrors: false
    watchChanges: true
    onFileChanged: {
      root.recallGeneration++
      root.configReady = false
      reload()
    }
    onLoaded: root.loadConfig(text())
    onLoadFailed: function(error) {
      root.configReady = true
      if (error === FileViewError.FileNotFound) {
        root.notePath = Model.defaultPath
        root.configError = ""
      } else {
        root.configError = "couldn't read ~/.config/omajot.json"
      }
    }
  }

  Process {
    id: reader
    property bool exited: false
    property bool collected: false
    property string output: ""
    property int resultCode: -1
    property int resultStatus: 1
    function complete() {
      if (exited && collected) root.finishRead(resultCode, resultStatus, output)
    }
    stdout: StdioCollector {
      onStreamFinished: {
        reader.output = text
        reader.collected = true
        reader.complete()
      }
    }
    // qmllint disable signal-handler-parameters
    onExited: (exitCode, exitStatus) => {
      resultCode = exitCode
      resultStatus = exitStatus
      exited = true
      complete()
    }
    // qmllint enable signal-handler-parameters
    onRunningChanged: {
      if (!running && !exited && root.readFinished) root.finishRead(-1, 1, "")
    }
  }

  Process {
    id: writer
    // Quickshell's tooling metadata omits the QProcess::ExitStatus enum.
    // qmllint disable signal-handler-parameters
    onExited: (exitCode, exitStatus) => root.finishWrite(exitCode, exitStatus)
    // qmllint enable signal-handler-parameters
    // FailedToStart emits runningChanged without exited in Quickshell.
    onRunningChanged: {
      if (!running && root.writeFinished) root.finishWrite(-1, 1)
    }
  }

  // Quickshell selects the concrete window implementation at runtime.
  // qmllint disable uncreatable-type
  PanelWindow {
    // qmllint enable uncreatable-type
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "omajot"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: root.opened ? WlrKeyboardFocus.Exclusive : WlrKeyboardFocus.None
    exclusionMode: ExclusionMode.Ignore
    onBackingWindowVisibleChanged: if (backingWindowVisible && root.opened)
      Qt.callLater(function() { if (root.opened) input.forceActiveFocus() })

    Rectangle {
      anchors.fill: parent
      color: root.menuColors.scrim
    }

    MouseArea {
      anchors.fill: parent
      onClicked: root.dismiss()
    }

    BorderSurface {
      id: card
      anchors.centerIn: parent
      width: Math.min(Style.space(600), panel.width - Style.gapsOut * 2)
      height: content.implicitHeight + card.contentTopInset + card.contentBottomInset
      radius: Style.cornerRadius
      color: root.menuColors.background
      borderSpec: Border.surfaceSpec("menu", "border", root.menuColors.border, Math.max(1, Style.space(2)))
      padding: root.spacingTokens.panelPadding

      MouseArea { anchors.fill: parent; onClicked: input.forceActiveFocus() }

      Column {
        id: content
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.topMargin: card.contentTopInset
        anchors.leftMargin: card.contentLeftInset
        anchors.rightMargin: card.contentRightInset
        spacing: root.spacingTokens.sm

        Item {
          width: content.width
          height: input.font.pixelSize + root.spacingTokens.controlPaddingY * 2

          Text {
            anchors.fill: parent
            verticalAlignment: Text.AlignVCenter
            visible: input.text.length === 0 && !input.inputMethodComposing
            text: "jot ▸"
            textFormat: Text.PlainText
            color: Color.muted
            font.family: root.fontTokens.menuFamily
            font.pixelSize: root.fontTokens.heading
          }

          TextInput {
            id: input
            anchors.fill: parent
            verticalAlignment: TextInput.AlignVCenter
            clip: true
            focus: true
            activeFocusOnPress: true
            selectByMouse: true
            readOnly: root.saving
            maximumLength: Model.maximumLength
            color: root.menuColors.text
            selectionColor: root.menuColors.selectedBackground
            selectedTextColor: root.menuColors.selectedText
            font.family: root.fontTokens.menuFamily
            font.pixelSize: root.fontTokens.heading
            onTextChanged: root.recallGeneration++
            Keys.priority: Keys.BeforeItem
            Keys.onPressed: function(event) { root.handleKey(event) }
          }
        }

        Text {
          width: content.width
          visible: root.errorText !== ""
          text: root.errorText
          textFormat: Text.PlainText
          wrapMode: Text.WordWrap
          color: root.menuColors.text
          font.family: root.fontTokens.menuFamily
          font.pixelSize: root.fontTokens.body
        }
      }
    }
  }
}
