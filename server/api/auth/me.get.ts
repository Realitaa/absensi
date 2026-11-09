import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/http'

export default defineEventHandler(async event => {
  const user = await requireAuth(event)
  return { user }
})
