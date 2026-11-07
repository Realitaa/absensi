/**
 * Seed local D1 database using wrangler's getPlatformProxy.
 * Usage: pnpm db:seed
 * This only targets the LOCAL D1 database (wrangler's local persistence).
 * Never run against production.
 */
import { getPlatformProxy } from 'wrangler'
import { register } from 'tsx/esm/api'

register()

const { env } = await getPlatformProxy({
  configPath: 'wrangler.jsonc'
})

const d1 = env.DB
if (!d1) {
  console.error('D1 binding "DB" not found. Run `pnpm db:migrate` first.')
  process.exit(1)
}

const { seedDatabase } = await import('../server/db/seed.ts')
await seedDatabase(d1)
console.log('Seed complete.')
process.exit(0)
