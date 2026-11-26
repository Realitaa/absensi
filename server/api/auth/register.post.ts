import { readBody } from 'h3'
import { getDb } from '../../utils/db'
import { registerStudent } from '../../services/user.service'
import { apiHandler } from '../../utils/app-error'

/**
 * POST /api/auth/register — public student self-registration.
 *
 * Role is fixed to `student` server-side; the client cannot choose a role.
 */
export default apiHandler(async event => {
  const body =
    (await readBody<Record<string, unknown>>(event).catch(() => null)) ?? {}
  const user = await registerStudent(getDb(event as never), body)
  return { user }
})
