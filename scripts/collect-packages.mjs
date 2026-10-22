import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const formats = {
  'windows-x64': [['nsis', '.exe'], ['msi', '.msi']],
  'linux-x64': [['deb', '.deb'], ['rpm', '.rpm'], ['appimage', '.AppImage']],
};

export function collectPackages({ platform, version, bundleDir, outputDir }) {
  if (!Object.hasOwn(formats, platform)) throw new Error(`Unsupported platform: ${platform}`);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid package version');
  const files = formats[platform].map(([folder, extension]) => {
    const sourceDir = join(bundleDir, folder);
    const versionMarker = extension === '.rpm' ? `-${version}-` : `_${version}_`;
    const matches = readdirSync(sourceDir).filter((name) => name.endsWith(extension) && name.includes(versionMarker));
    if (matches.length !== 1) throw new Error(`Expected one ${extension} package for ${version}, found ${matches.length}`);
    const name = matches[0];
    if (!/^[A-Za-z0-9_.+-]+$/.test(name)) throw new Error(`Unsafe package filename: ${name}`);
    const source = join(sourceDir, name);
    const hash = createHash('sha256').update(readFileSync(source)).digest('hex');
    return { name, source, hash };
  });
  // Refuse reuse so a failed build cannot publish artifacts left by a previous run.
  mkdirSync(outputDir, { recursive: false });
  for (const file of files) copyFileSync(file.source, join(outputDir, file.name));
  writeFileSync(join(outputDir, `SHA256SUMS-${platform}.txt`), files.map((file) => `${file.hash}  ${file.name}\n`).join(''));
  return files.map(({ name, hash }) => ({ name, hash }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const tauriDir = join(root, 'apps/desktop/src-tauri');
  const config = JSON.parse(readFileSync(join(tauriDir, 'tauri.conf.json'), 'utf8'));
  const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--no-deps', '--locked', '--manifest-path', join(tauriDir, 'Cargo.toml')], { encoding: 'utf8' }));
  const platform = process.argv[2];
  if (!Object.hasOwn(formats, platform)) throw new Error('Use windows-x64 or linux-x64');
  mkdirSync(join(root, 'release'), { recursive: true });
  const result = collectPackages({ platform, version: config.version, bundleDir: join(metadata.target_directory, 'release/bundle'), outputDir: join(root, 'release', platform) });
  console.log(JSON.stringify({ platform, version: config.version, packages: result }, null, 2));
}
