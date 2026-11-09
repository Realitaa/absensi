import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/*.{test,spec}.ts'],
          environment: 'node'
        }
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/component.test.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              rootDir: fileURLToPath(new URL('.', import.meta.url)),
              domEnvironment: 'happy-dom'
            }
          }
        }
      }),
      {
        resolve: {
          alias: {
            // h3 is not a direct dep (bundled via Nitro); point Vite
            // at the copy resolved by @nuxt/test-utils so plain node
            // project can import server handlers without Nuxt.
            h3: fileURLToPath(
              new URL(
                './node_modules/.pnpm/h3@1.15.11/node_modules/h3/dist/index.cjs',
                import.meta.url
              )
            )
          }
        },
        test: {
          name: 'server',
          include: [
            'test/nuxt/auth-login.test.ts',
            'test/nuxt/db.test.ts',
            'test/nuxt/profile.test.ts',
            'test/nuxt/user-management.test.ts',
            'test/nuxt/rooms.test.ts',
            'test/nuxt/sessions.test.ts',
            'test/nuxt/timezone.test.ts'
          ],
          environment: 'node',
          testTimeout: 60_000,
          hookTimeout: 60_000
        }
      }
    ]
  }
})
