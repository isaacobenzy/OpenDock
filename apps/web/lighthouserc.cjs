module.exports = {
  ci: {
    collect: {
      staticDistDir: "./dist",
      url: ["/", "/download/", "/widgets/", "/docs/", "/changelog/", "/privacy/"],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.95 }],
      },
    },
  },
};
