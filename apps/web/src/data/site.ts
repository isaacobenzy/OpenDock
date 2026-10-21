export const site = {
  name: "OpenDock",
  url: "https://opendock.pages.dev",
  repo: "https://github.com/isaacobenzy/OpenDock",
  tagline: "The Windows taskbar, rebuilt in the open",
  description:
    "OpenDock replaces the Windows taskbar with a dock of your apps, live window previews and widgets that act for you. No account, no telemetry, MIT licensed.",
} as const;

export const repoLinks = {
  issues: `${site.repo}/issues`,
  newBug: `${site.repo}/issues/new?template=bug_report.yml`,
  newFeature: `${site.repo}/issues/new?template=feature_request.yml`,
  newWidget: `${site.repo}/issues/new?template=widget_request.yml`,
  goodFirstIssues: `${site.repo}/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22`,
  discussions: `${site.repo}/discussions`,
  releases: `${site.repo}/releases`,
  security: `${site.repo}/security/advisories/new`,
  contributing: `${site.repo}/blob/main/CONTRIBUTING.md`,
  license: `${site.repo}/blob/main/LICENSE`,
  docs: (path: string) => `${site.repo}/blob/main/docs/${path}`,
} as const;
