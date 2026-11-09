import { defineEventHandler, getQuery } from 'h3'
import { requireRole } from '../../utils/http'
import { getDb } from '../../utils/db'
import { listManagedUsers } from '../../services/user.service'

const RAW = defineEventHandler(async event => {
  const actor = await requireRole(event, 'admin')
  const q = getQuery(event)
  const db = getDb(event as never)
  return await listManagedUsers(db, actor, {
    search: typeof q.search === 'string' ? q.search : undefined,
    role: typeof q.role === 'string' ? q.role : undefined,
    status: typeof q.status === 'string' ? q.status : undefined,
    page: q.page !== undefined ? Number(q.page) : undefined,
    pageSize: q.pageSize !== undefined ? Number(q.pageSize) : undefined
  })
})

export default RAW
