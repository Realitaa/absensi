import type { Db } from '../db/index'
import type { PhotoUpload } from '../db/schema/photo_uploads'
import {
  insertPhotoUpload,
  findPhotoUploadByPath
} from '../repositories/photo-upload.repository'
import {
  detectImageType,
  getSelfieUploadConfig,
  type SelfieUploadConfig
} from '../utils/image-validation'
import {
  generatePhotoPath,
  storageError,
  type PhotoStorage
} from '../utils/storage'
import {
  AppError,
  conflict,
  internalError,
  validationError
} from '../utils/app-error'
import { ErrorCodes } from '../../shared/error-codes'
import type { AuthenticatedUser } from './auth.service'

export interface UploadedSelfieFile {
  bytes: Uint8Array
  filename?: string
  mimeType?: string
}

export interface UploadSelfieInput {
  file: UploadedSelfieFile | null | undefined
}

export interface SelfieUploadDto {
  id: number
  userId: number
  photoPath: string
  status: 'pending'
  uploadedAt: string
  consumedAt: null
  attendanceId: null
}

export interface SelfieUploadDeps {
  storage: PhotoStorage
  config?: SelfieUploadConfig
  now?: Date
  randomUUID?: () => string
}

export interface UploadContext {
  actor: AuthenticatedUser
  file: UploadedSelfieFile
}

/** Student-only is enforced by the API layer (`requireRole(event, 'student')`). */
function assertStudent(actor: AuthenticatedUser) {
  if (actor.role !== 'student') {
    throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Forbidden')
  }
}

export async function uploadSelfie(
  db: Db,
  context: UploadContext,
  deps: SelfieUploadDeps
): Promise<SelfieUploadDto> {
  assertStudent(context.actor)
  const { file, actor } = context
  const config = deps.config ?? getSelfieUploadConfig()

  if (!file || file.bytes.length === 0) {
    throw validationError('Selfie file is required', {
      file: ['Please upload a selfie photo.']
    })
  }
  if (file.bytes.length > config.maxBytes) {
    throw validationError('Selfie file is too large', {
      file: [`File size must be no larger than ${config.maxBytes} bytes.`]
    })
  }

  const detected = detectImageType(file.bytes, config)
  if (!detected) {
    throw validationError('Unsupported or invalid image file', {
      file: ['Only supported image files are accepted.']
    })
  }

  const now = deps.now ?? new Date()
  const photoPath = generatePhotoPath(
    actor.id,
    detected.extension,
    deps.randomUUID?.()
  )

  if (await findPhotoUploadByPath(db, photoPath)) {
    throw conflict('CONFLICT', 'A selfie upload with this path already exists')
  }

  async function cleanupOrphan() {
    try {
      await deps.storage.delete(photoPath)
    } catch (cleanupError) {
      console.error('Failed to clean up orphaned selfie object', cleanupError)
    }
  }

  try {
    try {
      await deps.storage.put(photoPath, file.bytes, {
        contentType: detected.mime
      })
    } catch {
      throw storageError()
    }

    let record: PhotoUpload | null
    try {
      record = await insertPhotoUpload(db, {
        userId: actor.id,
        photoPath,
        status: 'pending',
        uploadedAt: now,
        consumedAt: null,
        attendanceId: null
      })
    } catch (error) {
      // R2 and D1 do not share a transaction — remove the orphan object.
      await cleanupOrphan()
      if (error instanceof Error && /unique constraint/i.test(error.message)) {
        throw storageError()
      }
      throw internalError()
    }

    if (!record) {
      await cleanupOrphan()
      throw internalError()
    }

    const verified = await deps.storage.head(photoPath)
    if (!verified) {
      try {
        await deps.storage.delete(photoPath)
      } catch {
        // Best effort; the upload is still reported as unavailable.
      }
      throw storageError()
    }

    return {
      id: record.id,
      userId: record.userId,
      photoPath: record.photoPath,
      status: 'pending',
      uploadedAt: record.uploadedAt.toISOString(),
      consumedAt: null,
      attendanceId: null
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw internalError()
  }
}
