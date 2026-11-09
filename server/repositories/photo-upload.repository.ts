import { eq } from 'drizzle-orm'
import type { Db } from '../db/index'
import {
  photoUploads,
  type NewPhotoUpload,
  type PhotoUpload
} from '../db/schema/photo_uploads'

/**
 * Repository for `photo_uploads` metadata (ERD §1.8).
 * No business rules live here — status lifecycle is owned by services.
 */

export async function insertPhotoUpload(
  db: Db,
  values: NewPhotoUpload
): Promise<PhotoUpload | null> {
  const rows = await db.insert(photoUploads).values(values).returning()
  return rows[0] ?? null
}

export async function findPhotoUploadByPath(
  db: Db,
  photoPath: string
): Promise<PhotoUpload | null> {
  const rows = await db
    .select()
    .from(photoUploads)
    .where(eq(photoUploads.photoPath, photoPath))
    .limit(1)
  return rows[0] ?? null
}

export async function findPhotoUploadById(
  db: Db,
  id: number
): Promise<PhotoUpload | null> {
  const rows = await db
    .select()
    .from(photoUploads)
    .where(eq(photoUploads.id, id))
    .limit(1)
  return rows[0] ?? null
}
