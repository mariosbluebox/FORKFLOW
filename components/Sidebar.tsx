'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { usePlan } from '@/lib/usePlan'
import type { Feature } from '@/lib/feature-gate'
import { VERSION_LABEL } from '@/lib/version'

type NavItem = {
  href: string
  label: string
  icon: string
  requires?: Feature
}

type NavSection = {
  heading?: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    items: [
      { href: '/', label: 'Dashboard', icon: '▦' },
      { href: '/revenue', label: 'Revenue', icon: '£' },
      { href: '/expenses', label: 'Expenses', icon: '↓' },
      { href: '/payroll', label: 'Payroll', icon: '👥' },
      { href: '/inventory', label: 'Inventory', icon: '📦' },
      { href: '/reports', label: 'Reports', icon: '📊' },
      { href: '/platforms', label: 'Platforms', icon: '🛵', requires: 'platforms' },
    ],
  },
  {
    heading: 'Analytics',
    items: [
      { href: '/analytics/expectancy', label: 'Expectancy', icon: '📈', requires: 'analytics' },
      { href: '/health', label: 'Health Score', icon: '❤', requires: 'health' },
    ],
  },
  {
    items: [
      { href: '/settings/integrations', label: 'Integrations', icon: '⚙', requires: 'email-ingestion' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const plan = usePlan()

  return (
    <aside className="w-56 min-h-screen bg-gray-900 flex flex-col">
      <div className="px-5 py-6 border-b border-gray-700">
        <span className="text-white font-bold text-base leading-tight">
          Restaurant<br />Finance
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-3">
        {sections.map((section, sIdx) => {
          const visibleItems = section.items.filter(
            (item) => !item.requires || plan.can(item.requires)
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={sIdx} className="space-y-0.5">
              {section.heading && (
                <p className="px-3 pt-1 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {section.heading}
                </p>
              )}
              {visibleItems.map(({ href, label, icon }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800',
                    )}
                  >
                    <span className="w-4 text-center text-xs">{icon}</span>
                    {label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-700">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <span className="w-4 text-center text-xs">→</span>
          Sign out
        </button>
        <p className="px-3 pt-3 text-[10px] text-gray-600 font-mono tracking-tight">
          {VERSION_LABEL}
        </p>
      </div>
    </aside>
  )
}
