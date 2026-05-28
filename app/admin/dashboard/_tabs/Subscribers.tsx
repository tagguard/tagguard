'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import s from '../admin.module.css'

interface Props { supabase: SupabaseClient }

type Sub = { id: string; email: string; source: string; created_at: string }

function exportCSV(rows: Sub[]) {
  const header = 'Email,Source,Subscribed At'
  const lines  = rows.map(r =>
    `"${r.email}","${r.source}","${new Date(r.created_at).toLocaleString()}"`
  )
  const csv  = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `tagguard-subscribers-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Subscribers({ supabase }: Props) {
  const [subs,    setSubs]    = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('subscribers')
      .select('*')
      .order('created_at', { ascending: false })
    setSubs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [supabase])

  const filtered = subs.filter(s =>
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.source.toLowerCase().includes(search.toLowerCase())
  )

  /* Group by month for insight */
  const byMonth = subs.reduce<Record<string, number>>((acc, s) => {
    const key = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      {/* Top stats */}
      <div className={s.statsGrid} style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className={s.statCard}>
          <div className={`${s.statValue} ${s.teal}`}>{subs.length}</div>
          <div className={s.statLabel}>Total Subscribers</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statValue}>
            {subs.filter(s => {
              const d = new Date(s.created_at)
              const now = new Date()
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length}
          </div>
          <div className={s.statLabel}>This Month</div>
        </div>
        <div className={s.statCard}>
          <div className={s.statValue}>
            {subs.filter(s => {
              const d = new Date(s.created_at)
              const week = new Date(); week.setDate(week.getDate() - 7)
              return d >= week
            }).length}
          </div>
          <div className={s.statLabel}>Last 7 Days</div>
        </div>
      </div>

      <div className={s.panel}>
        <div className={s.panelHead}>
          <span className={s.panelTitle}>Newsletter Subscribers</span>
          <div className={s.toolbar}>
            <input
              className={s.searchInput}
              placeholder="Search email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className={`${s.btn} ${s.btnGhost}`} onClick={load}>↻ Refresh</button>
            <button
              className={`${s.btn} ${s.btnDark}`}
              onClick={() => exportCSV(filtered)}
              disabled={filtered.length === 0}
            >
              ⬇ Export CSV ({filtered.length})
            </button>
          </div>
        </div>

        <div className={s.tableWrap}>
          <table>
            <thead>
              <tr>
                <th className={s.th}>#</th>
                <th className={s.th}>Email</th>
                <th className={s.th}>Source</th>
                <th className={s.th}>Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={s.loadingRow}><td colSpan={4}><div className={s.spinner} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className={s.td} colSpan={4}>
                  <div className={s.empty}>
                    <div className={s.emptyIcon}>📧</div>
                    <div className={s.emptyTitle}>{search ? 'No matching subscribers' : 'No subscribers yet'}</div>
                    {!search && <p style={{ color: '#94a3b8', fontSize: 13 }}>Subscribers will appear here once people sign up on the landing page.</p>}
                  </div>
                </td></tr>
              ) : filtered.map((sub, i) => (
                <tr key={sub.id} className={s.tr}>
                  <td className={s.td}><span className={s.muted}>{i + 1}</span></td>
                  <td className={s.td}><strong>{sub.email}</strong></td>
                  <td className={s.td}>
                    <span className={s.ctxChip}>{sub.source}</span>
                  </td>
                  <td className={s.td}>
                    <span className={s.muted}>
                      {new Date(sub.created_at).toLocaleDateString('en-US', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly breakdown */}
      {Object.keys(byMonth).length > 1 && (
        <div className={s.panel}>
          <div className={s.panelHead}>
            <span className={s.panelTitle}>Monthly Signups</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(byMonth).map(([month, count]) => (
              <div key={month} style={{
                background: '#f9fafc', border: '1px solid rgba(7,17,31,.06)',
                borderRadius: 10, padding: '10px 16px', textAlign: 'center', minWidth: 80
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#00a9b7' }}>{count}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{month}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
