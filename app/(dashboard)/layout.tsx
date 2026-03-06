import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Notifications from '@/components/Notifications'
import { daysLeftInTrial, isTrialExpired } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const { plan, trialEndsAt, isAdmin } = session.user

  const showTrialBanner =
    !isAdmin &&
    plan === 'FREE_TRIAL' &&
    !isTrialExpired(plan, trialEndsAt)

  const trialExpired = !isAdmin && isTrialExpired(plan, trialEndsAt)
  const daysLeft = showTrialBanner ? daysLeftInTrial(trialEndsAt) : 0

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-8 py-3 flex items-center justify-end gap-3">
          <Notifications />
        </header>

        {/* Trial expiry banner */}
        {showTrialBanner && daysLeft <= 7 && (
          <div className="bg-amber-50 border-b border-amber-200 px-8 py-2 flex items-center justify-between text-sm">
            <span className="text-amber-800">
              {daysLeft === 0
                ? 'Your free trial expires today.'
                : `Your free trial expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
            </span>
            <Link
              href="/settings/billing"
              className="text-amber-900 font-medium underline underline-offset-2 hover:text-amber-700"
            >
              Upgrade now
            </Link>
          </div>
        )}

        {/* Trial expired banner */}
        {trialExpired && (
          <div className="bg-red-50 border-b border-red-200 px-8 py-2 flex items-center justify-between text-sm">
            <span className="text-red-800">
              Your free trial has expired. Upgrade to keep access to all features.
            </span>
            <Link
              href="/settings/billing"
              className="text-red-900 font-medium underline underline-offset-2 hover:text-red-700"
            >
              Choose a plan
            </Link>
          </div>
        )}

        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
