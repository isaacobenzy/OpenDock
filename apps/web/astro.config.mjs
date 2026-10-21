import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://opendock.pages.dev",
  output: "static",
  compressHTML: true,
  build: {
    inlineStylesheets: "auto",
  },
});
