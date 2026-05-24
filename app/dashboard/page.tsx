'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

type Tag = { id: string; asset_name: string; asset_type: string; active: boolean; created_at: string; scan_token: string }

export default function Dashboard() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [phone, setPhone] = useState('')
  const [hasPhone, setHasPhone] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const supabase = createClient()

  const loadTags = async (ownerPhone: string) => {
    const { data } = await supabase
      .from('tags')
      .select('id, asset_name, asset_type, active, created_at, scan_token')
      .eq('owner_phone', ownerPhone)
      .order('created_at', { ascending: false })
    setTags(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const saved = localStorage.getItem('tg_phone')
    localStorage.setItem('tg_role', 'owner')
    if (saved) {
      setPhone(saved)
      setHasPhone(true)
      loadTags(saved)
    } else {
      setLoading(false)
    }
  }, [])

  const handlePhoneLogin = () => {
    if (!phone.trim()) return
    localStorage.setItem('tg_phone', phone.trim())
    localStorage.setItem('tg_role', 'owner')
    setHasPhone(true)
    loadTags(phone.trim())
  }

  const handleCopy = (tagId: string, scanToken: string) => {
    const url = `${window.location.origin}/scan/${scanToken}`
    navigator.clipboard.writeText(url)
    setCopiedId(tagId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </main>
  )

  if (!hasPhone) return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Your tags</h2>
        <p className="text-gray-500 text-sm mb-6">Enter the phone number you registered with</p>
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="+91 98765 43210"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-white mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={handlePhoneLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium">View my tags</button>
      </div>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <span className="font-semibold text-gray-900">My Tags</span>
        <Link href="/register" className="text-blue-600 text-sm font-medium">+ Add tag</Link>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {tags.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No tags registered yet</p>
            <Link href="/register" className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium">Register your first tag</Link>
          </div>
        )}
        {tags.map(t => (
          <div key={t.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold text-gray-900">{t.asset_name}</p>
                <p className="text-gray-400 text-sm">{t.asset_type} · Tag ID: <span className="font-mono">{t.id}</span></p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${t.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {t.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {t.scan_token && (
              <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">Scan URL (goes on your sticker)</p>
                  <p className="font-mono text-xs text-gray-600 truncate">/scan/{t.scan_token}</p>
                </div>
                <button
                  onClick={() => handleCopy(t.id, t.scan_token)}
                  className="flex-shrink-0 text-xs text-blue-600 font-medium border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                  {copiedId === t.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/chat/${t.scan_token}`}
                className="flex-1 text-center text-blue-600 border border-blue-200 py-2 rounded-xl text-sm font-medium hover:bg-blue-50">
                Open chat
              </Link>
              <Link href={`/scan/${t.scan_token}`}
                className="flex-1 text-center text-gray-600 border border-gray-200 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
                Preview scan
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
