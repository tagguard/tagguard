'use client'
import { useEffect, useMemo, useState, use } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import SupportWidget from '@/app/components/SupportWidget'
import PWAInstallBanner from '@/app/components/PWAInstallBanner'

type Tag = {
  id: string
  asset_name: string
  asset_type: string
  message_to_finder: string
  owner_name: string
  owner_phone: string
}

const ASSET_EMOJI: Record<string, string> = {
  Bag: '🎒', Passport: '🛂', Keys: '🔑', Wallet: '👛', Laptop: '💻',
  Certificate: '📜', 'Pet collar': '🐾', Luggage: '🧳', Other: '📦',
}
function assetEmoji(type: string) { return ASSET_EMOJI[type] ?? '📦' }

export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [tag,     setTag]     = useState<Tag | null>(null)
  const [loading, setLoading] = useState(true)
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

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
        /* Insert scan event, get back the row ID */
        const { data: eventRow } = await supabase
          .from('scan_events')
          .insert({
            tag_id:     data.id,
            scan_token: token,
            scanned_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        /* ── Geolocation capture ─────────────────────
           Location is shared with the tag owner only,
           to help recover the lost item. The browser
           will show its own permission prompt. Denied
           or unavailable = silently skipped.
        ────────────────────────────────────────────── */
        if (navigator.geolocation && eventRow?.id) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              await supabase
                .from('scan_events')
                .update({
                  lat:      pos.coords.latitude,
                  lng:      pos.coords.longitude,
                  accuracy: Math.round(pos.coords.accuracy),
                })
                .eq('id', eventRow.id)
            },
            () => { /* permission denied or unavailable — ignore */ },
            { timeout: 10000, maximumAge: 0 }
          )
        }
      }

      setLoading(false)
    }

    load()
  }, [token, supabase])

  /* ── Loading ──────────────────────────────────── */
  if (loading) return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </main>
  )

  /* ── Not found / not registered ──────────────── */
  if (!tag) return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 10v6m0 4h.01M28 16A12 12 0 1 1 4 16a12 12 0 0 1 24 0z"
            stroke="#888" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Tag not registered yet</h2>
      <p className="text-sm text-gray-400 mb-6">This tag hasn't been linked to an item.</p>
      <a href="/" className="text-teal-600 text-sm font-semibold">Visit TagGuard to register →</a>
    </main>
  )

  /* ── Found ────────────────────────────────────── */
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">

      {/* PWA install prompt — shown to finders so they can install the app */}
      <PWAInstallBanner />

      {/* Topbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 text-center">
        <span className="font-bold text-gray-900 tracking-tight">TagGuard</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6 text-3xl">
          {assetEmoji(tag.asset_type)}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">{tag.asset_name}</h1>
        {tag.owner_name && (
          <p className="text-gray-400 text-sm mb-6">Belongs to {tag.owner_name}</p>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-8 max-w-sm w-full text-left shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">
            Message from owner
          </p>
          <p className="text-gray-700 text-sm leading-relaxed">"{tag.message_to_finder}"</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={() => router.push(`/chat/${token}`)}
            className="w-full bg-teal-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M18 10c0 4.418-3.582 8-8 8a8.002 8.002 0 0 1-6.938-4H2l1.5-2C2.557 10.938 2 9.535 2 8c0-4.418 3.582-8 8-8s8 3.582 8 8z"
                stroke="white" strokeWidth="1.5"/>
            </svg>
            Chat now
          </button>

          {tag.owner_phone && (
            <button
              onClick={() => router.push(`/chat/${token}?mode=call`)}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M2 3a1 1 0 011-1h3.5a1 1 0 01.95.68l1.1 3.3a1 1 0 01-.23 1.02L6.91 8.41a11.05 11.05 0 005.68 5.68l1.41-1.41a1 1 0 011.02-.23l3.3 1.1a1 1 0 01.68.95V17a1 1 0 01-1 1A15 15 0 012 3z"
                  stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Call owner
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-6 py-5 bg-white space-y-3">
        <p className="text-xs text-gray-400 text-center">
          📍 Your approximate location may be shared with the tag owner to help recover this item.
        </p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-gray-300">Powered by TagGuard · tagguard.in</p>
          <SupportWidget
            label="Contact support"
            variant="inline"
            context="scan_page"
          />
        </div>
      </div>
    </main>
  )
}
