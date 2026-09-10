const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the real controller functions. This does not simulate QML rendering,
// key delivery, Process signals, or input-method behavior; those need a session.
function overlay() {
  const input = { text: '', inputMethodComposing: false, clear() { this.text = ''; }, forceActiveFocus() {} };
  const root = { opened: false, saving: false, errorText: '', writeFinished: null, moduleName: 'io.github.phausser.omajot' };
  const writer = { running: false, command: [] };
  const model = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../OmajotModel.js'), 'utf8'), model);
  const context = vm.createContext({ root, input, writer, Model: model, panel: {},
    Qt: { callLater: fn => fn() }, Hyprland: { focusedMonitor: null },
    Quickshell: { env: () => '/tmp/omajot-controller-test', screens: [] } });
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
  return { root, input, writer, hostOpen: () => hostOpen,
    open(text = 'draft') { root.shell.summon(); input.text = text; },
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

test('Enter during composition does not submit', () => {
  const ui = overlay();
  ui.open();
  ui.input.inputMethodComposing = true;
  ui.root.save();
  assert.equal(ui.writer.running, false);
  assert.equal(ui.root.opened, true);
});
