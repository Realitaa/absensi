/**
 * Real D1 database for feature tests via Miniflare (`getPlatformProxy`).
 *
 * No manual SQL copy: Miniflare applies `drizzle/*.sql` migrations
 * through `drizzle-orm/d1/migrator` reading `drizzle/meta/_journal.json`
 * (single source of truth — drizzle generated files). Adding a new
 * drizzle migration requires zero test changes.
 *
 * Isolation: each worker gets its own throwaway persist dir in the OS
 * temp dir (never `.wrangler/state`, never touches remote D1),
 * deleted on `closeApiDb()`. `clearUsers()` isolates tests.
 *
 * Runs in the plain `node` vitest project (`server` in
 * `vitest.config.ts`) — no Nuxt runtime, no happy-dom.
 */

import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AnyD1Database } from 'drizzle-orm/d1'
import { migrate } from 'drizzle-orm/d1/migrator'
import { createDb, type Db } from '../../../server/db/index'
import { users } from '../../../server/db/schema/users'

export type { Db }

// import.meta.url is broken under @nuxt/test-utils transform
// (non-file URL), so resolve from cwd instead.
const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle')
const WRANGLER_CONFIG_PATH = resolve(process.cwd(), 'wrangler.jsonc')

let dbPromise: Promise<{
  db: Db
  d1: AnyD1Database
  proxy: { dispose: () => Promise<void> }
  persistDir: string
}> | null = null

async function openDb() {
  const { getPlatformProxy } = await import('wrangler')
  const persistDir = join(
    tmpdir(),
    `absensi-d1-test-${process.pid}-${Math.random().toString(36).slice(2)}`
  )
  const proxy = await getPlatformProxy({
    configPath: WRANGLER_CONFIG_PATH,
    persist: { path: persistDir }
  })
  const d1 = proxy.env.DB as AnyD1Database
  if (!d1) throw new Error('D1 binding "DB" not found in test env')
  const db = createDb(d1)
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return { db, d1, proxy, persistDir }
}

/**
 * Open (once per test worker) the Miniflare-backed real D1 with the full
 * production schema applied, and return a Drizzle `Db` over it.
 */
export async function createApiDb(): Promise<Db> {
  dbPromise ??= openDb()
  const opened = await dbPromise
  return opened.db
}

/** Real D1 binding for injection into `event.context.cloudflare.env`. */
async function getD1(): Promise<AnyD1Database> {
  dbPromise ??= openDb()
  const opened = await dbPromise
  return opened.d1
}

/** Real R2 buckets for injection into `event.context.cloudflare.env`. */
export async function createApiBuckets() {
  dbPromise ??= openDb()
  const opened = (await dbPromise) as unknown as {
    proxy: { env: Record<string, unknown> }
  }
  const env = opened.proxy.env
  const buckets = {
    PHOTOS: env.PHOTOS as R2Bucket | undefined,
    DB: env.DB as AnyD1Database | undefined
  }
  if (!buckets.PHOTOS)
    throw new Error('R2 binding "PHOTOS" not found in test env')
  return buckets
}

export async function clearPhotoUploads(db: Db) {
  const { photoUploads } =
    await import('../../../server/db/schema/photo_uploads')
  await db.delete(photoUploads)
}

export async function createMultipartEvent(input: {
  path: string
  fieldName: string
  fileName: string
  fileType: string
  fileBytes: Uint8Array
  contentTypeOverride?: string
}) {
  const d1 = await getD1()
  const buckets = await createApiBuckets()
  const boundary = `----AbsensiTestBoundary${Math.random().toString(36).slice(2)}`
  const encoder = new TextEncoder()
  const prefix = encoder.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${input.fieldName}"; filename="${input.fileName}"\r\n` +
      `Content-Type: ${input.fileType}\r\n\r\n`
  )
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`)
  const merged = new Uint8Array(
    prefix.length + input.fileBytes.length + suffix.length
  )
  merged.set(prefix, 0)
  merged.set(input.fileBytes, prefix.length)
  merged.set(suffix, prefix.length + input.fileBytes.length)
  const body = Buffer.from(merged)
  const contentType =
    input.contentTypeOverride ?? `multipart/form-data; boundary=${boundary}`
  const headers: Record<string, string> = {
    'content-type': contentType,
    'content-length': String(body.length)
  }
  const req: Record<string, unknown> = {
    method: 'POST',
    url: input.path,
    headers,
    body,
    rawBody: body
  }
  const res = {
    statusCode: 200,
    headers: new Headers(),
    setHeader(name: string, value: string | string[]) {
      if (value)
        this.headers.set(
          name,
          (Array.isArray(value) ? value : [value]).join(', ')
        )
    },
    getHeader(name: string) {
      return this.headers.get(name) ?? undefined
    },
    getHeaders() {
      return Object.fromEntries(this.headers.entries())
    }
  }
  const request = new Request('http://localhost' + input.path, {
    method: 'POST',
    headers,
    body: new Uint8Array(body)
  })
  const event: Record<string, unknown> = {
    _method: 'POST',
    _path: input.path,
    path: input.path,
    method: 'POST',
    node: { req, res },
    context: { cloudflare: { env: { DB: d1, PHOTOS: buckets.PHOTOS } } },
    request,
    web: { request }
  }
  return event as never
}

export async function clearUsers(db: Db) {
  await db.delete(users)
}

export async function insertUser(
  db: Db,
  values: {
    name: string
    username: string
    password: string
    role: 'admin' | 'lecturer' | 'student'
    nim?: string | null
    deletedAt?: Date | null
  }
): Promise<number> {
  const now = new Date()
  const [row] = await db
    .insert(users)
    .values({
      name: values.name,
      username: values.username,
      password: values.password,
      role: values.role,
      nim: values.nim ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: values.deletedAt ?? null
    })
    .returning({ id: users.id })
  return row!.id
}

/**
 * Build an h3-compatible event the way Nitro would provide it:
 *  - `event.node.req` carries method/url/headers + raw JSON body
 *    (h3 `readBody()` reads `event.node.req.body` via `readRawBody`)
 *  - `event.context.cloudflare.env.DB` carries the real D1 binding
 *    (`getDb()` reads `event.context.cloudflare.env.DB`)
 *  - `event.node.res` is a minimal Node-like response placeholder
 *    (h3 `useSession()` writes `set-cookie` on it)
 */
export async function createApiEvent(body: unknown, path: string) {
  const d1 = await getD1()
  const jsonBody = JSON.stringify(body)
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(jsonBody))
  }
  const req: Record<string, unknown> = {
    method: 'POST',
    url: path,
    headers,
    body: jsonBody
  }
  const setCookieHeaders: string[] = []
  const res = {
    statusCode: 200,
    headers: new Headers(),
    setHeader(name: string, value: string | string[]) {
      if (name.toLowerCase() === 'set-cookie') {
        setCookieHeaders.push(...(Array.isArray(value) ? value : [value]))
      }
      if (value)
        this.headers.set(
          name,
          (Array.isArray(value) ? value : [value]).join(', ')
        )
    },
    getHeader(name: string) {
      return this.headers.get(name) ?? undefined
    },
    getHeaders() {
      return Object.fromEntries(this.headers.entries())
    }
  }
  const event: Record<string, unknown> = {
    _method: 'POST',
    _path: path,
    path,
    method: 'POST',
    node: { req, res },
    context: { cloudflare: { env: { DB: d1 } } },
    request: new Request('http://localhost' + path, {
      method: 'POST',
      headers,
      body: jsonBody
    })
  }
  return event as never
}

export async function closeApiDb() {
  if (!dbPromise) return
  const p = dbPromise
  dbPromise = null
  try {
    const opened = await p
    await opened.proxy.dispose()
    await rm(opened.persistDir, { recursive: true, force: true })
  } catch {
    // best effort
  }
}
