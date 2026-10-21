module.exports = {
  ci: {
    collect: {
      staticDistDir: "./dist",
      url: [
        "/",
        "/widgets/",
        "/docs/",
        "/pricing/",
      ],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["warn", { minScore: 0.92 }],
        "categories:seo": ["error", { minScore: 0.95 }],
      },
    },
  },
};
