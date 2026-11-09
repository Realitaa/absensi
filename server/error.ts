import type { NitroErrorHandler } from 'nitropack'
import { AppError, internalError, toErrorBody, getRequestId } from './utils/app-error'

const errorHandler: NitroErrorHandler = async (nitroError, event, { defaultHandler }) => {
  const requestId = getRequestId(event as never)

  if (nitroError instanceof AppError) {
    event.context.requestId = requestId
    await defaultHandler(
      Object.assign(new Error(nitroError.message), {
        statusCode: nitroError.status,
        statusMessage: nitroError.name,
        data: toErrorBody(nitroError, requestId)
      }) as never,
      event,
      { json: true }
    )
    return
  }

  const statusCode = (nitroError as { statusCode?: number }).statusCode ?? 500

  if (statusCode === 404) {
    const err = new AppError('NOT_FOUND', 404, 'Resource not found')
    await defaultHandler(
      Object.assign(new Error(err.message), {
        statusCode: 404,
        statusMessage: err.name,
        data: toErrorBody(err, requestId)
      }) as never,
      event,
      { json: true }
    )
    return
  }

  console.error(
    '[requestId=%s] %s',
    requestId,
    nitroError?.stack ?? nitroError?.message ?? nitroError
  )
  const err = internalError()
  await defaultHandler(
    Object.assign(new Error(err.message), {
      statusCode: 500,
      statusMessage: err.name,
      data: toErrorBody(err, requestId)
    }) as never,
    event,
    { json: true }
  )
}

export default errorHandler
