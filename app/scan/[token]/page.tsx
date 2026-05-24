'use client'
import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Tag = { id: string; asset_name: string; asset_type: string; message_to_finder: string; owner_name: string; owner_phone: string }

export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [tag, setTag] = useState<Tag | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('tags')
        .select('*')
        .eq('scan_token', token)
        .eq('active', true)
        .single()
      setTag(data)
      if (data) {
        await supabase.from('scan_events').insert({ tag_id: data.id, scanned_at: new Date().toISOString() })
      }
      setLoading(false)
    }
    load()
  }, [token])

  if (loading) return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </main>
  )

  if (!tag) return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 10v6m0 4h.01M28 16A12 12 0 1 1 4 16a12 12 0 0 1 24 0z" stroke="#888" strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Tag not registered yet</h2>
      <a href="/" className="text-blue-600 text-sm font-medium">Visit TagGuard to register →</a>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-6 py-4 text-center">
        <span className="font-semibold text-gray-900">TagGuard</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-3xl">
          {tag.asset_type === 'Bag' ? '🎒' : tag.asset_type === 'Passport' ? '📘' : tag.asset_type === 'Keys' ? '🔑' : tag.asset_type === 'Wallet' ? '👛' : tag.asset_type === 'Laptop' ? '💻' : '📦'}
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">{tag.asset_name}</h1>
        {tag.owner_name && <p className="text-gray-500 text-sm mb-6">Belongs to {tag.owner_name}</p>}

        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8 max-w-sm w-full text-left">
          <p className="text-sm text-gray-500 font-medium mb-1">Message from owner</p>
          <p className="text-gray-800 text-sm leading-relaxed">"{tag.message_to_finder}"</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={() => router.push(`/chat/${token}`)}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M18 10c0 4.418-3.582 8-8 8a8.002 8.002 0 0 1-6.938-4H2l1.5-2C2.557 10.938 2 9.535 2 8c0-4.418 3.582-8 8-8s8 3.582 8 8z" stroke="white" strokeWidth="1.5"/></svg>
            Chat now
          </button>
          {tag.owner_phone && (
            <button
              onClick={() => router.push(`/chat/${token}?mode=call`)}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 3a1 1 0 011-1h3.5a1 1 0 01.95.68l1.1 3.3a1 1 0 01-.23 1.02L6.91 8.41a11.05 11.05 0 005.68 5.68l1.41-1.41a1 1 0 011.02-.23l3.3 1.1a1 1 0 01.68.95V17a1 1 0 01-1 1A15 15 0 012 3z"
                stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Call owner
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-300 pb-6">Powered by TagGuard · tagguard.in</p>
    </main>
  )
}
