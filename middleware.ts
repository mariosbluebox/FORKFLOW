import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const token = req.nextauth.token

    // Admin routes — require isAdmin flag
    if (pathname.startsWith('/admin') && !token?.isAdmin) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

// Machine-to-machine routes are excluded: Stripe, Postmark and Vercel Cron
// send no session cookie, so the session check would redirect them to sign-in.
// Each authenticates itself instead (Stripe signature, Postmark token,
// `Bearer CRON_SECRET`) — any new route under api/cron/ must do the same.
export const config = {
  matcher: [
    '/((?!login|signup|api/auth|api/signup|api/stripe/webhook|api/inbound/email|api/cron/|_next/static|_next/image|favicon.ico).*)',
  ],
}
