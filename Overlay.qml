import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import Quickshell.Wayland
import QtQuick
import QtQuick.Controls
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
      root.saving = false
      if (error === "") {
        root.dismiss()
      } else {
        root.errorText = error
        // A host Hide/Toggle may have hidden the panel while the write ran.
        // Restore both host state and the unchanged draft on failure.
        if (!root.opened && root.shell && typeof root.shell.summon === "function")
          root.shell.summon(root.moduleName, "{}")
        root.open("{}")
      }
    })
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
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle {
      anchors.fill: parent
      color: root.menuColors.scrim
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

      Column {
        id: content
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.topMargin: card.contentTopInset
        anchors.leftMargin: card.contentLeftInset
        anchors.rightMargin: card.contentRightInset
        spacing: root.spacingTokens.sm

        TextField {
          id: input
          width: content.width
          padding: 0
          topPadding: root.spacingTokens.controlPaddingY
          bottomPadding: root.spacingTokens.controlPaddingY
          background: null
          focus: true
          readOnly: root.saving
          maximumLength: Model.maximumLength
          placeholderText: "jot ▸"
          placeholderTextColor: Color.muted
          color: root.menuColors.text
          selectionColor: root.menuColors.selectedBackground
          selectedTextColor: root.menuColors.selectedText
          font.family: root.fontTokens.menuFamily
          font.pixelSize: root.fontTokens.heading
          onAccepted: root.save()
          Keys.onEscapePressed: event => {
            root.dismiss()
            event.accepted = true
          }
          Keys.onPressed: event => {
            if (event.key === Qt.Key_U && event.modifiers === Qt.ControlModifier) {
              if (!root.saving) {
                input.clear()
                root.errorText = ""
              }
              event.accepted = true
            }
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
