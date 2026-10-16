const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const script = path.join(__dirname, '../scripts/lint-qml.sh');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omajot-lint-'));
  const shell = path.join(dir, 'omarchy', 'shell');
  fs.mkdirSync(shell, { recursive: true });
  const fake = path.join(dir, 'qmllint');
  fs.writeFileSync(
    fake,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'json=""',
      'while [[ $# -gt 0 ]]; do',
      '  if [[ "$1" == "--json" ]]; then',
      '    json=$2',
      '    shift 2',
      '  else',
      '    shift',
      '  fi',
      'done',
      '[[ -n "$json" ]]',
      'cp -- "$FAKE_JSON" "$json"',
      'if [[ -n "${FAKE_STDOUT:-}" ]]; then',
      '  printf "%s\\n" "$FAKE_STDOUT"',
      'fi',
      'exit "${FAKE_EXIT:-255}"',
      ''
    ].join('\n')
  );
  fs.chmodSync(fake, 0o755);
  return { dir, fake, shell: path.join(dir, 'omarchy') };
}

function runLint(extra) {
  const { dir, fake, shell } = fixture();
  const report = path.join(dir, 'report.json');
  fs.writeFileSync(report, extra.report);
  const result = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      QMLLINT: fake,
      OMARCHY_PATH: shell,
      FAKE_JSON: report,
      FAKE_EXIT: extra.exitCode ?? '255',
      FAKE_STDOUT: extra.stdout ?? '',
      GITHUB_ACTIONS: extra.actions ?? '',
      GITHUB_WORKSPACE: extra.workspace ?? ''
    }
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

const silentReport = JSON.stringify({
  revision: 6,
  files: [
    {
      filename: '/work/plugin/Overlay.qml',
      success: false,
      warnings: [
        {
          type: 'warning',
          id: 'block-scope-var-declaration',
          line: 37,
          column: 16,
          message:
            'var declaration in block scope is hoisted to function scope\nReplace it with const or let to silence the warning\n'
        },
        {
          type: 'error',
          id: 'syntax',
          line: 4,
          column: 1,
          message: 'use 100% of the line\r\n'
        }
      ]
    }
  ]
});

test('prints JSON findings when qmllint exits silently', () => {
  const result = runLint({
    report: silentReport,
    actions: 'true',
    workspace: '/work'
  });
  assert.equal(result.status, 255);
  assert.equal(result.stdout, '');
  assert.match(
    result.stderr,
    /plugin\/Overlay\.qml:37:16: warning: \[block-scope-var-declaration\] var declaration in block scope is hoisted to function scope Replace it with const or let to silence the warning/
  );
  assert.match(
    result.stderr,
    /::warning file=plugin\/Overlay\.qml,line=37,col=16::\[block-scope-var-declaration\] var declaration in block scope is hoisted to function scope Replace it with const or let to silence the warning/
  );
  assert.match(
    result.stderr,
    /plugin\/Overlay\.qml:4:1: error: \[syntax\] use 100% of the line/
  );
  assert.match(
    result.stderr,
    /::error file=plugin\/Overlay\.qml,line=4,col=1::\[syntax\] use 100%25 of the line/
  );
});

test('keeps console diagnostics and a successful run quiet', () => {
  const printed = runLint({
    report: silentReport,
    stdout: 'Overlay.qml:3:1: error: already printed',
    exitCode: '1'
  });
  assert.equal(printed.status, 1);
  assert.match(printed.stderr, /already printed/);
  assert.doesNotMatch(printed.stderr, /block-scope-var-declaration/);

  const clean = runLint({
    report: JSON.stringify({ revision: 6, files: [{ filename: 'Overlay.qml', warnings: [] }] }),
    exitCode: '0'
  });
  assert.equal(clean.status, 0);
  assert.equal(clean.stdout, '');
  assert.equal(clean.stderr, '');
});
