import Quickshell
import Quickshell.Hyprland
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui

Item {
  id: root

  property var shell: null
  property var manifest: null
  readonly property string moduleName: "io.github.phausser.omajot"
  property bool opened: false

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
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() {
    root.opened = false
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

  PanelWindow {
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
      color: Color.menu.scrim
    }

    BorderSurface {
      id: card
      anchors.centerIn: parent
      width: Math.min(Style.space(600), panel.width - Style.gapsOut * 2)
      height: label.implicitHeight + contentTopInset + contentBottomInset
      radius: Style.cornerRadius
      color: Color.menu.background
      borderSpec: Border.surfaceSpec("menu", "border", Color.menu.border, Math.max(1, Style.space(2)))
      padding: Style.spacing.panelPadding

      Item {
        id: keyCatcher
        anchors.fill: parent
        focus: true
        Keys.onEscapePressed: event => {
          root.dismiss()
          event.accepted = true
        }
      }

      Text {
        id: label
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        anchors.leftMargin: card.contentLeftInset
        anchors.rightMargin: card.contentRightInset
        text: "Omajot preview — saving is not available yet. Escape to close."
        textFormat: Text.PlainText
        wrapMode: Text.WordWrap
        color: Color.menu.text
        font.family: Style.font.menuFamily
        font.pixelSize: Style.font.heading
      }
    }
  }
}
