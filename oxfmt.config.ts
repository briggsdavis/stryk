import { defineConfig } from "oxfmt"

export default defineConfig({
  semi: false,
  sortImports: { newlinesBetween: false },
  sortTailwindcss: { stylesheet: "src/index.css" },
  ignorePatterns: ["convex/_generated"],
})
