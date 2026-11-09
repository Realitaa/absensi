import { defineEventHandler, getRouterParam } from 'h3'
import { requireRole } from '../../utils/http'
import { getDb } from '../../utils/db'
import { softDeleteUser } from '../../services/user.service'

function paramId(event) {
  const p = getRouterParam(event, 'id')
  if (p) return Number(p)
  const m = event.path?.match(/\/api\/users\/(\d+)/)
  if (m) return Number(m[1])
  const m2 = event.node?.req?.url?.match(/\/api\/users\/(\d+)/)
  if (m2) return Number(m2[1])
  return NaN
}

const RAW = defineEventHandler(async event => {
  const actor = await requireRole(event, 'admin')
  const db = getDb(event as never)
  await softDeleteUser(db, actor, paramId(event))
  return { success: true }
})

export default RAW
