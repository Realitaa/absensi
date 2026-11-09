import { defineEventHandler, readBody } from 'h3'
import { requireAuth } from '../../utils/http'
import { getDb } from '../../utils/db'
import { updateOwnProfile } from '../../services/profile.service'

const RAW = defineEventHandler(async event => {
  const actor = await requireAuth(event)
  const body =
    (await readBody<{
      name?: string
      username?: string
      nim?: string | null
    }>(event).catch(() => null)) ?? {}
  const db = getDb(event as never)
  const user = await updateOwnProfile(db, actor, body)
  return { user }
})

export default RAW
