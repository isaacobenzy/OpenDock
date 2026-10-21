import { site } from "./site";

export type ReleaseFile = {
  kind: "setup" | "msi";
  name: string;
  label: string;
  note: string;
};

export type Release = {
  version: string;
  tag: string;
  date: string;
  files: ReleaseFile[];
};

export const currentRelease: Release = {
  version: "0.2.0",
  tag: "v0.2.0",
  date: "2026-10-21",
  files: [
    {
      kind: "setup",
      name: "OpenDock_0.2.0_x64-setup.exe",
      label: "Installer (.exe)",
      note: "Recommended. Installs for your account, no admin rights needed.",
    },
    {
      kind: "msi",
      name: "OpenDock_0.2.0_x64_en-US.msi",
      label: "Windows Installer (.msi)",
      note: "For deployment with Group Policy, Intune or other management tools.",
    },
  ],
};

export function downloadUrl(release: Release, file: string): string {
  return `${site.repo}/releases/download/${release.tag}/${file}`;
}

export function releasePageUrl(release: Release): string {
  return `${site.repo}/releases/tag/${release.tag}`;
}

export const checksumsFile = "SHA256SUMS.txt";

export function formatReleaseDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
