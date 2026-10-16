const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawn, execFileSync } = require('node:child_process');
const { test } = require('node:test');

const model = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../OmajotModel.js'), 'utf8'), model);
const date = new Date(2026, 8, 10, 15, 1);

function temporaryHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'omajot-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return home;
}

function run(command, finished, input) {
  const child = spawn(command[0], Array.from(command.slice(1)), { stdio: ['pipe', 'ignore', 'ignore'] });
  child.on('error', () => finished(-1, 1));
  child.on('close', (code, signal) => finished(code, signal ? 1 : 0));
  child.stdin.on('error', () => {});
  child.stdin.end(input, 'utf8');
}

function helperArguments(pid) {
  const cmdline = `/proc/${pid}/cmdline`;
  if (fs.existsSync(cmdline)) return fs.readFileSync(cmdline).toString('utf8');
  return execFileSync('ps', ['-ww', '-p', String(pid), '-o', 'args='], { encoding: 'utf8' });
}

function waitForArguments(child) {
  const pause = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 2000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('helper exited before its command line could be checked');
    try {
      const listed = helperArguments(child.pid);
      if (listed.includes('read -r')) return listed;
    } catch (error) {
      lastError = error;
    }
    Atomics.wait(pause, 0, 0, 20);
  }
  throw new Error('helper command line was not visible' + (lastError ? ': ' + lastError.message : ''));
}

function append(home, text, runner = run) {
  return new Promise(resolve => model.append(text, home, runner, resolve, date));
}

test('creates only the note file and appends UTF-8 without replacing existing bytes', async t => {
  const home = temporaryHome(t);
  const file = path.join(home, 'omajot.md');
  assert.equal(await append(home, '  Ä 🙂 中文  '), '');
  assert.deepEqual(fs.readdirSync(home), ['omajot.md']);
  assert.equal(fs.readFileSync(file, 'utf8'), '2026-09-10 15:01  Ä 🙂 中文\n');
  const original = Buffer.from([0xff, 0x00, 0x61]);
  fs.writeFileSync(file, original);
  const inode = fs.statSync(file).ino;
  assert.equal(await append(home, 'next'), '');
  assert.deepEqual(fs.readFileSync(file), Buffer.concat([original, Buffer.from('2026-09-10 15:01  next\n')]));
  assert.equal(fs.statSync(file).ino, inode);
});

test('passes shell metacharacters and paths literally', async t => {
  const home = path.join(temporaryHome(t), 'space " \' $HOME `id`');
  fs.mkdirSync(home);
  const text = '$(touch nope) `id` " \' \\ %s <b>text</b>';
  assert.equal(await append(home, text), '');
  assert.equal(fs.readFileSync(path.join(home, 'omajot.md'), 'utf8'), `2026-09-10 15:01  ${text}\n`);
  assert.deepEqual(fs.readdirSync(home), ['omajot.md']);
});

test('empty input starts no process and creates no file', async t => {
  const home = temporaryHome(t);
  let called = false;
  assert.equal(await append(home, ' \n\t', () => { called = true; }), '');
  assert.equal(called, false);
  assert.deepEqual(fs.readdirSync(home), []);
});

test('directory target and missing parent return errors without creating directories', async t => {
  const home = temporaryHome(t);
  fs.mkdirSync(path.join(home, 'omajot.md'));
  assert.equal(await append(home, 'keep me'), model.writeError);
  assert.equal(await append(path.join(home, 'missing'), 'keep me'), model.writeError);
  assert.deepEqual(fs.readdirSync(home), ['omajot.md']);
});

test('read-only target returns an error and preserves content', async t => {
  assert.notEqual(process.getuid(), 0, 'Permission test must run as an unprivileged user');
  const home = temporaryHome(t);
  const file = path.join(home, 'omajot.md');
  fs.writeFileSync(file, 'existing', { mode: 0o400 });
  fs.chmodSync(file, 0o400);
  assert.equal(await append(home, 'keep me'), model.writeError);
  assert.equal(fs.readFileSync(file, 'utf8'), 'existing');
  assert.equal(fs.statSync(file).mode & 0o777, 0o400);
});

test('write failure after opening a temporary file returns an error', async t => {
  const home = temporaryHome(t);
  const file = path.join(home, 'omajot.md');
  fs.writeFileSync(file, 'existing');
  // A zero file-size limit forces a real failed write, without filling a disk.
  const limitedRun = (command, finished, input) => {
    const limited = Array.from(command);
    limited[2] = 'ulimit -c 0; ulimit -f 0; ' + limited[2];
    run(limited, finished, input);
  };
  assert.equal(await append(home, 'keep me', limitedRun), model.writeError);
  assert.equal(fs.readFileSync(file, 'utf8'), 'existing');
});

test('waits for completion, reports crashes and startup errors, completes once', async () => {
  let complete;
  const results = [];
  model.append('note', '/tmp', (_command, finished) => { complete = finished; }, error => results.push(error), date);
  assert.deepEqual(results, []);
  complete(0, 1);
  complete(0, 0);
  assert.deepEqual(results, [model.writeError]);
  assert.equal(await append('/tmp', 'note', () => { throw new Error('startup failed'); }), model.writeError);
  assert.equal(await append('/tmp', 'note', (_command, finished) => finished(-1, 1)), model.writeError);
});

test('rejects NUL arguments before starting the helper', async () => {
  let called = false;
  const runner = () => { called = true; };
  assert.equal(await append('/tmp', 'a\0b', runner), model.writeError);
  assert.equal(await append('/tmp/\0', 'note', runner), model.writeError);
  assert.equal(called, false);
});

test('note text stays off the process list and a new file is private', async t => {
  const home = temporaryHome(t);
  fs.chmodSync(home, 0o755);
  const secret = 'private note $(id) `whoami`';
  const file = path.join(home, 'omajot.md');
  const seen = {};
  const runner = (command, finished, input) => {
    // Start from a permissive umask. The helper has to tighten it itself.
    const loose = Array.from(command);
    loose[2] = 'umask 022; ' + loose[2];
    seen.command = command.slice();
    seen.input = input;
    const child = spawn(loose[0], loose.slice(1), { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => finished(-1, 1));
    child.on('close', (code, signal) => finished(code, signal ? 1 : 0));
    child.stdin.on('error', () => {});
    try {
      seen.listed = waitForArguments(child);
      seen.existedWhileWaiting = fs.existsSync(file);
    } catch (error) {
      seen.inspectionError = error;
    } finally {
      if (child.stdin.writable) child.stdin.end(input, 'utf8');
    }
  };
  assert.equal(await append(home, secret, runner), '');
  if (seen.inspectionError) throw seen.inspectionError;
  assert.equal(seen.command.some(part => String(part).includes(secret)), false);
  assert.equal(seen.input.includes(secret), true);
  assert.equal(seen.listed.includes(secret), false);
  assert.equal(seen.existedWhileWaiting, false);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(file, 'utf8'), `2026-09-10 15:01  ${secret}\n`);
});

test('append keeps the mode of an existing note file', async t => {
  const home = temporaryHome(t);
  const file = path.join(home, 'omajot.md');
  fs.writeFileSync(file, 'existing\n');
  fs.chmodSync(file, 0o644);
  assert.equal(await append(home, 'next'), '');
  assert.equal(fs.statSync(file).mode & 0o777, 0o644);
  assert.equal(fs.readFileSync(file, 'utf8'), 'existing\n2026-09-10 15:01  next\n');
});

test('custom path appends literally and missing parent is not created', async t => {
  const home = temporaryHome(t);
  const file = path.join(home, 'ä notes $HOME `id`.md');
  const save = target => new Promise(resolve => model.append('next', home, run, resolve, date, target));
  fs.writeFileSync(file, 'original\n');
  assert.equal(await save(file), '');
  assert.equal(fs.readFileSync(file, 'utf8'), 'original\n2026-09-10 15:01  next\n');
  const missing = path.join(home, 'missing', 'notes.md');
  assert.equal(await save(missing), "couldn't write " + missing);
  assert.equal(fs.existsSync(path.dirname(missing)), false);
  assert.deepEqual(fs.readdirSync(home), [path.basename(file)]);
});

function readLast(home, target) {
  return new Promise(resolve => model.readLast(home, target, (command, finished) => {
    const child = spawn(command[0], Array.from(command.slice(1)));
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', data => { output += data; });
    child.on('error', () => finished(-1, 1, ''));
    child.on('close', (code, signal) => finished(code, signal ? 1 : 0, output));
  }, (error, text) => resolve({error, text})));
}

test('recall reads only the last line from a literal configured path without writes', async t => {
  const home = temporaryHome(t);
  const file = path.join(home, 'ä $HOME `id`.md');
  assert.deepEqual(await readLast(home, file), {error: '', text: ''});
  assert.deepEqual(fs.readdirSync(home), []);
  for (const ending of ['\n', '']) {
    const content = '2026-09-12 12:33  first\n2026-09-12 12:34  漢字😀' + ending;
    fs.writeFileSync(file, content);
    assert.deepEqual(await readLast(home, file), {error: '', text: '漢字😀'});
    assert.equal(fs.readFileSync(file, 'utf8'), content);
  }
  fs.writeFileSync(file, '');
  assert.deepEqual(await readLast(home, file), {error: '', text: ''});
  fs.chmodSync(file, 0o000);
  assert.equal((await readLast(home, file)).error, "couldn't read " + file);
  fs.chmodSync(file, 0o600);
  assert.equal((await readLast(home, home)).error, "couldn't read " + home);
});
