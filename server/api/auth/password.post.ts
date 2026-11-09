import { readBody } from 'h3'
import { requireAuth } from '../../utils/http'
import { getDb } from '../../utils/db'
import { changePassword } from '../../services/profile.service'
import { apiHandler } from '../../utils/app-error'

export default apiHandler(async event => {
  const actor = await requireAuth(event)
  const body =
    (await readBody<{
      currentPassword?: string
      newPassword?: string
    }>(event).catch(() => null)) ?? {}
  const db = getDb(event as never)
  await changePassword(db, actor, {
    currentPassword: body.currentPassword as string,
    newPassword: body.newPassword as string
  })
  return { success: true }
})
