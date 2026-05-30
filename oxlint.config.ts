import { defineConfig } from "oxlint"

export default defineConfig({
  categories: {
    correctness: "error",
    suspicious: "warn",
    perf: "warn",
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "no-underscore-dangle": "off",
  },
  plugins: [
    "eslint",
    "typescript",
    "unicorn",
    "oxc",
    "react",
    "react-perf",
    "import",
    "jsx-a11y",
    "promise",
    "vitest",
  ],
})
