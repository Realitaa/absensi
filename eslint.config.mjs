// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultAttributes } from 'eslint-plugin-better-tailwindcss/api/defaults'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default withNuxt(
  betterTailwindcss.configs['correctness-error'],
  {
    settings: {
      'better-tailwindcss': {
        entryPoint: 'app/assets/css/main.css',
        attributes: [
          ...getDefaultAttributes(),
          ['^v-bind:ui$', [{ match: 'objectValues' }]]
        ]
      }
    }
  },
  // Last: turn off Nuxt stylistic rules that conflict with Prettier.
  // Formatting is now owned by Prettier (see "format" script and prettier.config.mjs).
  // The better-tailwindcss correctness rules above stay enabled.
  eslintConfigPrettier
)
