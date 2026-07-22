import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Product images can be user-controlled remote assets, data URLs, signed artifact URLs,
      // and source-preserving static marks; they are not compatible with Next's image optimizer.
      "@next/next/no-img-element": "off"
    }
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "src/generated/**",
    "artifacts/**",
    "cache/**",
    "contracts/artifacts/**",
    "contracts/cache/**",
    "docs/**"
  ])
]);
