import type { AnyD1Database } from 'drizzle-orm/d1'
import { createDb, type Db } from '../db/index'
import { internalError } from './app-error'

type DbEvent = {
  context: {
    db?: Db
    cloudflare?: { env?: { DB?: AnyD1Database } }
  }
}

export function getDb(event: DbEvent): Db {
  if (event.context.db) return event.context.db
  const d1 = event.context.cloudflare?.env?.DB
  if (!d1) {
    console.error('D1 database binding "DB" is not available')
    throw internalError()
  }
  const db = createDb(d1)
  event.context.db = db
  return db
}
