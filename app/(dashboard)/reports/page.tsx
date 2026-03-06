import Link from 'next/link'

const reports = [
  {
    href: '/reports/pl',
    title: 'Profit & Loss',
    description: 'Revenue, expenses, payroll breakdown and net profit for any period.',
    icon: '£',
    colour: 'bg-indigo-50 text-indigo-700',
  },
  {
    href: '/reports/vat',
    title: 'VAT Summary',
    description: 'VAT on sales, reclaimable input VAT, and net VAT liability.',
    icon: '%',
    colour: 'bg-green-50 text-green-700',
  },
  {
    href: '/reports/cashflow',
    title: 'Cash Flow',
    description: 'Weekly cash in vs. out chart to track liquidity over time.',
    icon: '~',
    colour: 'bg-blue-50 text-blue-700',
  },
  {
    href: '/reports/payroll',
    title: 'Payroll Report',
    description: 'Per-employee breakdown of wages, employer NI, and labour cost %.',
    icon: '👤',
    colour: 'bg-amber-50 text-amber-700',
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Financial reports for your restaurant</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reports.map(r => (
          <Link key={r.href} href={r.href} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-gray-200 transition-all group">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${r.colour}`}>
                {r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{r.title}</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{r.description}</p>
              </div>
              <span className="text-gray-300 group-hover:text-indigo-400 transition-colors text-lg">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
