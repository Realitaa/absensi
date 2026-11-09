import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { getPhotoStorage } from '../../utils/storage'
import { uploadSelfie } from '../../services/photo-upload.service'
import { apiHandler, AppError, validationError } from '../../utils/app-error'
import { ErrorCodes } from '../../../shared/error-codes'
import { readUploadFile } from '../../utils/multipart'

/**
 * POST /api/selfies/upload — authenticated student selfie upload (FR-UPLOAD-01..06).
 *
 * `multipart/form-data` with a single file field (`file` preferred;
 * `photo` / `selfie` accepted as aliases). No attendance is created here;
 * the returned `photo_path` is consumed later by the attendance endpoint.
 */
export default apiHandler(async event => {
  const actor = await requireRole(event, 'student')
  const db = getDb(event as never)

  let part: Awaited<ReturnType<typeof readUploadFile>>
  try {
    part = await readUploadFile(event)
  } catch {
    throw validationError('Unable to read the selfie file', {
      file: ['Please upload a valid selfie photo.']
    })
  }

  if (!part || part.bytes.length === 0) {
    throw validationError('Selfie file is required', {
      file: ['Please upload a selfie photo.']
    })
  }

  // Normalise the accepted field names server-side; never trust a client
  // filename or path to derive storage location.
  const allowedNames = new Set(['file', 'photo', 'selfie'])
  if (!allowedNames.has(part.name)) {
    throw validationError('Unsupported selfie form field', {
      file: ['Please upload the selfie using the expected form field.']
    })
  }

  const storage = getPhotoStorage(event as never)
  try {
    const upload = await uploadSelfie(
      db,
      {
        actor,
        file: {
          bytes: part.bytes,
          filename: part.filename,
          mimeType: part.type
        }
      },
      { storage }
    )
    return { upload }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(
      ErrorCodes.STORAGE_ERROR,
      503,
      'Photo storage is unavailable'
    )
  }
})
