import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { rateLimit, clientIp, RATE_LIMITS } from './rate-limit'

// Thrown from authorize(); NextAuth passes the message through as `error`.
export const RATE_LIMITED = 'RATE_LIMITED'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        // Checked before the user lookup and bcrypt so throttled attempts cost nothing.
        // Both counters increment, so neither one-IP-many-accounts nor
        // many-IPs-one-account brute force gets through.
        const email = credentials.email.trim().toLowerCase()
        const [byEmail, byIp] = await Promise.all([
          rateLimit(`login:email:${email}`, RATE_LIMITS.loginPerEmail),
          rateLimit(`login:ip:${clientIp(req?.headers)}`, RATE_LIMITS.loginPerIp),
        ])
        if (!byEmail.allowed || !byIp.allowed) throw new Error(RATE_LIMITED)

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { restaurant: true },
        })

        if (!user) return null

        // Super-admin has no restaurant
        if (!user.isAdmin && (!user.restaurant || !user.restaurant.isActive)) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          restaurantId: user.restaurantId ?? '',
          plan: user.restaurant?.plan ?? 'PRO',
          trialEndsAt: user.restaurant?.trialEndsAt?.toISOString() ?? '',
          isAdmin: user.isAdmin,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { id: string; restaurantId: string; plan: string; trialEndsAt: string; isAdmin: boolean }
        token.id = u.id
        token.restaurantId = u.restaurantId
        token.plan = u.plan
        token.trialEndsAt = u.trialEndsAt
        token.isAdmin = u.isAdmin
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.restaurantId = token.restaurantId
        session.user.plan = token.plan
        session.user.trialEndsAt = token.trialEndsAt
        session.user.isAdmin = token.isAdmin
      }
      return session
    },
  },
}
