import { requireAuth } from '../../utils/http'
import { apiHandler } from '../../utils/app-error'

export default apiHandler(async event => {
  const user = await requireAuth(event)
  return { user }
})
