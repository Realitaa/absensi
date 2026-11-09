import {
  ErrorCodes,
  type ErrorCode,
  type ApiErrorBody
} from '../../shared/error-codes'

export class AppError extends Error {
  code: ErrorCode
  status: number
  details?: Record<string, unknown>

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function validationError(
  message: string,
  fieldErrors?: Record<string, string[]>
): AppError {
  return new AppError(
    ErrorCodes.VALIDATION_ERROR,
    400,
    message,
    fieldErrors ? { fieldErrors } : undefined
  )
}

export function invalidCredentials(): AppError {
  return new AppError(
    ErrorCodes.INVALID_CREDENTIALS,
    401,
    'Invalid credentials'
  )
}

export function unauthorized(message = 'Authentication required'): AppError {
  return new AppError(ErrorCodes.UNAUTHORIZED, 401, message)
}

export function forbidden(message = 'Access denied'): AppError {
  return new AppError(ErrorCodes.FORBIDDEN, 403, message)
}

export function notFound(message = 'Resource not found'): AppError {
  return new AppError(ErrorCodes.NOT_FOUND, 404, message)
}

export function conflict(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): AppError {
  return new AppError(code, 409, message, details)
}

export function internalError(): AppError {
  return new AppError(ErrorCodes.INTERNAL_ERROR, 500, 'Internal server error')
}

export function createRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return (
    'req_' +
    btoa(binary)
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 20)
      .toLowerCase()
  )
}

export function toErrorBody(err: AppError, requestId: string): ApiErrorBody {
  const body: ApiErrorBody = {
    error: {
      code: err.code,
      message: err.message,
      status: err.status,
      requestId
    }
  }
  if (err.details) body.error.details = err.details
  return body
}

export function getRequestId(event: {
  context?: Record<string, unknown>
}): string {
  const existing = event.context?.requestId
  if (typeof existing === 'string' && existing) return existing
  return createRequestId()
}
