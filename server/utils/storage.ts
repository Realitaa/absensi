import { internalError, AppError } from './app-error'
import { ErrorCodes } from '../../shared/error-codes'

type R2BucketLike = {
  put: (
    key: string,
    value: ArrayBuffer,
    options: {
      httpMetadata: { contentType: string }
      onlyIf: { etagDoesNotMatch: '*' }
    }
  ) => Promise<unknown>
  delete: (key: string) => Promise<void>
  head: (
    key: string
  ) => Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>
  get: (key: string) => Promise<{
    arrayBuffer: () => Promise<ArrayBuffer>
    httpMetadata?: { contentType?: string }
  } | null>
}

/**
 * Private storage abstraction (FR-UPLOAD-03).
 *
 * Production uses the R2 `PHOTOS` binding. The service depends only on this
 * narrow interface so tests can inject an isolated in-memory bucket.
 */

export interface PhotoStorage {
  put(
    key: string,
    body: Uint8Array,
    options: { contentType: string }
  ): Promise<void>
  delete(key: string): Promise<void>
  head(key: string): Promise<{ size: number; contentType?: string } | null>
  get(key: string): Promise<{ body: Uint8Array; contentType?: string } | null>
  getPublicUrl?(key: string): string | null
}

type CloudflareEnv = {
  PHOTOS?: R2BucketLike
  DB?: unknown
  [key: string]: unknown
}

type StorageEvent = {
  context: {
    cloudflare?: { env?: CloudflareEnv }
    photostorage?: PhotoStorage
    storage?: PhotoStorage
  }
}

class R2PhotoStorage implements PhotoStorage {
  constructor(private bucket: R2BucketLike) {}

  async put(
    key: string,
    body: Uint8Array,
    options: { contentType: string }
  ): Promise<void> {
    await this.bucket.put(
      key,
      body.buffer.slice(
        body.byteOffset,
        body.byteOffset + body.byteLength
      ) as ArrayBuffer,
      {
        httpMetadata: { contentType: options.contentType },
        onlyIf: { etagDoesNotMatch: '*' }
      }
    )
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key)
  }

  async head(key: string) {
    const object = await this.bucket.head(key)
    if (!object) return null
    return { size: object.size, contentType: object.httpMetadata?.contentType }
  }

  async get(key: string) {
    const object = await this.bucket.get(key)
    if (!object) return null
    const body = new Uint8Array(await object.arrayBuffer())
    return {
      body,
      contentType: object.httpMetadata?.contentType
    }
  }

  getPublicUrl(): string | null {
    return null
  }
}

export function getPhotoStorage(event: StorageEvent): PhotoStorage {
  const injected = event.context.photostorage ?? event.context.storage
  if (injected) return injected

  const bucket = event.context.cloudflare?.env?.PHOTOS
  if (!bucket) {
    console.error('R2 bucket binding "PHOTOS" is not available')
    throw internalError()
  }
  return new R2PhotoStorage(bucket)
}

export function storageError(): AppError {
  return new AppError(
    ErrorCodes.STORAGE_ERROR,
    503,
    'Photo storage is unavailable'
  )
}

export function generatePhotoPath(
  userId: number,
  extension: string,
  id: string = crypto.randomUUID()
): string {
  if (
    !/^[a-z0-9]+$/i.test(extension) ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    throw internalError()
  }
  if (!/^[\da-f-]+$/i.test(id)) throw internalError()
  return `selfies/${userId}/${id}.${extension}`
}

export function isSafePhotoPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^selfies\/\d+\/[\da-f-]+\.[a-z0-9]+$/i.test(value)
}
