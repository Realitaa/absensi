import type { AuthenticatedUser } from '../../server/services/auth.service'

declare module '#auth-utils' {
  interface User {
    id: number
    name: string
    username: string
    role: string
    nim: string | null
  }

  interface UserSession {
    user: AuthenticatedUser
  }
}

export {}
