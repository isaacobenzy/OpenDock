export type NavLink = {
  label: string;
  href: string;
  description?: string;
};

export type NavGroup = {
  label: string;
  links: NavLink[];
};

export const primaryNav: NavGroup[] = [
  {
    label: "Product",
    links: [
      { label: "Overview", href: "/", description: "OpenDock at a glance" },
      { label: "Widgets", href: "/widgets/", description: "Built-in and community widgets" },
      { label: "Pricing", href: "/pricing/", description: "Free and open source" },
    ],
  },
  {
    label: "Community",
    links: [
      { label: "Showcase", href: "/showcase/", description: "Layouts from the community" },
      { label: "Feedback", href: "/feedback/", description: "Request features and report issues" },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Docs", href: "/docs/", description: "Install, configure, and develop" },
    ],
  },
];

export const moreNav: NavLink[] = [
  { label: "Changelog", href: "/changelog/", description: "Release history" },
  { label: "Roadmap", href: "/roadmap/", description: "What we are building next" },
  { label: "GitHub", href: "https://github.com/isaacobenzy/OpenDock", description: "Source code" },
  { label: "Contributing", href: "/docs/#contribute", description: "Help build OpenDock" },
];

export const footerNav: NavGroup[] = [
  {
    label: "Product",
    links: [
      { label: "Overview", href: "/" },
      { label: "Widgets", href: "/widgets/" },
      { label: "Pricing", href: "/pricing/" },
    ],
  },
  {
    label: "Community",
    links: [
      { label: "Showcase", href: "/showcase/" },
      { label: "Feedback", href: "/feedback/" },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Docs", href: "/docs/" },
      { label: "Changelog", href: "/changelog/" },
      { label: "Roadmap", href: "/roadmap/" },
    ],
  },
];
