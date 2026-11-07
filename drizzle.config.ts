import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema',
  out: './drizzle',
  verbose: true,
  strict: true
})
