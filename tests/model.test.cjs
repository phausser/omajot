const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Execute the actual QML-importable source without a second implementation.
const model = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../OmajotModel.js'), 'utf8'), model);

test('resolves the default note filename under an absolute home', () => {
  assert.equal(model.resolvePath('/tmp/test home/'), '/tmp/test home/omajot.md');
  assert.equal(model.resolvePath('/'), '/omajot.md');
  for (const home of ['', '~', undefined, 'relative'])
    assert.throws(() => model.resolvePath(home), /couldn't write/);
});

test('trims input and skips empty input', () => {
  assert.equal(model.normalizeText(' \t hello  world \n'), 'hello  world');
  for (const input of ['', ' \t\r\n', '\u2003\u00a0'])
    assert.equal(model.formatLine(input), '');
});

test('formats local time, two spaces and exactly one trailing newline', () => {
  const date = new Date(2026, 0, 2, 3, 4, 59);
  assert.equal(model.formatLine('  hello  ', date), '2026-01-02 03:04  hello\n');
  assert.equal(model.formatLine('a\r\nb\u2028c\u2029d', date), '2026-01-02 03:04  a b c d\n');
});

test('preserves Unicode and literal markup and shell characters', () => {
  const input = 'Ä 🙂 中文 e\u0301 <b> $(echo hello) `id` %s';
  assert.equal(model.normalizeText(input), input);
});

test('caps input at 4000 UTF-16 units without splitting an emoji', () => {
  assert.equal(model.normalizeText('a'.repeat(4001)), 'a'.repeat(4000));
  assert.equal(model.normalizeText('a'.repeat(3998) + '🙂z'), 'a'.repeat(3998) + '🙂');
  assert.equal(model.normalizeText('a'.repeat(3999) + '🙂'), 'a'.repeat(3999));
  assert.equal(model.normalizeText('🙂'.repeat(2001)), '🙂'.repeat(2000));
});

test('configuration defaults, expands tilde and preserves absolute paths literally', () => {
  assert.equal(model.parseConfig('{}'), '~/omajot.md');
  assert.equal(model.resolvePath('/home/pat/', '~/custom.md'), '/home/pat/custom.md');
  assert.equal(model.resolvePath('/', '~/custom.md'), '/custom.md');
  assert.equal(model.resolvePath('/home/pat', '~'), '/home/pat');
  assert.equal(model.resolvePath(undefined, '/tmp/ä $HOME `id`.md'), '/tmp/ä $HOME `id`.md');
  for (const value of ['', 'relative', '~other/note', null, 42, '/tmp/a\0b'])
    assert.throws(() => model.parseConfig(JSON.stringify({path: value})));
  for (const text of ['null', '[]', '{broken']) assert.throws(() => model.parseConfig(text));
});
