const coreDapps = require("@dcl/eslint-config/core-dapps.config");

module.exports = [
  ...coreDapps,
  {
    ignores: ["scripts/**", "vite.config.ts", "eslint.config.cjs", "prettier.config.cjs"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.app.json",
      },
    },
  },
];
