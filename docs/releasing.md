# Releasing

This is the checklist maintainers follow to ship a version. OpenDock uses [Semantic Versioning](https://semver.org); before 1.0, minor versions may include breaking changes, and those are called out in the changelog.

## Versions live in six places

Bump all of them in the release branch:

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `apps/desktop/package.json` | `version` |
| `apps/web/package.json` | `version` |
| `packages/config-schema/package.json` | `version` |
| `apps/desktop/src-tauri/Cargo.toml` | `version`, then run `cargo update -p opendock-desktop --offline` to refresh `Cargo.lock` |
| `apps/desktop/src-tauri/tauri.conf.json` | `version`. This is the one the installers use |

Also update the website's release data in `apps/web/src/data/releases.ts`, so the download page links the new files.

## 1. Prepare the release branch

```powershell
git switch develop
git pull
git switch -c release/0.3.0
```

- Bump the versions listed above.
- In `CHANGELOG.md`, move the *Unreleased* entries under a new heading `## [0.3.0] - YYYY-MM-DD` and update the comparison links at the bottom.
- Open a pull request from `release/0.3.0` into `staging`. Only fixes for problems found during the release go into this branch from now on.
- When `staging` is the candidate you want to ship, open a pull request from `staging` into `main`.

## 2. Verify

All CI checks must pass on the pull request. Then build the installers locally and run the [manual Windows matrix](testing.md#manual-windows-matrix) against the **installed** build:

```powershell
pnpm install --frozen-lockfile
pnpm lint; pnpm typecheck; pnpm test; pnpm test:rust
pnpm bundle:desktop
./scripts/collect-release.ps1 -OutDir release
```

`release/` then contains:

- `OpenDock_<version>_x64-setup.exe`
- `OpenDock_<version>_x64_en-US.msi`
- `SHA256SUMS.txt`

Record the results of the matrix, and the Windows versions you tested on, in the pull request.

## 3. Merge and tag

1. Squash-merge the release pull request into `staging`, then merge `staging` into `main`.
2. Tag the merge commit and push the tag:

   ```powershell
   git switch main
   git pull
   git tag -a v0.3.0 -m "OpenDock 0.3.0"
   git push origin v0.3.0
   ```

3. Merge `main` back into `staging` and `develop` so the version bump and any release fixes are kept:

   ```powershell
   git switch staging
   git merge --no-ff main
   git push
   git switch develop
   git merge --no-ff main
   git push
   ```

## 4. Publish

1. Create a **draft** release for the tag, with the changelog section as its notes:

   ```powershell
   gh release create v0.3.0 --draft --verify-tag --title "OpenDock 0.3.0" --notes-file notes.md
   ```

2. Attach the installers. Either:
   - run the **Release build** workflow (`.github/workflows/release.yml`) with the tag as input. It builds on a clean Windows runner, runs the tests, and uploads the installers and `SHA256SUMS.txt` to the draft. This is preferred, because the build doesn't depend on a maintainer's machine; or
   - upload the files you built and tested locally: `gh release upload v0.3.0 (Get-ChildItem release -File).FullName`.
3. Download the setup file from the draft, check it against `SHA256SUMS.txt`, install it, and do a quick smoke test.
4. Publish the release. For a pre-release version (`-beta.1` and so on), mark it as a pre-release.

## 5. Announce

- Make sure the website deployed and that the download page points at the new version (see [website.md](website.md)).
- Close the milestone and move any open issues to the next one.
- Post a short announcement in GitHub Discussions.

## Hotfixes

For an urgent fix to the released version:

1. Branch from the tag: `git switch -c hotfix/0.3.1 v0.3.0`.
2. Fix the bug, add a test, and bump the patch version.
3. Follow steps 2 to 5, with the pull request going into `main`, then merge `main` back into `staging` and `develop`.

## Code signing

Installers aren't code-signed yet, so Windows SmartScreen warns users on first run. Signing is planned before 1.0. When it's added, the certificate will live only in GitHub Actions secrets and will be used only by the release workflow; it must never be committed or stored on a contributor's machine.
