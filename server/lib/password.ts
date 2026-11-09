/**
 * Argon2id password hashing via `argon2-wasm-edge`.
 * Stored format: PHC string, e.g.
 *   $argon2id$v=19$m=19456,t=2,p=1$<base64 salt>$<base64 hash>
 *
 * Argon2id parameters: version=19, memory=19456 KiB, iterations=2,
 * parallelism=1, hash length=32 bytes, salt=16 random bytes.
 *
 * Wasm is precompiled at module load with `WebAssembly.compile()`; the
 * package default (compiling embedded base64 blobs at runtime) is
 * disallowed in Cloudflare Workers.
 */
import { argon2id, argon2Verify, setWASMModules } from 'argon2-wasm-edge'
import argon2WasmJson from 'argon2-wasm-edge/wasm/argon2.wasm.json'
import blake2bWasmJson from 'argon2-wasm-edge/wasm/blake2b.wasm.json'

// --- Wasm precompilation (CF Workers forbids runtime compile of blobs) ---
const _argonModule = WebAssembly.compile(
  Uint8Array.from(atob((argon2WasmJson as { data: string }).data), c =>
    c.charCodeAt(0)!
  )
)
const _blakeModule = WebAssembly.compile(
  Uint8Array.from(atob((blake2bWasmJson as { data: string }).data), c =>
    c.charCodeAt(0)!
  )
)

let _wasmReady = false

export async function ensureWasm(): Promise<void> {
  if (_wasmReady) return
  const [argon2WASM, blake2bWASM] = await Promise.all([
    _argonModule,
    _blakeModule
  ])
  await setWASMModules({ argon2WASM, blake2bWASM })
  _wasmReady = true
}

// Precompile eagerly so first hash/verify does not pay compile cost,
// but hashing still awaits module load through ensureWasm().
void ensureWasm().catch(() => {})

export const ARGON2_MEMORY_KIB = 19456
export const ARGON2_ITERATIONS = 2
export const ARGON2_PARALLELISM = 1
export const ARGON2_HASH_BYTES = 32
export const ARGON2_SALT_BYTES = 16
export const ARGON2_VERSION = 19

export async function hashPassword(password: string): Promise<string> {
  await ensureWasm()
  const salt = crypto.getRandomValues(new Uint8Array(ARGON2_SALT_BYTES))
  return argon2id({
    password,
    salt,
    iterations: ARGON2_ITERATIONS,
    parallelism: ARGON2_PARALLELISM,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_BYTES,
    outputType: 'encoded'
  })
}

/**
 * Verify a password against a stored Argon2id hash.
 * Never throws on malformed input — returns false instead.
 * Never logs passwords, salts, or hashes.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (!stored || !stored.startsWith('$argon2id$')) return false
  try {
    await ensureWasm()
    return await argon2Verify({ password, hash: stored })
  } catch {
    return false
  }
}
