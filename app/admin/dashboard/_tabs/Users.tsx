'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import s from '../admin.module.css'

interface Props { supabase: SupabaseClient }

type Tag = {
  id: string; asset_name: string; asset_type: string
  owner_name: string | null; owner_phone: string | null
  active: boolean; created_at: string; scan_token: string
}

export default function Users({ supabase }: Props) {
  const [tags,    setTags]    = useState<Tag[]>([])
  const [counts,  setCounts]  = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tags')
      .select('id, asset_name, asset_type, owner_name, owner_phone, active, created_at, scan_token')
      .not('owner_phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200)

    const rows = data ?? []
    setTags(rows)

    /* Fetch scan counts */
    if (rows.length > 0) {
      const tokens = rows.map(t => t.scan_token).filter(Boolean)
      const { data: events } = await supabase
        .from('scan_events')
        .select('scan_token')
        .in('scan_token', tokens)

      const c: Record<string, number> = {}
      events?.forEach(e => { c[e.scan_token] = (c[e.scan_token] ?? 0) + 1 })
      setCounts(c)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [supabase])

  const toggleActive = async (tag: Tag) => {
    setToggling(tag.id)
    await supabase.from('tags').update({ active: !tag.active }).eq('id', tag.id)
    setTags(prev => prev.map(t => t.id === tag.id ? { ...t, active: !t.active } : t))
    setToggling(null)
  }

  const filtered = tags.filter(t => {
    const q = search.toLowerCase()
    return (
      t.id.toLowerCase().includes(q) ||
      (t.asset_name ?? '').toLowerCase().includes(q) ||
      (t.owner_name ?? '').toLowerCase().includes(q) ||
      (t.owner_phone ?? '').includes(q)
    )
  })

  return (
    <div className={s.panel}>
      <div className={s.panelHead}>
        <span className={s.panelTitle}>Registered Users & Tags</span>
        <div className={s.toolbar}>
          <input
            className={s.searchInput}
            placeholder="Search by name, phone, tag ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className={`${s.btn} ${s.btnGhost}`} onClick={load}>↻ Refresh</button>
        </div>
      </div>

      <div className={s.tableWrap}>
        <table>
          <thead>
            <tr>
              <th className={s.th}>Tag ID</th>
              <th className={s.th}>Item</th>
              <th className={s.th}>Type</th>
              <th className={s.th}>Owner</th>
              <th className={s.th}>Phone</th>
              <th className={s.th}>Scans</th>
              <th className={s.th}>Registered</th>
              <th className={s.th}>Status</th>
              <th className={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={s.loadingRow}>
                <td colSpan={9}><div className={s.spinner} /></td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className={s.td} colSpan={9}>
                  <div className={s.empty}>
                    <div className={s.emptyIcon}>👥</div>
                    <div className={s.emptyTitle}>{search ? 'No results found' : 'No registered users yet'}</div>
                  </div>
                </td>
              </tr>
            ) : filtered.map(tag => (
              <tr key={tag.id} className={s.tr}>
                <td className={s.td}><span className={s.mono}>{tag.id}</span></td>
                <td className={s.td}><span className={s.bold}>{tag.asset_name}</span></td>
                <td className={s.td}><span className={s.muted}>{tag.asset_type}</span></td>
                <td className={s.td}>{tag.owner_name || <span className={s.muted}>—</span>}</td>
                <td className={s.td}><span className={s.mono}>{tag.owner_phone}</span></td>
                <td className={s.td} style={{ textAlign: 'center' }}>
                  <strong>{counts[tag.scan_token] ?? 0}</strong>
                </td>
                <td className={s.td}>
                  <span className={s.muted}>
                    {new Date(tag.created_at).toLocaleDateString()}
                  </span>
                </td>
                <td className={s.td}>
                  <span className={`${s.badge} ${tag.active ? s.badgeGreen : s.badgeGray}`}>
                    {tag.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className={s.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className={`${s.btn} ${tag.active ? s.btnDanger : s.btnSuccess}`}
                      style={{ padding: '5px 10px', fontSize: 11 }}
                      disabled={toggling === tag.id}
                      onClick={() => toggleActive(tag)}
                    >
                      {toggling === tag.id ? '…' : tag.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <a
                      href={`/scan/${tag.scan_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${s.btn} ${s.btnGhost}`}
                      style={{ padding: '5px 10px', fontSize: 11 }}
                    >
                      Preview
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
