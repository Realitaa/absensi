import { defineEventHandler, readBody } from 'h3'
// setUserSession comes from nuxt-auth-utils via Nitro auto-import
// (no static export from 'nuxt/server') — do NOT add an explicit import.
import { getDb } from '../../utils/db'
import { authenticateByIdentifier } from '../../services/auth.service'
import { validationError } from '../../utils/app-error'

export default defineEventHandler(async event => {
  const body = await readBody<{
    identifier?: string
    username?: string
    nim?: string
    password?: string
  }>(event).catch(() => null)
  const identifier =
    body?.identifier?.trim() ?? body?.username?.trim() ?? body?.nim?.trim()
  const password = body?.password

  if (identifier === undefined || password === undefined) {
    throw validationError('Username or NIM and password are required', {
      identifier: ['Username or NIM is required'],
      password: ['Password is required']
    })
  }

  const db = getDb(event as never)
  const user = await authenticateByIdentifier(db, identifier, password)
  await setUserSession(event, { user }, { maxAge: 60 * 60 * 24 * 7 })

  return { user }
})
