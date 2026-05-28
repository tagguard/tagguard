'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import s from '../admin.module.css'

interface Props { supabase: SupabaseClient }

type Msg = {
  id: string; name: string | null; email: string | null
  message: string; context: string; created_at: string; resolved: boolean
}

const CTX_LABEL: Record<string, string> = {
  landing_footer: 'Landing', scan_page: 'Scan', dashboard: 'Dashboard', general: 'General'
}

export default function Support({ supabase }: Props) {
  const [messages,  setMessages]  = useState<Msg[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<'open' | 'resolved' | 'all'>('open')
  const [resolving, setResolving] = useState<string | null>(null)
  const [search,    setSearch]    = useState('')

  const load = async () => {
    setLoading(true)
    let q = supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (filter === 'open')     q = q.eq('resolved', false)
    if (filter === 'resolved') q = q.eq('resolved', true)

    const { data } = await q
    setMessages(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [supabase, filter])

  const markResolved = async (id: string, resolved: boolean) => {
    setResolving(id)
    await supabase.from('support_messages').update({ resolved }).eq('id', id)
    setMessages(prev => prev.map(m => m.id === id ? { ...m, resolved } : m))
    setResolving(null)
  }

  const filtered = messages.filter(m => {
    const q = search.toLowerCase()
    return (
      (m.name ?? '').toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q)
    )
  })

  const openCount     = messages.filter(m => !m.resolved).length
  const resolvedCount = messages.filter(m =>  m.resolved).length

  return (
    <div className={s.panel}>
      <div className={s.panelHead}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={s.panelTitle}>Customer Care Messages</span>
          <span className={`${s.badge} ${openCount > 0 ? s.badgeAmber : s.badgeGray}`}>
            {openCount} open
          </span>
          <span className={`${s.badge} ${s.badgeGreen}`}>{resolvedCount} resolved</span>
        </div>

        <div className={s.toolbar}>
          <input
            className={s.searchInput}
            placeholder="Search messages…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {(['open', 'resolved', 'all'] as const).map(f => (
            <button
              key={f}
              className={`${s.btn} ${filter === f ? s.btnPrimary : s.btnGhost}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button className={`${s.btn} ${s.btnGhost}`} onClick={load}>↻</button>
        </div>
      </div>

      {loading ? (
        <div className={s.spinnerWrap}><div className={s.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div className={s.empty}>
          <div className={s.emptyIcon}>📭</div>
          <div className={s.emptyTitle}>
            {search ? 'No matching messages' : filter === 'open' ? 'No open messages 🎉' : 'No messages yet'}
          </div>
        </div>
      ) : filtered.map(m => (
        <div
          key={m.id}
          className={`${s.msgCard} ${m.resolved ? s.resolvedRow : ''}`}
        >
          <div className={s.msgHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={s.msgFrom}>{m.name || 'Anonymous'}</span>
              {m.email && <span className={`${s.mono} ${s.muted}`}>{m.email}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={s.ctxChip}>{CTX_LABEL[m.context] ?? m.context}</span>
              <span className={s.muted}>
                {new Date(m.created_at).toLocaleDateString()} {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {m.resolved
                ? <span className={`${s.badge} ${s.badgeGreen}`}>Resolved</span>
                : <span className={`${s.badge} ${s.badgeAmber}`}>Open</span>}
            </div>
          </div>

          <p className={s.msgText}>{m.message}</p>

          <div className={s.msgActions}>
            {m.email && (
              <a
                href={`mailto:${m.email}?subject=Re: Your TagGuard support message`}
                className={`${s.btn} ${s.btnPrimary}`}
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                ✉ Reply via Email
              </a>
            )}

            {!m.resolved ? (
              <button
                className={`${s.btn} ${s.btnSuccess}`}
                style={{ fontSize: 12, padding: '6px 12px' }}
                disabled={resolving === m.id}
                onClick={() => markResolved(m.id, true)}
              >
                {resolving === m.id ? '…' : '✓ Mark Resolved'}
              </button>
            ) : (
              <button
                className={`${s.btn} ${s.btnGhost}`}
                style={{ fontSize: 12, padding: '6px 12px' }}
                disabled={resolving === m.id}
                onClick={() => markResolved(m.id, false)}
              >
                {resolving === m.id ? '…' : '↩ Reopen'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
