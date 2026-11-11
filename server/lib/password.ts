/**
 * Argon2id password hashing via `argon2-wasm-edge`.
 * Stored format: PHC string, e.g.
 *   $argon2id$v=19$m=19456,t=2,p=1$<base64 salt>$<base64 hash>
 *
 * Argon2id parameters: version=19, memory=19456 KiB, iterations=2,
 * parallelism=1, hash length=32 bytes, salt=16 random bytes.
 *
 * Wasm modules are imported as static modules so Cloudflare Workers can
 * instantiate them without runtime compilation.
 */
import { argon2id, argon2Verify, setWASMModules } from 'argon2-wasm-edge'
// The `?module` suffix makes the bundler emit static WebAssembly modules,
// which Cloudflare Workers can instantiate without runtime compilation.
import argon2WASMModule from 'argon2-wasm-edge/wasm/argon2.wasm?module'
import blake2bWASMModule from 'argon2-wasm-edge/wasm/blake2b.wasm?module'
import argon2WasmJson from 'argon2-wasm-edge/wasm/argon2.wasm.json'
import blake2bWasmJson from 'argon2-wasm-edge/wasm/blake2b.wasm.json'

function compileJsonWasm(json: { data: string }): Promise<WebAssembly.Module> {
  return WebAssembly.compile(
    Uint8Array.from(atob(json.data), character => character.charCodeAt(0)!)
  )
}

const _wasmModules = Promise.all([
  argon2WASMModule instanceof WebAssembly.Module
    ? argon2WASMModule
    : compileJsonWasm(argon2WasmJson as { data: string }),
  blake2bWASMModule instanceof WebAssembly.Module
    ? blake2bWASMModule
    : compileJsonWasm(blake2bWasmJson as { data: string })
])

let _wasmReady = false

export async function ensureWasm(): Promise<void> {
  if (_wasmReady) return
  const [argon2WASM, blake2bWASM] = await _wasmModules
  await setWASMModules({ argon2WASM, blake2bWASM })
  _wasmReady = true
}

// Initialize the module cache eagerly; hashing and verification still await it.
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
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'unknown'
    console.error('AUTH_PASSWORD_VERIFY_FAILED', reason)
    return false
  }
}
