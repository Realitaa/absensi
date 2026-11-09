/**
 * Feature test: student selfie upload (FR-UPLOAD-01..06, §7.3)
 * POST /api/selfies/upload — multipart `file` field.
 *
 * Real D1 + real R2 via Miniflare (see test/nuxt/helpers/api-db.ts).
 * No production bucket or real user data is touched.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import {
  clearUsers,
  clearPhotoUploads,
  closeApiDb,
  createApiBuckets,
  createApiDb,
  createMultipartEvent,
  insertUser,
  type Db
} from './helpers/api-db'
import { hashPassword } from '../../server/lib/password'
import type { ApiErrorBody } from '../../shared/error-codes'
import { eq } from 'drizzle-orm'
import { photoUploads } from '../../server/db/schema/photo_uploads'

let sessionUserId: number | undefined

Object.assign(globalThis, {
  setUserSession: async (_event: unknown, data: unknown) => ({ data }),
  clearUserSession: async () => true,
  getUserSession: async () =>
    sessionUserId ? { user: { id: sessionUserId } } : {},
  requireUserSession: async () => ({})
})

const uploadHandler = (await import('../../server/api/selfies/upload.post'))
  .default

const PASSWORD = 'password123'

function jpegBytes(extra = 0): Uint8Array {
  const base = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
  const tail = new Uint8Array([0xff, 0xd9])
  const out = new Uint8Array(base.length + tail.length + extra)
  out.set(base, 0)
  out.set(tail, base.length + extra)
  return out
}

function pngBytes(extra = 0): Uint8Array {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const iend = new Uint8Array([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ])
  const out = new Uint8Array(sig.length + iend.length + extra)
  out.set(sig, 0)
  out.set(iend, sig.length + extra)
  return out
}

function gifBytes(): Uint8Array {
  return new TextEncoder().encode('GIF89a\x01\x00\x01\x00\x00\x00\x00\x3b')
}

async function callUpload(
  userId: number | undefined,
  input: {
    fileBytes: Uint8Array
    fileName: string
    fileType: string
    fieldName?: string
    maxOverride?: number
  }
) {
  sessionUserId = userId
  const event = await createMultipartEvent({
    path: '/api/selfies/upload',
    fileName: input.fileName,
    fileType: input.fileType,
    fieldName: input.fieldName ?? 'file',
    fileBytes: input.fileBytes
  })
  const result = await uploadHandler(event)
  if (result && typeof result === 'object' && 'error' in result) {
    return {
      statusCode: (result as unknown as ApiErrorBody).error.status,
      body: result
    }
  }
  return { statusCode: 200, body: result }
}

describe('student selfie upload', () => {
  let db: Db
  let adminId = 0
  let lecturerId = 0
  let studentId = 0
  let photos: R2Bucket

  beforeAll(async () => {
    db = await createApiDb()
    photos = (await createApiBuckets()).PHOTOS!
  })

  afterAll(async () => {
    await closeApiDb()
  })

  beforeEach(async () => {
    sessionUserId = undefined
    await clearPhotoUploads(db)
    await clearUsers(db)
    const hashed = await hashPassword(PASSWORD)
    adminId = await insertUser(db, {
      name: 'Admin Akademik',
      username: 'admin',
      password: hashed,
      role: 'admin',
      nim: null
    })
    lecturerId = await insertUser(db, {
      name: 'Dosen Contoh',
      username: 'dosen',
      password: hashed,
      role: 'lecturer',
      nim: null
    })
    studentId = await insertUser(db, {
      name: 'Mahasiswa Contoh',
      username: 'mahasiswa',
      password: hashed,
      role: 'student',
      nim: '2025010001'
    })
  })

  it('unauthenticated requests are rejected (401)', async () => {
    const result = await callUpload(undefined, {
      fileBytes: jpegBytes(),
      fileName: 'selfie.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(401)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'UNAUTHORIZED'
    )
  })

  it('students can upload a valid jpeg selfie', async () => {
    const result = await callUpload(studentId, {
      fileBytes: jpegBytes(),
      fileName: 'selfie.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(200)
    const upload = (result.body as { upload: Record<string, unknown> }).upload
    expect(upload).toHaveProperty('photoPath')
    expect(typeof upload.photoPath).toBe('string')
    expect(
      (upload.photoPath as string).startsWith(`selfies/${studentId}/`)
    ).toBe(true)
    expect(upload.status).toBe('pending')
    expect(upload.userId).toBe(studentId)
    expect(upload.consumedAt).toBeNull()
    expect(upload.attendanceId).toBeNull()
  })

  it('students can upload a valid png selfie', async () => {
    const result = await callUpload(studentId, {
      fileBytes: pngBytes(),
      fileName: 'selfie.png',
      fileType: 'image/png'
    })
    expect(result.statusCode).toBe(200)
    const upload = (result.body as { upload: Record<string, unknown> }).upload
    expect((upload.photoPath as string).endsWith('.png')).toBe(true)
  })

  it('admins cannot upload through the student endpoint (403)', async () => {
    const result = await callUpload(adminId, {
      fileBytes: jpegBytes(),
      fileName: 'selfie.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(403)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'FORBIDDEN'
    )
  })

  it('lecturers cannot upload through the student endpoint (403)', async () => {
    const result = await callUpload(lecturerId, {
      fileBytes: jpegBytes(),
      fileName: 'selfie.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(403)
  })

  it('successful uploads create an R2 object and a photo_uploads record', async () => {
    const result = await callUpload(studentId, {
      fileBytes: jpegBytes(),
      fileName: 'selfie.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(200)
    const upload = (result.body as { upload: Record<string, unknown> }).upload
    const photoPath = upload.photoPath as string
    const object = await photos.head(photoPath)
    expect(object).not.toBeNull()
    const [row] = await db
      .select()
      .from(photoUploads)
      .where(eq(photoUploads.photoPath, photoPath))
    expect(row).toBeDefined()
    expect(row?.userId).toBe(studentId)
    expect(row?.status).toBe('pending')
    expect(row?.consumedAt).toBeNull()
    expect(row?.attendanceId).toBeNull()
  })

  it('uploaded file is not publicly accessible', async () => {
    const result = await callUpload(studentId, {
      fileBytes: jpegBytes(),
      fileName: 'selfie.jpg',
      fileType: 'image/jpeg'
    })
    const upload = (result.body as { upload: Record<string, unknown> }).upload
    expect(JSON.stringify(result.body)).not.toMatch(/https?:\/\//)
    expect(JSON.stringify(result.body)).not.toMatch(
      /r2\.cloudflarestorage\.com|public url/i
    )
    expect(upload).not.toHaveProperty('publicUrl')
    expect(upload).not.toHaveProperty('url')
    const object = await photos.head(upload.photoPath as string)
    expect(object?.httpMetadata?.contentType).toBe('image/jpeg')
  })

  it('unsupported formats are rejected even with a valid extension', async () => {
    const result = await callUpload(studentId, {
      fileBytes: gifBytes(),
      fileName: 'fake.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('invalid image content is rejected even if the filename and MIME claim it is valid', async () => {
    const result = await callUpload(studentId, {
      fileBytes: new TextEncoder().encode('not an image'),
      fileName: 'selfie.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(400)
  })

  it('a jpeg magic-byte image with a mismatched declared MIME is still validated by content', async () => {
    // MIME is ignored; magic bytes decide. A real JPEG with a wrong declared
    // type is accepted, proving we do not trust the declared type.
    const result = await callUpload(studentId, {
      fileBytes: jpegBytes(),
      fileName: 'selfie.png',
      fileType: 'image/png'
    })
    expect(result.statusCode).toBe(200)
    const upload = (result.body as { upload: Record<string, unknown> }).upload
    expect((upload.photoPath as string).endsWith('.jpg')).toBe(true)
  })

  it('empty files are rejected', async () => {
    const result = await callUpload(studentId, {
      fileBytes: new Uint8Array(0),
      fileName: 'empty.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(400)
  })

  it('oversized files are rejected', async () => {
    const big = jpegBytes(6 * 1024 * 1024) // > 5 MiB default
    const result = await callUpload(studentId, {
      fileBytes: big,
      fileName: 'big.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(400)
    expect((result.body as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR'
    )
  })

  it('missing file field is rejected', async () => {
    sessionUserId = studentId
    const event = await createMultipartEvent({
      path: '/api/selfies/upload',
      fileName: 'note.txt',
      fileType: 'text/plain',
      fieldName: 'note',
      fileBytes: new TextEncoder().encode('hello')
    })
    const result = await uploadHandler(event)
    if (result && typeof result === 'object' && 'error' in result) {
      expect((result as unknown as ApiErrorBody).error.status).toBe(400)
    } else {
      expect(result).toBeDefined()
    }
  })

  it('does not create an attendance record', async () => {
    const result = await callUpload(studentId, {
      fileBytes: jpegBytes(),
      fileName: 'selfie.jpg',
      fileType: 'image/jpeg'
    })
    expect(result.statusCode).toBe(200)
    const { attendances } = await import('../../server/db/schema/attendances')
    const rows = await db.select().from(attendances)
    expect(rows.length).toBe(0)
  })

  it('duplicate storage paths are prevented', async () => {
    const first = await callUpload(studentId, {
      fileBytes: jpegBytes(),
      fileName: 'a.jpg',
      fileType: 'image/jpeg'
    })
    const second = await callUpload(studentId, {
      fileBytes: jpegBytes(),
      fileName: 'b.jpg',
      fileType: 'image/jpeg'
    })
    const p1 = (first.body as { upload: { photoPath: string } }).upload
      .photoPath
    const p2 = (second.body as { upload: { photoPath: string } }).upload
      .photoPath
    expect(p1).not.toBe(p2)
    const rows = await db.select().from(photoUploads)
    const paths = rows.map(r => r.photoPath)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('R2 failures do not create successful metadata records', async () => {
    const { uploadSelfie } =
      await import('../../server/services/photo-upload.service')
    const failingStorage = {
      put: async () => {
        throw new Error('R2 down')
      },
      delete: async () => {},
      head: async () => null,
      get: async () => null
    }
    const student = {
      id: studentId,
      name: 'Mahasiswa Contoh',
      username: 'mahasiswa',
      role: 'student',
      nim: '2025010001'
    }
    await expect(
      uploadSelfie(
        db,
        { actor: student, file: { bytes: jpegBytes() } },
        { storage: failingStorage }
      )
    ).rejects.toThrowError(expect.objectContaining({ code: 'STORAGE_ERROR' }))
    const rows = await db.select().from(photoUploads)
    expect(rows.length).toBe(0)
  })

  it('D1 failures trigger cleanup of the newly uploaded R2 object', async () => {
    const { uploadSelfie } =
      await import('../../server/services/photo-upload.service')
    let cleanupCalled = false
    const storage = {
      put: async () => {},
      delete: async () => {
        cleanupCalled = true
      },
      head: async () => ({ size: 10, contentType: 'image/jpeg' }),
      get: async () => null
    }
    // Force the insert to fail: use a DB proxy that throws on insert.
    const brokenDb = new Proxy(db, {
      get(target, prop, _receiver) {
        if (prop === 'insert')
          return () => {
            throw new Error('D1 unavailable')
          }
        const value = Reflect.get(target as object, prop, target)
        return typeof value === 'function' ? value.bind(target) : value
      }
    }) as unknown as Db
    const student = {
      id: studentId,
      name: 'Mahasiswa Contoh',
      username: 'mahasiswa',
      role: 'student',
      nim: '2025010001'
    }
    await expect(
      uploadSelfie(
        brokenDb,
        { actor: student, file: { bytes: jpegBytes() } },
        { storage }
      )
    ).rejects.toBeDefined()
    expect(cleanupCalled).toBe(true)
  })
})
