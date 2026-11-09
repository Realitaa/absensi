import { readMultipartFormData, type H3Event } from 'h3'

export interface MultipartFilePart {
  name: string
  filename?: string
  type?: string
  bytes: Uint8Array
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (value && typeof value === 'object') {
    const maybe = value as { data?: unknown }
    if (maybe.data !== undefined) return toUint8Array(maybe.data)
    const maybeBuffer = value as unknown as { buffer?: unknown }
    if (maybeBuffer.buffer instanceof ArrayBuffer) {
      return new Uint8Array(maybeBuffer.buffer)
    }
  }
  return new Uint8Array(0)
}

function partName(part: Record<string, unknown>): string | undefined {
  const name = part.name
  return typeof name === 'string' ? name : undefined
}

function partFilename(part: Record<string, unknown>): string | undefined {
  const filename = part.filename ?? part.name2 ?? part.fileName
  return typeof filename === 'string' ? filename : undefined
}

function partType(part: Record<string, unknown>): string | undefined {
  const type = part.type ?? part.mimeType ?? part.contentType
  return typeof type === 'string' ? type : undefined
}

/**
 * Extract the first file-bearing part from a multipart request.
 * Supports both h3's multipart parser output and the web-standard
 * `FormData` path used by Nitro on Cloudflare.
 */
export async function readUploadFile(
  event: H3Event
): Promise<MultipartFilePart | null> {
  try {
    const parts = await readMultipartFormData(event)
    if (Array.isArray(parts)) {
      for (const raw of parts) {
        const part = raw as unknown as Record<string, unknown>
        const name = partName(part)
        if (!name) continue
        const data = (part.data ?? part.value ?? part.content) as unknown
        if (data === undefined || data === null) continue
        const bytes = toUint8Array(data)
        if (bytes.length === 0 && !part.filename) continue
        return {
          name,
          filename: partFilename(part),
          type: partType(part),
          bytes
        }
      }
    }
  } catch {
    // Fall through to the Web-standard parser below.
  }

  try {
    const formData = await event.web?.request?.formData()
    if (!formData) return null
    for (const [name, value] of formData.entries()) {
      if (!value || typeof value === 'string') continue
      const file = value as File | Blob
      const bytes = new Uint8Array(await file.arrayBuffer())
      return {
        name,
        filename: (file as File).name,
        type: file.type,
        bytes
      }
    }
  } catch {
    return null
  }
  return null
}
