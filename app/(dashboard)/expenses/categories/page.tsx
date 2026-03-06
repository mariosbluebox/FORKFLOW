'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Category { id: string; name: string; colour: string }

const PRESET_COLOURS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#8b5cf6','#ec4899','#6b7280','#14b8a6']

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Category | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/expenses/categories')
    if (res.ok) setCategories(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return
    const res = await fetch(`/api/expenses/categories/${id}`, { method: 'DELETE' })
    if (!res.ok) { setError((await res.json()).error); return }
    setError('')
    fetchData()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/expenses" className="text-sm text-indigo-600 hover:text-indigo-800">← Back to Expenses</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Expense Categories</h1>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Categories</h2>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">+ Add</button>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-gray-400">Loading…</div> : (
          <ul className="divide-y divide-gray-50">
            {categories.map(c => (
              <li key={c.id} className="flex items-center gap-4 px-6 py-3">
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.colour }} />
                <span className="flex-1 text-sm font-medium text-gray-900">{c.name}</span>
                <div className="flex gap-3">
                  <button onClick={() => { setEditing(c); setShowForm(true) }} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
                  <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && <CategoryModal category={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData() }} />}
    </div>
  )
}

function CategoryModal({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? '')
  const [colour, setColour] = useState(category?.colour ?? '#6b7280')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(category ? `/api/expenses/categories/${category.id}` : '/api/expenses/categories', {
      method: category ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, colour }),
    })
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{category ? 'Edit Category' : 'Add Category'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm text-gray-700 mb-1">Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">Colour</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLOURS.map(c => (
                <button key={c} type="button" onClick={() => setColour(c)} className={`w-7 h-7 rounded-full transition-transform ${colour === c ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : ''}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
