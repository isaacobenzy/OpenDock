import { repoLinks, site } from "./site";

export type NavLink = {
  label: string;
  href: string;
};

export type NavGroup = {
  label: string;
  links: NavLink[];
};

export const primaryNav: NavLink[] = [
  { label: "Features", href: "/#features" },
  { label: "Widgets", href: "/widgets/" },
  { label: "Docs", href: "/docs/" },
  { label: "Roadmap", href: "/roadmap/" },
  { label: "Changelog", href: "/changelog/" },
];

export const footerNav: NavGroup[] = [
  {
    label: "Product",
    links: [
      { label: "Download", href: "/download/" },
      { label: "Widgets", href: "/widgets/" },
      { label: "Example layouts", href: "/showcase/" },
      { label: "Pricing", href: "/pricing/" },
    ],
  },
  {
    label: "Project",
    links: [
      { label: "Roadmap", href: "/roadmap/" },
      { label: "Changelog", href: "/changelog/" },
      { label: "Feedback", href: "/feedback/" },
      { label: "Source code", href: site.repo },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Documentation", href: "/docs/" },
      { label: "Contributing", href: repoLinks.contributing },
      { label: "Privacy", href: "/privacy/" },
      { label: "Report a vulnerability", href: repoLinks.security },
    ],
  },
];

export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

export function isCurrent(href: string, pathname: string): boolean {
  if (href.includes("#")) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
