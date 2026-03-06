import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) redirect('/')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-sm">RestaurantFinance Admin</span>
          <nav className="flex gap-4">
            <Link href="/admin" className="text-gray-300 hover:text-white text-sm transition-colors">
              Restaurants
            </Link>
          </nav>
        </div>
        <Link href="/" className="text-gray-400 hover:text-white text-sm transition-colors">
          Back to app
        </Link>
      </header>
      <main className="px-8 py-8 max-w-7xl mx-auto">{children}</main>
    </div>
  )
}
