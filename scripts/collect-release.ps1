<#
.SYNOPSIS
  Collects the Windows installers from a release build and writes SHA256SUMS.txt.

.DESCRIPTION
  Run after `pnpm bundle:desktop`. Copies the NSIS (.exe) and MSI installers for
  the version in tauri.conf.json into -OutDir and writes checksums next to them.
  Used both by maintainers building locally and by the Release build workflow.
#>
[CmdletBinding()]
param(
  [string]$OutDir = "release"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$tauriDir = Join-Path $root "apps/desktop/src-tauri"

$config = Get-Content (Join-Path $tauriDir "tauri.conf.json") -Raw | ConvertFrom-Json
$version = $config.version

$metadata = cargo metadata --format-version 1 --no-deps --manifest-path (Join-Path $tauriDir "Cargo.toml") | ConvertFrom-Json
$bundleDir = Join-Path $metadata.target_directory "release/bundle"
if (-not (Test-Path $bundleDir)) {
  throw "No bundle output at $bundleDir. Run 'pnpm bundle:desktop' first."
}

$installers = @(
  Get-ChildItem (Join-Path $bundleDir "nsis") -Filter "*_${version}_*-setup.exe" -ErrorAction SilentlyContinue
  Get-ChildItem (Join-Path $bundleDir "msi") -Filter "*_${version}_*.msi" -ErrorAction SilentlyContinue
)
if ($installers.Count -lt 2) {
  throw "Expected an NSIS and an MSI installer for version $version in $bundleDir, found $($installers.Count)."
}

$out = if ([System.IO.Path]::IsPathRooted($OutDir)) { $OutDir } else { Join-Path $root $OutDir }
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

$lines = foreach ($file in $installers) {
  Copy-Item $file.FullName -Destination $out
  $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $($file.Name)"
}
# LF line endings so `sha256sum -c` works on any platform.
[System.IO.File]::WriteAllText((Join-Path $out "SHA256SUMS.txt"), (($lines -join "`n") + "`n"))

Get-ChildItem $out | Format-Table Name, @{ Name = "Size (MB)"; Expression = { [math]::Round($_.Length / 1MB, 2) } } -AutoSize
