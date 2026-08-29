/** @type {import("prettier").Config} */
const config = {
  // Matches the style the repository already follows: double quotes,
  // semicolons and trailing commas.
  singleQuote: false,
  semi: true,
  trailingComma: "all",
  tabWidth: 2,
  // The repository quotes every key in an object that needs quotes anywhere,
  // for example the game component map in the router. Prettier's default
  // strips the ones that are not strictly required, and scripts/game-readiness-audit.mjs
  // reads that map with a regular expression that expects quotes.
  quoteProps: "consistent",
  // 95% of existing lines are under 105 characters, so this keeps reflow
  // noise down compared to the 80 default.
  printWidth: 100
};

module.exports = config;
