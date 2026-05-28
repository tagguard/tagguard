'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import s from '../admin.module.css'

interface Props { supabase: SupabaseClient }

type Stats = {
  totalTags: number; registeredTags: number; activeTags: number
  totalScans: number; pendingSupport: number; subscribers: number
}
type RecentScan = { id: string; tag_id: string; scan_token: string | null; scanned_at: string; lat: number | null; lng: number | null }
type RecentMsg  = { id: string; name: string | null; email: string | null; message: string; context: string; created_at: string; resolved: boolean }

export default function Overview({ supabase }: Props) {
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [recentMsgs,  setRecentMsgs]  = useState<RecentMsg[]>([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    const load = async () => {
      const [
        { count: totalTags },
        { count: registeredTags },
        { count: activeTags },
        { count: totalScans },
        { count: pendingSupport },
        { count: subscribers },
        { data: scans },
        { data: msgs },
      ] = await Promise.all([
        supabase.from('tags').select('*', { count: 'exact', head: true }),
        supabase.from('tags').select('*', { count: 'exact', head: true }).not('owner_phone', 'is', null),
        supabase.from('tags').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('scan_events').select('*', { count: 'exact', head: true }),
        supabase.from('support_messages').select('*', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('subscribers').select('*', { count: 'exact', head: true }),
        supabase.from('scan_events').select('id, tag_id, scan_token, scanned_at, lat, lng')
          .order('scanned_at', { ascending: false }).limit(8),
        supabase.from('support_messages').select('id, name, email, message, context, created_at, resolved')
          .order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        totalTags: totalTags ?? 0,
        registeredTags: registeredTags ?? 0,
        activeTags: activeTags ?? 0,
        totalScans: totalScans ?? 0,
        pendingSupport: pendingSupport ?? 0,
        subscribers: subscribers ?? 0,
      })
      setRecentScans(scans ?? [])
      setRecentMsgs(msgs ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return <div className={s.spinnerWrap}><div className={s.spinner} /></div>

  return (
    <div>
      {/* Stats */}
      <div className={s.statsGrid}>
        {[
          { label: 'Total Tags',    value: stats!.totalTags,      cls: '' },
          { label: 'Registered',    value: stats!.registeredTags,  cls: s.teal },
          { label: 'Active Tags',   value: stats!.activeTags,      cls: s.green },
          { label: 'Total Scans',   value: stats!.totalScans,      cls: '' },
          { label: 'Open Support',  value: stats!.pendingSupport,  cls: stats!.pendingSupport > 0 ? s.amber : '' },
          { label: 'Subscribers',   value: stats!.subscribers,     cls: s.teal },
        ].map(({ label, value, cls }) => (
          <div key={label} className={s.statCard}>
            <div className={`${s.statValue} ${cls}`}>{value}</div>
            <div className={s.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* Recent activity row */}
      <div className={s.twoCol}>

        {/* Recent scans */}
        <div className={s.panel}>
          <div className={s.panelHead}>
            <span className={s.panelTitle}>Recent Scans</span>
          </div>
          <div className={s.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th className={s.th}>Tag / Token</th>
                  <th className={s.th}>Time</th>
                  <th className={s.th}>Location</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.length === 0 ? (
                  <tr><td className={s.td} colSpan={3} style={{ textAlign: 'center', color: '#94a3b8' }}>No scans yet</td></tr>
                ) : recentScans.map(e => (
                  <tr key={e.id} className={s.tr}>
                    <td className={s.td}>
                      <div className={s.bold}>{e.tag_id}</div>
                      {e.scan_token && <div className={`${s.mono} ${s.muted}`}>{e.scan_token.slice(0, 8)}…</div>}
                    </td>
                    <td className={s.td}>
                      <div className={s.muted}>
                        {new Date(e.scanned_at).toLocaleDateString()}<br />
                        {new Date(e.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className={s.td}>
                      {e.lat && e.lng
                        ? <a href={`https://maps.google.com/?q=${e.lat},${e.lng}`} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#00a9b7', fontSize: 12, fontWeight: 600 }}>
                            📍 {e.lat.toFixed(4)}, {e.lng.toFixed(4)}
                          </a>
                        : <span className={s.muted}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent support messages */}
        <div className={s.panel}>
          <div className={s.panelHead}>
            <span className={s.panelTitle}>Recent Messages</span>
          </div>
          {recentMsgs.length === 0 ? (
            <div className={s.empty}>
              <div className={s.emptyIcon}>📭</div>
              <div className={s.emptyTitle}>No messages yet</div>
            </div>
          ) : recentMsgs.map(m => (
            <div key={m.id} className={s.msgCard}>
              <div className={s.msgHeader}>
                <span className={s.msgFrom}>{m.name || 'Anonymous'}</span>
                <span className={s.ctxChip}>{m.context}</span>
              </div>
              <p className={s.msgText}>{m.message.length > 120 ? m.message.slice(0, 120) + '…' : m.message}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={s.muted}>{new Date(m.created_at).toLocaleDateString()}</span>
                {m.resolved
                  ? <span className={`${s.badge} ${s.badgeGreen}`}>Resolved</span>
                  : <span className={`${s.badge} ${s.badgeAmber}`}>Open</span>}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
