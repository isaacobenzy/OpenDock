import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { collectPackages } from './collect-packages.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'opendock-packages-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [dir, ext] of [['nsis', 'exe'], ['msi', 'msi'], ['deb', 'deb'], ['rpm', 'rpm'], ['appimage', 'AppImage']]) {
    mkdirSync(join(root, dir));
    const filename = (version) => ext === 'rpm' ? `OpenDock-${version}-1.x86_64.rpm` : `OpenDock_${version}_x64.${ext}`;
    writeFileSync(join(root, dir, filename('0.2.0')), 'package');
    writeFileSync(join(root, dir, filename('0.1.0')), 'stale');
  }
  return { version: '0.2.0', bundleDir: root, outputDir: join(root, 'out') };
}

for (const [platform, count] of [['windows-x64', 2], ['linux-x64', 3]]) {
  test(`collects only current ${platform} packages with verifiable checksums`, (t) => {
    const input = fixture(t);
    const files = collectPackages({ ...input, platform });
    assert.equal(files.length, count);
    for (const { name, hash } of files) assert.equal(createHash('sha256').update(readFileSync(join(input.outputDir, name))).digest('hex'), hash);
    const sums = readFileSync(join(input.outputDir, `SHA256SUMS-${platform}.txt`), 'utf8');
    assert.ok(sums.endsWith('\n'));
    assert.ok(!sums.includes('\r'));
    assert.ok(!sums.includes('0.1.0'));
    assert.throws(() => collectPackages({ ...input, platform }), /EEXIST/);
  });
}
test('refuses partial, ambiguous and unsupported package sets', (t) => {
  const input = fixture(t);
  assert.throws(() => collectPackages({ ...input, platform: '../../elsewhere' }), /Unsupported/);
  rmSync(join(input.bundleDir, 'rpm', 'OpenDock-0.2.0-1.x86_64.rpm'));
  assert.throws(() => collectPackages({ ...input, platform: 'linux-x64' }), /Expected one .rpm/);
  writeFileSync(join(input.bundleDir, 'msi', 'Other_0.2.0_x64.msi'), 'extra');
  assert.throws(() => collectPackages({ ...input, platform: 'windows-x64' }), /Expected one .msi/);
});
