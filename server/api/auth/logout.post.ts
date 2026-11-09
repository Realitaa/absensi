import { apiHandler } from '../../utils/app-error'

export default apiHandler(async event => {
  await clearUserSession(event)
  return { success: true }
})
