import { readBody } from 'h3'
import { requireRole } from '../../utils/http'
import { getDb } from '../../utils/db'
import { createUser } from '../../services/user.service'
import { apiHandler } from '../../utils/app-error'

const RAW = apiHandler(async event => {
  const actor = await requireRole(event, 'admin')
  const body =
    (await readBody<Record<string, unknown>>(event).catch(() => null)) ?? {}
  const db = getDb(event as never)
  const user = await createUser(db, actor, body)
  return { user }
})

export default RAW
