import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      restaurantId: string
      plan: string
      trialEndsAt: string
      isAdmin: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    restaurantId: string
    plan: string
    trialEndsAt: string
    isAdmin: boolean
  }
}
