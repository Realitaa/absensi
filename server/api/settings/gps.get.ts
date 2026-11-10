import { getDb } from '../../utils/db'
import { requireRole } from '../../utils/http'
import { apiHandler } from '../../utils/app-error'
import { getGpsSettings } from '../../services/system-settings.service'

export default apiHandler(async event => {
  const actor = await requireRole(event, 'admin')
  return { settings: await getGpsSettings(getDb(event as never), actor) }
})
