import { eq } from 'drizzle-orm'
import type { Db } from '../index'
import { photoUploads } from '../schema/photo_uploads'
import { photoUploadFactory } from '../../../test/factories/photo_upload.factory'
import { users } from '../schema/users'

export async function seedPhotoUploads(db: Db) {
  const students = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'student'))
    .limit(5)
  for (const student of students) {
    await db
      .insert(photoUploads)
      .values(photoUploadFactory({ userId: student.id, status: 'pending' }))
  }
}
