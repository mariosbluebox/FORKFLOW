'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RevenueImportPage() {
  const router = useRouter()
  const [source, setSource] = useState('SUMUP')
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported?: number; error?: string } | null>(null)

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('source', source)
    const res = await fetch('/api/revenue/import', { method: 'POST', body: fd })
    const data = await res.json()
    setResult(data)
    setImporting(false)
    if (res.ok) setTimeout(() => router.push('/revenue'), 1500)
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link href="/revenue" className="text-sm text-indigo-600 hover:text-indigo-800">← Back to Revenue</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Import CSV</h1>
        <p className="text-sm text-gray-500 mt-1">Import revenue data from SumUp or TakePayments exports.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">POS Source</label>
          <div className="flex gap-3">
            {[['SUMUP', 'SumUp'], ['TAKEPAYMENTS', 'TakePayments']].map(([k, v]) => (
              <button key={k} onClick={() => setSource(k)} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${source === k ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{v}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">CSV File</label>
          <input type="file" accept=".csv" onChange={e => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-sm file:font-medium file:bg-white hover:file:bg-gray-50" />
        </div>

        <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Expected format</p>
          <p>The importer looks for <strong>Date</strong> and <strong>Gross Amount</strong> columns. VAT and net are calculated automatically at 20%.</p>
        </div>

        {result && (
          <div className={`rounded-lg p-4 text-sm ${result.imported ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {result.imported ? `Imported ${result.imported} entries successfully.` : `Error: ${result.error}`}
          </div>
        )}

        <button onClick={handleImport} disabled={!file || importing} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
          {importing ? 'Importing…' : 'Import'}
        </button>
      </div>
    </div>
  )
}
