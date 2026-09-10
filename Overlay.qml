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
  property bool opened: false
  property bool saving: false
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
    Qt.callLater(function() { if (root.opened) input.forceActiveFocus() })
  }

  function close() {
    root.opened = false
    if (!root.saving) {
      input.clear()
      root.errorText = ""
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

  function save() {
    if (root.saving || !root.opened || input.inputMethodComposing) return
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
    })
  }

  // fcitx often leaves KeyEvent.text empty on layer-shell while still
  // delivering keysyms (Escape works, letters do not). Prefer event.text
  // when present; otherwise map the keysym like a US/Latin key.
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
      root.dismiss()
      event.accepted = true
      return
    }
    if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
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
      event.accepted = true
      return
    }
    if (Util.editsFilter(event, input.text)) {
      input.text = Util.editedFilter(event, input.text)
      event.accepted = true
      return
    }
    var chunk = root.textFromEvent(event)
    if (chunk) {
      var next = input.text + chunk
      if (next.length > Model.maximumLength)
        next = next.slice(0, Model.maximumLength)
      input.text = next
      event.accepted = true
      return
    }
    event.accepted = false
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

      Item {
        id: input
        anchors.fill: parent
        property string text: ""
        property bool inputMethodComposing: false
        function clear() { text = "" }
        focus: true
        Keys.priority: Keys.BeforeItem
        Keys.onPressed: function(event) { root.handleKey(event) }
      }

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
          height: fieldText.implicitHeight + root.spacingTokens.controlPaddingY * 2

          Text {
            anchors.fill: parent
            verticalAlignment: Text.AlignVCenter
            visible: input.text.length === 0
            text: "jot ▸"
            textFormat: Text.PlainText
            color: Color.muted
            font.family: root.fontTokens.menuFamily
            font.pixelSize: root.fontTokens.heading
          }

          Text {
            id: fieldText
            anchors.fill: parent
            verticalAlignment: Text.AlignVCenter
            visible: input.text.length > 0
            text: input.text
            textFormat: Text.PlainText
            elide: Text.ElideRight
            color: root.menuColors.text
            font.family: root.fontTokens.menuFamily
            font.pixelSize: root.fontTokens.heading
          }

          Rectangle {
            visible: root.opened && input.text.length > 0
            width: Math.max(1, Style.space(2))
            height: fieldText.font.pixelSize
            anchors.verticalCenter: parent.verticalCenter
            x: Math.min(fieldMetrics.width, parent.width - width)
            color: root.menuColors.text
          }

          TextMetrics {
            id: fieldMetrics
            font: fieldText.font
            text: input.text
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
