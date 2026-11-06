/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
  // Matches .editorconfig (indent_size=2, indent_style=space, end_of_line=lf)
  tabWidth: 2,
  useTabs: false,
  endOfLine: 'lf',

  // Matches the Nuxt ESLint stylistic defaults (commaDangle: 'never', braceStyle: '1tbs',
  // @stylistic: semi: false, quotes: 'single', arrowParens: 'as-needed')
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  bracketSpacing: true,
  arrowParens: 'avoid',
  quoteProps: 'as-needed',
  printWidth: 80,

  plugins: ['prettier-plugin-tailwindcss'],
  // Tailwind CSS v4: point the sorting plugin at the CSS entry point
  // (same entryPoint used by eslint-plugin-better-tailwindcss in eslint.config.mjs)
  tailwindStylesheet: './app/assets/css/main.css'
}
