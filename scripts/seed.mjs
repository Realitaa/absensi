/**
 * Seed a D1 database using Wrangler's platform proxy.
 *
 * Usage:
 *   pnpm db:seed         # local D1 persistence
 *   pnpm db:seed:remote  # remote D1 configured in wrangler.remote.jsonc
 *
 * Remote seeding is intentionally opt-in because it writes application data
 * to the configured Cloudflare D1 database.
 */
import { getPlatformProxy } from 'wrangler'
import { register } from 'tsx/esm/api'

register()

const remote = process.argv.includes('--remote')
const configPath = remote ? 'wrangler.remote.jsonc' : 'wrangler.jsonc'

const { env, dispose } = await getPlatformProxy({
  configPath,
  remoteBindings: remote
})

try {
  const d1 = env.DB
  if (!d1) {
    console.error(
      `D1 binding "DB" not found. Run ` +
        `${remote ? '`pnpm db:migrate:remote`' : '`pnpm db:migrate`'} first.`
    )
    process.exitCode = 1
  } else {
    const { seedDatabase } = await import('../server/db/seed.ts')
    await seedDatabase(d1)
    console.log(`${remote ? 'Remote' : 'Local'} seed complete.`)
  }
} finally {
  await dispose()
}
