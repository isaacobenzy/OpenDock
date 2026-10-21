# Deploy OpenDock marketing site to Cloudflare Pages

The static site lives in `apps/web` (Astro, `output: "static"`). Production URL: **https://opendock.pages.dev** (after Git deploy).

## GitHub → Cloudflare (recommended)

The Cloudflare Pages project **`opendock`** is created on account `784d1d98594f9536a96697f4f959dbd6`.

1. Repository: [github.com/isaacobenzy/OpenDock](https://github.com/isaacobenzy/OpenDock) on branch `main`.
2. Cloudflare Pages project **`opendock`** is connected to that repo (GitHub integration).
3. Build settings (already applied via API; verify in the dashboard if needed):

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` (repository root) |
| Build command | `corepack enable && corepack prepare pnpm@10.34.4 --activate && pnpm install --frozen-lockfile && pnpm build:web` |
| Build output directory | `apps/web/dist` |
| Environment variable | `NODE_VERSION` = `22` |

Each push to `main` triggers a production deployment. Pull requests can receive preview URLs when enabled.

## Local preview

```powershell
pnpm install
pnpm dev:web
pnpm build:web
pnpm lighthouse:web
```

## Custom domain

In the Cloudflare dashboard, open **Workers & Pages → opendock → Custom domains** and attach your domain. Update `site` in `apps/web/astro.config.mjs` to match.

## Quality gate

```powershell
pnpm lighthouse:web
```

Accessibility and SEO categories must stay ≥ 0.95 per `lighthouserc.cjs`.
