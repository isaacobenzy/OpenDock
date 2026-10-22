# Linux builds and package verification

Linux packages are being prepared for the combined desktop release. A successful build is not a claim of Windows shell feature parity: non-Windows shell functions currently use fallbacks. Check the release acceptance record before describing a distro or compositor as supported.

## Build

Use a native Linux environment with Node 22, the pnpm version in package.json, and Rust stable. The package workflow uses Ubuntu 22.04 as the compatibility baseline, rather than cross-compiling GTK/WebKitGTK from Windows.

```sh
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libfuse2 rpm
pnpm install --frozen-lockfile
pnpm --filter @opendock/desktop tauri build --bundles deb,rpm,appimage -- --locked
node scripts/collect-packages.mjs linux-x64
```

The collector requires a fresh release/linux-x64 directory, exactly one current-version package of each format, and writes SHA256SUMS-linux-x64.txt. It refuses partial or ambiguous output. Build directories from earlier runs must not be reused as release evidence.

The Desktop packages GitHub Actions workflow runs tests, Clippy, builds and package inspections on Windows and Linux. It can be dispatched without creating or publishing a release. Download its opendock-linux-x64 artifact to review DEB, RPM and AppImage files.

## Distribution acceptance

DEB targets compatible Debian/Ubuntu installations; RPM targets compatible Fedora-family installations; AppImage targets compatible glibc systems. These formats do not guarantee support for every distro. Record the exact OS version, architecture, desktop environment, display server, WebKitGTK and glibc versions in the release results.

For each advertised distro, verify checksums, install, launch, single-instance behaviour, settings persistence, app launching, keychain persistence, offline behaviour, upgrade and uninstall. Test X11 and Wayland independently, including GNOME, KDE Plasma and any advertised wlroots compositor. Do not disable WebKit's sandbox to make a smoke test pass.

```sh
sha256sum -c SHA256SUMS-linux-x64.txt
dpkg-deb --info OpenDock_*.deb
rpm -qip OpenDock-*.rpm
rpm -qp --requires OpenDock-*.rpm
```

Graphical session and installed-package tests must be recorded separately from headless compilation and package metadata checks. Linux currently has no recorded runtime acceptance results.

## References

- [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/)
- [AppImage compatibility baseline](https://v2.tauri.app/distribute/appimage/)
- [Debian packaging](https://v2.tauri.app/distribute/debian/)
- [RPM packaging](https://v2.tauri.app/distribute/rpm/)
