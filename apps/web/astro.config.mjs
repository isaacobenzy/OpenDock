import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://opendock.pages.dev",
  output: "static",
  trailingSlash: "always",
  compressHTML: true,
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    build: {
      // Keep every script in its own file so the Content-Security-Policy can forbid inline scripts.
      assetsInlineLimit: 0,
    },
  },
});
