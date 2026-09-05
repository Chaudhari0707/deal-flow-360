export default {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  tabWidth: 2,
  arrowParens: "always",
  // Markdown and CSS stay on EditorConfig until Bun's Windows worker serialization is reliable.
  ignorePatterns: ["**/*.md", "**/*.css"],
  sortTailwindcss: {
    stylesheet: "./src/app/globals.css",
    functions: ["cn", "clsx", "cva"],
  },
  sortPackageJson: {
    sortScripts: true,
  },
  sortImports: {
    customGroups: [
      { groupName: "react", elementNamePattern: ["react"] },
      { groupName: "next", elementNamePattern: ["next", "next/**"] },
    ],
    groups: [
      "side_effect",
      ["value-builtin", "type-builtin"],
      "react",
      { newlinesBetween: false },
      "next",
      { newlinesBetween: false },
      ["value-external", "type-external"],
      ["value-internal", "type-internal"],
      ["value-parent", "type-parent", "value-sibling", "type-sibling", "value-index", "type-index"],
      "style",
      "unknown",
    ],
  },
};
