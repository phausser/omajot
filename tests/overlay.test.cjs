const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the real controller functions. This does not simulate QML rendering,
// key delivery, Process signals, or input-method behavior; those need a session.
function overlay() {
  const input = {
    text: '',
    inputMethodComposing: false,
    cursorPosition: 0,
    clear() { this.text = ''; this.cursorPosition = 0; },
    forceActiveFocus() {}
  };
  const root = { editorPending: false, recalling: false, recallGeneration: 0, readFinished: null, configReady: true, configError: '', notePath: '~/omajot.md', opened: false, saving: false, pendingDead: 0, errorText: '', writeFinished: null, moduleName: 'io.github.phausser.omajot' };
  const reader = { running: false, command: [] };
  const writer = { running: false, command: [] };
  const model = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../OmajotModel.js'), 'utf8'), model);
  const Qt = {
    callLater: fn => fn(),
    NoModifier: 0,
    Key_Up: 0x01000013,
    Key_Escape: 0x01000000,
    Key_Return: 0x01000004,
    Key_Enter: 0x01000005,
    Key_Backspace: 0x01000003,
    Key_Space: 0x20,
    Key_A: 0x41,
    Key_Z: 0x5a,
    Key_U: 0x55,
    Key_V: 0x56,
    Key_Dead_Grave: 0x01001250,
    Key_Dead_Acute: 0x01001251,
    Key_Dead_Circumflex: 0x01001252,
    Key_Dead_Tilde: 0x01001253,
    Key_Dead_Diaeresis: 0x01001257,
    Key_Dead_Longsolidusoverlay: 0x01001293,
    ControlModifier: 0x04000000,
    AltModifier: 0x08000000,
    MetaModifier: 0x10000000,
    ShiftModifier: 0x02000000
  };
  const Util = {
    editsFilter(event, text) {
      if (!text) return false;
      if (event.modifiers & (Qt.AltModifier | Qt.MetaModifier)) return false;
      if (event.key === Qt.Key_U) return event.modifiers === Qt.ControlModifier;
      return event.key === Qt.Key_Backspace;
    },
    editedFilter(event, text) {
      if (event.key === Qt.Key_U) return '';
      if (event.modifiers & Qt.ControlModifier)
        return text.replace(/\s+$/, '').replace(/\S+$/, '');
      return text.slice(0, -1);
    }
  };
  const qs = { launched: [], execDetached(command) { this.launched.push(Array.from(command)); }, env: () => '/tmp/omajot-controller-test', screens: [], clipboardText: '' };
  const context = vm.createContext({ root, input, writer, reader, Model: model, panel: {},
    Qt, Util, Hyprland: { focusedMonitor: null },
    Quickshell: qs });
  const source = fs.readFileSync(path.join(__dirname, '../Overlay.qml'), 'utf8');
  const functions = source.match(/^  function \w+\([^]*?^  }/gm);
  assert.ok(functions?.length, 'QML controller functions found');
  for (const fn of functions) {
    const name = fn.match(/function (\w+)/)[1];
    vm.runInContext(`${fn}\nroot.${name} = ${name}`, context);
  }
  let hostOpen = false;
  root.shell = {
    hide() { hostOpen = false; root.close(); },
    summon() { hostOpen = true; root.open('{}'); }
  };
  return { root, input, writer, reader, quickshell: qs, hostOpen: () => hostOpen,
    open(text = 'draft') { root.shell.summon(); input.text = text; input.cursorPosition = text.length; },
    finish(code = 0, status = 0) { writer.running = false; root.finishWrite(code, status); } };
}

test('Enter waits for success and ignores duplicate submissions', () => {
  const ui = overlay();
  ui.open();
  ui.root.save();
  const command = ui.writer.command;
  const callback = ui.root.writeFinished;
  ui.root.save();
  assert.equal(ui.writer.command, command);
  assert.equal(ui.root.writeFinished, callback);
  assert.equal(ui.root.opened, true);
  assert.equal(ui.input.text, 'draft');
  ui.finish();
  assert.equal(ui.root.saving, false);
  assert.equal(ui.root.opened, false);
  assert.equal(ui.hostOpen(), false);
  assert.equal(ui.input.text, '');
});

test('a second Enter after a fast success cannot start another write', () => {
  const ui = overlay();
  ui.open();
  ui.root.save();
  const origDismiss = ui.root.dismiss.bind(ui.root);
  ui.root.dismiss = function() {
    ui.root.save();
    origDismiss();
  };
  ui.finish();
  assert.equal(ui.writer.running, false);
  assert.equal(ui.root.writeFinished, null);
  assert.equal(ui.root.saving, false);
  assert.equal(ui.root.opened, false);
  assert.equal(ui.input.text, '');
});

test('empty Enter and dismissal clear drafts without a process', () => {
  const ui = overlay();
  ui.open(' \t ');
  ui.root.save();
  assert.equal(ui.writer.running, false);
  assert.equal(ui.root.opened, false);
  ui.open();
  ui.root.toggle();
  assert.equal(ui.input.text, '');
  assert.equal(ui.hostOpen(), false);
  assert.equal(ui.writer.running, false);
});

test('write and startup failures preserve the draft and allow retry', () => {
  for (const code of [1, -1]) {
    const ui = overlay();
    ui.open();
    ui.root.save();
    ui.finish(code, 1);
    assert.equal(ui.root.errorText, "couldn't write ~/omajot.md");
    assert.equal(ui.root.opened, true);
    assert.equal(ui.input.text, 'draft');
    assert.equal(ui.root.saving, false);
    ui.root.save();
    ui.finish();
    assert.equal(ui.root.opened, false);
  }
});

test('a failed write after host Hide restores the draft and host state', () => {
  const ui = overlay();
  ui.open();
  ui.root.save();
  ui.root.shell.hide();
  assert.equal(ui.input.text, 'draft');
  ui.finish(1);
  assert.equal(ui.root.opened, true);
  assert.equal(ui.hostOpen(), true);
  assert.equal(ui.input.text, 'draft');
});

test('rapid toggles while saving cannot start another write', () => {
  const ui = overlay();
  ui.open();
  ui.root.save();
  const callback = ui.root.writeFinished;
  ui.root.toggle();
  ui.root.toggle();
  ui.root.save();
  assert.equal(ui.root.writeFinished, callback);
  assert.equal(ui.input.text, 'draft');
  ui.finish();
  assert.equal(ui.root.opened, false);
});

test('printable keys go through a focused TextInput with a keysym fallback', () => {
  const source = fs.readFileSync(path.join(__dirname, '../Overlay.qml'), 'utf8');
  assert.match(source, /function handleKey\(event\)/);
  assert.match(source, /function textFromEvent\(event\)/);
  assert.match(source, /function isDeadKey\(key\)/);
  assert.match(source, /TextInput\s+\{/);
  assert.match(source, /Keys\.onPressed:\s*function\(event\) \{ root\.handleKey\(event\) \}/);
  assert.doesNotMatch(source, /^\s+TextField\s+\{/m);
});

test('handleKey inserts from event.text or keysym when text is empty', () => {
  const ui = overlay();
  ui.open('');
  const event = (key, text, modifiers = 0) => ({ key, text, modifiers, accepted: false });
  const a = event(0x41, '');
  ui.root.handleKey(a);
  assert.equal(ui.input.text, 'a');
  assert.equal(a.accepted, true);
  const b = event(0x41, 'B');
  ui.root.handleKey(b);
  assert.equal(ui.input.text, 'aB');
  const space = event(0x20, '');
  ui.root.handleKey(space);
  assert.equal(ui.input.text, 'aB ');
  const back = event(0x01000003, '');
  ui.root.handleKey(back);
  assert.equal(ui.input.text, 'aB');
  const umlaut = event(0xe4, '');
  ui.root.handleKey(umlaut);
  assert.equal(ui.input.text, 'aBä');
  const glyph = event(0, '漢字😀');
  ui.root.handleKey(glyph);
  assert.equal(ui.input.text, 'aBä漢字😀');
});

test('dead acute plus a letter composes without IME', () => {
  const ui = overlay();
  ui.open('');
  const event = (key, text, modifiers = 0) => ({ key, text, modifiers, accepted: false });
  const dead = event(0x01001251, '');
  ui.root.handleKey(dead);
  assert.equal(dead.accepted, true);
  assert.equal(ui.input.text, '');
  assert.equal(ui.root.pendingDead, 0x01001251);
  const letter = event(0x41, '');
  ui.root.handleKey(letter);
  assert.equal(letter.accepted, true);
  assert.equal(ui.input.text, 'á');
  assert.equal(ui.root.pendingDead, 0);
});

test('Ctrl+V inserts clipboard text into the field', () => {
  const ui = overlay();
  ui.open('');
  ui.quickshell.clipboardText = '漢字😀';
  const paste = { key: 0x56, text: '', modifiers: 0x04000000, accepted: false };
  ui.root.handleKey(paste);
  assert.equal(ui.input.text, '漢字😀');
  assert.equal(paste.accepted, true);
  const empty = overlay();
  empty.open('');
  const pass = { key: 0x56, text: '', modifiers: 0x04000000, accepted: false };
  empty.root.handleKey(pass);
  assert.equal(empty.input.text, '');
  assert.equal(pass.accepted, false);
});

test('Enter during composition does not submit', () => {
  const ui = overlay();
  ui.open();
  ui.input.inputMethodComposing = true;
  ui.root.save();
  assert.equal(ui.writer.running, false);
  assert.equal(ui.root.opened, true);
  const enter = { key: 0x01000004, text: '\n', modifiers: 0, accepted: false };
  ui.root.handleKey(enter);
  assert.equal(enter.accepted, false);
  assert.equal(ui.writer.running, false);
  assert.equal(ui.root.opened, true);
});

test('configured path reaches writer; invalid config preserves draft', () => {
  const ui = overlay();
  ui.root.loadConfig('{"path":"~/custom notes.md"}');
  ui.open();
  ui.root.save();
  assert.equal(ui.writer.command[4], '/tmp/omajot-controller-test/custom notes.md');
  ui.finish(1);
  assert.equal(ui.root.errorText, "couldn't write ~/custom notes.md");
  ui.root.loadConfig('{broken');
  ui.root.save();
  assert.equal(ui.writer.running, false);
  assert.equal(ui.input.text, 'draft');
  assert.equal(ui.root.opened, true);
  assert.equal(ui.root.errorText, "couldn't read ~/.config/omajot.json");
});

test('pending config prevents writing, but empty Enter still closes', () => {
  const ui = overlay();
  ui.root.configReady = false;
  ui.open();
  ui.root.save();
  assert.equal(ui.writer.running, false);
  assert.equal(ui.input.text, 'draft');
  ui.input.text = '   ';
  ui.root.save();
  assert.equal(ui.root.opened, false);
});

test('Up loads the last text and Enter appends it as a new note', () => {
  const ui = overlay();
  ui.open('');
  ui.root.handleKey({key: 0x01000013, modifiers: 0});
  assert.equal(ui.reader.running, true);
  ui.root.save();
  assert.equal(ui.writer.running, false);
  ui.root.finishRead(0, 0, '2026-09-12 12:34  ä 漢字😀\n');
  assert.equal(ui.input.text, 'ä 漢字😀');
  assert.equal(ui.input.cursorPosition, ui.input.text.length);
  ui.root.save();
  assert.match(ui.writer.command[5], /  ä 漢字😀\n$/);
});

test('recall errors and empty history preserve drafts; duplicate reads are blocked', () => {
  const ui = overlay();
  ui.open();
  ui.root.recall();
  const finished = ui.root.readFinished;
  ui.root.recall();
  assert.equal(ui.root.readFinished, finished);
  ui.root.finishRead(1, 0, '');
  assert.equal(ui.root.errorText, "couldn't read ~/omajot.md");
  assert.equal(ui.input.text, 'draft');
  assert.equal(ui.root.opened, true);
  ui.root.recall();
  ui.root.finishRead(0, 0, '');
  assert.equal(ui.input.text, 'draft');
});

test('late recall cannot replace newer input, another session, or another path', () => {
  for (const change of [ui => { ui.input.text = 'new'; },
    ui => { ui.root.dismiss(); ui.open('new'); },
    ui => { ui.root.notePath = '~/other.md'; ui.input.text = 'new'; }]) {
    const ui = overlay();
    ui.open();
    ui.root.recall();
    change(ui);
    ui.root.finishRead(0, 0, '2026-09-12 12:34  old\n');
    assert.equal(ui.input.text, 'new');
    assert.equal(ui.root.recalling, false);
  }
});

test('editor IPC opens configured path literally, closes host, and never writes', () => {
  const ui = overlay();
  ui.root.notePath = '~/ä $HOME `id`.md';
  ui.root.open('{"action":"editor"}');
  assert.deepEqual(ui.quickshell.launched, [['omarchy', 'launch', 'editor', '/tmp/omajot-controller-test/ä $HOME `id`.md']]);
  assert.equal(ui.root.opened, false);
  assert.equal(ui.writer.running, false);
});

test('editor waits for configuration, cancels on close, and preserves invalid-config drafts', () => {
  const ui = overlay();
  ui.root.configReady = false;
  ui.root.open('{"action":"editor"}');
  assert.equal(ui.quickshell.launched.length, 0);
  ui.root.loadConfig('{"path":"~/other.md"}');
  ui.root.openEditor();
  assert.equal(ui.quickshell.launched[0][3], '/tmp/omajot-controller-test/other.md');
  const invalid = overlay();
  invalid.open('draft');
  invalid.root.loadConfig('{broken');
  invalid.root.open('{"action":"editor"}');
  assert.equal(invalid.quickshell.launched.length, 0);
  assert.equal(invalid.input.text, 'draft');
  assert.equal(invalid.root.opened, true);
  const cancelled = overlay();
  cancelled.root.configReady = false;
  cancelled.root.open('{"action":"editor"}');
  cancelled.root.dismiss();
  cancelled.root.loadConfig('{}');
  cancelled.root.openEditor();
  assert.equal(cancelled.quickshell.launched.length, 0);
});
