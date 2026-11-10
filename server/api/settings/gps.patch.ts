import { readBody } from 'h3'
import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { apiHandler } from '../../utils/app-error'
import { updateGpsSettings } from '../../services/system-settings.service'

export default apiHandler(async event => {
  const actor = await requireRole(event, 'admin')
  const body = (await readBody(event).catch(() => null)) ?? {}
  return {
    settings: await updateGpsSettings(getDb(event as never), actor, body)
  }
})
