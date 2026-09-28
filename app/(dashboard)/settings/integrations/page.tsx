'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { usePlan } from '@/lib/usePlan'
import { formatDate } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImportLog {
  id: string
  platform: 'UBEREATS' | 'JUSTEAT' | 'DELIVEROO'
  filename: string
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  rowsImported: number
  errorMessage: string | null
  receivedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  UBEREATS: 'Uber Eats',
  JUSTEAT: 'Just Eat',
  DELIVEROO: 'Deliveroo',
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-red-100 text-red-800',
}

function Loader() {
  return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function UpgradeGate() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
      <div className="text-3xl mb-3">🔒</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Email integrations is a Pro feature</h2>
      <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
        Forward your weekly platform statements to a unique address and have them imported automatically.
      </p>
      <Link
        href="/settings/billing"
        className="inline-flex px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
      >
        Upgrade to Pro
      </Link>
    </div>
  )
}

// Gate before mounting the page so Basic users never fire the (403) API calls.
export default function IntegrationsPage() {
  const plan = usePlan()
  if (plan.loading) return <Loader />
  if (!plan.can('email-ingestion')) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Integrations</h1>
          <p className="text-sm text-gray-500 mt-1">Auto-import your weekly platform statements by forwarding emails to your unique inbound address.</p>
        </div>
        <UpgradeGate />
      </div>
    )
  }
  return <IntegrationsContent />
}

function IntegrationsContent() {
  const [inboundEmail, setInboundEmail] = useState('')
  const [importLogs, setImportLogs] = useState<ImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Test upload
  const [testPlatform, setTestPlatform] = useState('UBEREATS')
  const [testFile, setTestFile] = useState<File | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/settings/integrations')
    if (res.ok) {
      const data = await res.json()
      setInboundEmail(data.inboundEmail)
      setImportLogs(data.importLogs)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function copyEmail() {
    await navigator.clipboard.writeText(inboundEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleTestUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!testFile) return
    setTestLoading(true)
    setTestResult(null)

    const formData = new FormData()
    formData.append('file', testFile)
    formData.append('platform', testPlatform)

    try {
      const res = await fetch('/api/inbound/test', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ ok: true, message: `Imported ${data.rowsImported} period${data.rowsImported !== 1 ? 's' : ''}${data.rowsSkipped > 0 ? `, ${data.rowsSkipped} rows skipped` : ''}.` })
        setTestFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        fetchData()
      } else {
        setTestResult({ ok: false, message: data.error ?? 'Import failed. Check that the file matches the expected format.' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Network error. Please try again.' })
    } finally {
      setTestLoading(false)
    }
  }

  if (loading) return <Loader />

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Auto-import your weekly platform statements by forwarding emails to your unique inbound address.
        </p>
      </div>

      {/* Inbound email address */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Your Inbound Email Address</h2>
        <p className="text-sm text-gray-500 mb-4">
          Forward your Uber Eats, Deliveroo, and Just Eat weekly statement emails to this address. Each platform email is automatically detected and imported.
        </p>
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
          <span className="flex-1 text-sm font-mono text-gray-800 break-all">{inboundEmail}</span>
          <button
            onClick={copyEmail}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Setup Instructions</h2>
        <div className="grid grid-cols-2 gap-6">

          {/* Gmail */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">✉</span>
              <span className="font-medium text-gray-800">Gmail</span>
            </div>
            <ol className="text-sm text-gray-600 space-y-2">
              <li><span className="font-medium text-gray-800">1.</span> Open Gmail → Settings (⚙) → See all settings</li>
              <li><span className="font-medium text-gray-800">2.</span> Go to <span className="font-mono text-xs bg-gray-100 px-1 rounded">Forwarding and POP/IMAP</span></li>
              <li><span className="font-medium text-gray-800">3.</span> Click <span className="font-medium">Add a forwarding address</span></li>
              <li><span className="font-medium text-gray-800">4.</span> Paste your inbound email address above</li>
              <li><span className="font-medium text-gray-800">5.</span> Confirm the verification code sent to your inbox</li>
              <li><span className="font-medium text-gray-800">6.</span> Create a filter: <span className="font-mono text-xs bg-gray-100 px-1 rounded">from:(uber.com OR deliveroo.co.uk OR just-eat.co.uk)</span> → Forward to your inbound address</li>
            </ol>
          </div>

          {/* Outlook */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📧</span>
              <span className="font-medium text-gray-800">Outlook</span>
            </div>
            <ol className="text-sm text-gray-600 space-y-2">
              <li><span className="font-medium text-gray-800">1.</span> Open Outlook → Settings (⚙) → View all Outlook settings</li>
              <li><span className="font-medium text-gray-800">2.</span> Go to <span className="font-mono text-xs bg-gray-100 px-1 rounded">Mail → Rules</span></li>
              <li><span className="font-medium text-gray-800">3.</span> Click <span className="font-medium">Add new rule</span></li>
              <li><span className="font-medium text-gray-800">4.</span> Condition: <span className="font-medium">From</span> → enter each platform&apos;s sender domain</li>
              <li><span className="font-medium text-gray-800">5.</span> Action: <span className="font-medium">Forward to</span> → paste your inbound email</li>
              <li><span className="font-medium text-gray-800">6.</span> Save the rule</li>
            </ol>
          </div>
        </div>

        {/* Supported platforms */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Supported Sender Domains</p>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: 'Uber Eats', domains: '@uber.com · @ubereats.com' },
              { label: 'Deliveroo', domains: '@deliveroo.co.uk' },
              { label: 'Just Eat', domains: '@just-eat.co.uk · @justeat.com · @takeaway.com' },
            ].map(p => (
              <div key={p.label} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5">
                <span className="font-medium text-gray-700">{p.label}:</span>
                <span className="font-mono text-gray-500">{p.domains}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Test import */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Test Import</h2>
        <p className="text-sm text-gray-500 mb-4">
          Upload a CSV file manually to verify the parser works before setting up email forwarding.
        </p>
        <form onSubmit={handleTestUpload} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
              <select
                value={testPlatform}
                onChange={e => setTestPlatform(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="UBEREATS">Uber Eats</option>
                <option value="JUSTEAT">Just Eat</option>
                <option value="DELIVEROO">Deliveroo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CSV File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={e => setTestFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          </div>

          {testResult && (
            <div className={`rounded-xl px-4 py-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
            </div>
          )}

          <button
            type="submit"
            disabled={!testFile || testLoading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {testLoading ? 'Importing…' : 'Test Import'}
          </button>
        </form>
      </div>

      {/* Import history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Import History</h2>
          <p className="text-sm text-gray-500 mt-0.5">Last 20 import attempts from email and manual uploads.</p>
        </div>
        {importLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No imports yet. Set up email forwarding or use Test Import above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Platform</th>
                <th className="px-4 py-3 text-left">File</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Rows</th>
                <th className="px-4 py-3 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {importLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatDate(log.receivedAt)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{PLATFORM_LABELS[log.platform] ?? log.platform}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{log.filename}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[log.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{log.rowsImported}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{log.errorMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
