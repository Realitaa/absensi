import type { AnyD1Database } from 'drizzle-orm/d1'
import { createDb, type Db } from '../db/index'

type DbEvent = {
  cloudflare?: { env?: { DB?: AnyD1Database } }
  context: { db?: Db }
}

export function getDb(event: DbEvent): Db {
  if (event.context.db) return event.context.db
  const d1 = event.cloudflare?.env?.DB
  if (!d1) throw new Error('D1 database binding "DB" is not available')
  const db = createDb(d1)
  event.context.db = db
  return db
}
