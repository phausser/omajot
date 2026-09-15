const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omajot-setup-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  const config = path.join(dir, 'config with spaces');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(config, 'hypr'), { recursive: true });
  const file = path.join(config, 'hypr/bindings.lua');
  const original = '-- personal settings without a final newline';
  fs.writeFileSync(file, original, { mode: 0o640 });
  fs.writeFileSync(path.join(dir, 'options.json'), JSON.stringify(options));
  const mock = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const root = process.env.SETUP_TEST_DIR;
const options = JSON.parse(fs.readFileSync(path.join(root, 'options.json')));
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(path.join(root, 'calls'), tool + ' ' + args.join(' ') + '\\n');
const text = fs.readFileSync(path.join(process.env.XDG_CONFIG_HOME, 'hypr/bindings.lua'), 'utf8');
const changed = text.includes('-- Omajot shortcuts');
if (tool === 'omarchy') {
  if (args[1] === 'enable' && options.enableError) process.exit(1);
  if (args[1] === 'validate' && options.validateError) process.exit(1);
} else if (args[0] === 'configerrors') {
  if (options.existingError || (changed && options.configError)) console.log('configuration error');
} else if (args[0] === 'reload') {
  if (changed && options.reloadError) process.exit(1);
} else if (args[0] === 'binds') {
  if (options.ipcError) process.exit(1);
  const bindings = options.bindings || [];
  if (changed && !options.ignoreFile) {
    for (const [mask, keys, description] of [[64, 'SUPER + N', 'Omajot'], [72, 'SUPER + ALT + N', 'Omajot editor']]) {
      if (text.includes('o.bind("' + keys + '"')) bindings.push({ modmask: mask, key: 'N', description, dispatcher: '__lua', submap: '' });
    }
  }
  console.log(options.invalidJson ? '{}' : JSON.stringify(bindings));
}
`;
  for (const tool of ['hyprctl', 'omarchy']) {
    fs.writeFileSync(path.join(bin, tool), mock, { mode: 0o755 });
  }
  return {
    file, original,
    read: () => fs.readFileSync(file, 'utf8'),
    backups: () => fs.readdirSync(path.dirname(file)).filter(x => x.includes('backup')),
    calls: () => fs.readFileSync(path.join(dir, 'calls'), 'utf8'),
    run: (...args) => spawnSync('bash', [path.join(__dirname, '../scripts/setup.sh'), ...args], {
      encoding: 'utf8',
      env: { ...process.env, XDG_CONFIG_HOME: config, SETUP_TEST_DIR: dir, PATH: `${bin}:${process.env.PATH}` },
    }),
  };
}

test('setup appends both shortcuts, preserves the file and mode, and is repeatable', t => {
  const f = fixture(t);
  const first = f.run();
  assert.equal(first.status, 0, first.stderr);
  assert.ok(f.read().startsWith(f.original + '\n'));
  assert.ok(f.read().includes(`'{"action":"editor"}'`));
  assert.equal(fs.statSync(f.file).mode & 0o777, 0o640);
  assert.equal(f.backups().length, 1);
  assert.equal(fs.readFileSync(path.join(path.dirname(f.file), f.backups()[0]), 'utf8'), f.original);
  const saved = f.read();
  const second = f.run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(f.read(), saved);
  assert.equal(f.backups().length, 1);
  assert.match(f.calls(), /omarchy plugin enable io.github.phausser.omajot/);
});

test('setup recognizes existing Omarchy Lua bindings and adds only the missing action', t => {
  const f = fixture(t, { bindings: [{ modmask: 72, key: 'N', description: 'Omajot im Editor', dispatcher: '__lua' }] });
  assert.equal(f.run().status, 0);
  assert.match(f.read(), /SUPER \+ N/);
  assert.doesNotMatch(f.read(), /SUPER \+ ALT/);
});

for (const binding of [
  { modmask: 64, key: 'n', description: 'Other application' },
  { modmask: 72, key: '', keycode: 57, description: 'Physical key binding' },
  { modmask: 64, key: 'N', submap: 'resize', description: 'Omajot', dispatcher: '__lua' },
  { modmask: 64, key: '', catch_all: true, description: 'Catch all' },
]) {
  test(`setup rejects conflicts without changing the file: ${binding.description}`, t => {
    const f = fixture(t, { bindings: [binding] });
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /already bound/);
    assert.equal(f.read(), f.original);
    assert.deepEqual(f.backups(), []);
    assert.doesNotMatch(f.calls(), /plugin enable/);
  });
}

for (const option of ['configError', 'reloadError', 'enableError', 'ignoreFile']) {
  test(`setup restores original bindings after ${option}`, t => {
    const f = fixture(t, { [option]: true });
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.equal(f.read(), f.original);
    assert.match(result.stderr, /Restored bindings/);
    assert.equal(f.backups().length, 1);
  });
}

for (const option of ['ipcError', 'existingError', 'validateError', 'invalidJson']) {
  test(`setup leaves configuration untouched on ${option}`, t => {
    const f = fixture(t, { [option]: true });
    assert.notEqual(f.run().status, 0);
    assert.equal(f.read(), f.original);
    assert.deepEqual(f.backups(), []);
    assert.doesNotMatch(f.calls(), /plugin enable/);
  });
}

test('--check reports available shortcuts without reload, writes, or enable', t => {
  const f = fixture(t);
  const result = f.run('--check');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SUPER \+ N: free/);
  assert.equal(f.read(), f.original);
  assert.deepEqual(f.backups(), []);
  assert.doesNotMatch(f.calls(), /reload|plugin enable/);
});
