'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import SupportWidget from '@/app/components/SupportWidget'
import s from './dashboard.module.css'
import type { User } from '@supabase/supabase-js'

/* ── Types ─────────────────────────────────────── */
type Tag = {
  id: string
  asset_name: string
  asset_type: string
  active: boolean
  created_at: string
  scan_token: string
  owner_name: string
  owner_phone: string
}

type ChatPreview = {
  scan_token: string
  asset_name: string
  lastMessage: string
  lastSender: string
  lastTime: string
  unread: number
}

/* ── Helpers ───────────────────────────────────── */
const ASSET_EMOJI: Record<string, string> = {
  Bag: '🎒', Wallet: '👛', Keys: '🔑', Passport: '🛂',
  Certificate: '📜', Laptop: '💻', 'Pet collar': '🐾',
  Luggage: '🧳', Pets: '🐶', Electronics: '💻',
  Vehicles: '🚲', Other: '🏷️',
}
function assetEmoji(type: string) { return ASSET_EMOJI[type] ?? '🏷️' }

function providerLabel(user: User) {
  const p = user.app_metadata?.provider ?? ''
  if (p === 'google')   return 'Google'
  if (p === 'facebook') return 'Facebook'
  if (p === 'twitter')  return 'X (Twitter)'
  return 'Social'
}

function monthYear(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function greet() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/* ── Icons ─────────────────────────────────────── */
function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="4.5" y="4.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M9.5 4.5V2.5a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M12 1H2a1 1 0 00-1 1v7a1 1 0 001 1h3.5L7 12l1.5-2H12a1 1 0 001-1V2a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  )
}

/* ── Component ─────────────────────────────────── */
export default function Dashboard() {
  const router  = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [user,        setUser]        = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [tags,        setTags]        = useState<Tag[]>([])
  const [scanCounts,  setScanCounts]  = useState<Record<string, number>>({})
  const [tagsLoading, setTagsLoading] = useState(false)
  const [chats,       setChats]       = useState<ChatPreview[]>([])
  const [chatsLoading, setChatsLoading] = useState(false)

  const [phone,       setPhone]       = useState('')
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null)
  const [linking,     setLinking]     = useState(false)

  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [toast,       setToast]       = useState('')

  /* ── Load tags by phone ──────────────────────── */
  const loadTags = async (ownerPhone: string) => {
    setTagsLoading(true)
    const { data: tagRows } = await supabase
      .from('tags')
      .select('id, asset_name, asset_type, active, created_at, scan_token, owner_name, owner_phone')
      .eq('owner_phone', ownerPhone)
      .order('created_at', { ascending: false })

    const rows: Tag[] = tagRows ?? []
    setTags(rows)

    /* fetch scan counts */
    if (rows.length > 0) {
      const tokens = rows.map(t => t.scan_token).filter(Boolean)
      const { data: events } = await supabase
        .from('scan_events')
        .select('scan_token')
        .in('scan_token', tokens)

      const counts: Record<string, number> = {}
      events?.forEach(e => {
        counts[e.scan_token] = (counts[e.scan_token] ?? 0) + 1
      })
      setScanCounts(counts)

      /* load chat previews */
      loadChats(rows)
    }

    setTagsLoading(false)
  }

  /* ── Load recent chats ───────────────────────── */
  const loadChats = async (tagList: Tag[]) => {
    if (tagList.length === 0) return
    setChatsLoading(true)
    const tokens = tagList.map(t => t.scan_token).filter(Boolean)

    const { data: msgs } = await supabase
      .from('messages')
      .select('scan_token, sender, content, created_at')
      .in('scan_token', tokens)
      .order('created_at', { ascending: false })

    /* group by scan_token, keep latest */
    const map: Record<string, ChatPreview> = {}
    msgs?.forEach(m => {
      if (!map[m.scan_token]) {
        const tag = tagList.find(t => t.scan_token === m.scan_token)
        map[m.scan_token] = {
          scan_token:  m.scan_token,
          asset_name:  tag?.asset_name ?? 'Item',
          lastMessage: m.content,
          lastSender:  m.sender,
          lastTime:    m.created_at,
          unread:      0,
        }
      }
    })
    /* count finder messages (unread) */
    msgs?.forEach(m => {
      if (m.sender === 'finder' && map[m.scan_token]) {
        map[m.scan_token].unread++
      }
    })

    setChats(Object.values(map).sort((a, b) =>
      new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
    ))
    setChatsLoading(false)
  }

  /* ── Auth check on mount ─────────────────────── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/auth'); return }
      setUser(session.user)
      setAuthLoading(false)
      const saved = localStorage.getItem('tg_phone')
      if (saved) { setLinkedPhone(saved); loadTags(saved) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!session) router.replace('/auth')
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Handlers ────────────────────────────────── */
  const handleLinkPhone = async () => {
    const trimmed = phone.trim()
    if (!trimmed) return
    setLinking(true)
    localStorage.setItem('tg_phone', trimmed)
    setLinkedPhone(trimmed)
    setPhone('')
    await loadTags(trimmed)
    setLinking(false)
  }

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/scan/${token}`)
    setCopiedToken(token)
    setToast('Scan link copied!')
    setTimeout(() => { setCopiedToken(null); setToast('') }, 2200)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('tg_phone')
    router.replace('/auth')
  }

  /* ── Loading state ───────────────────────────── */
  if (authLoading) {
    return (
      <div className={s.center}>
        <div className={s.spinner} />
      </div>
    )
  }
  if (!user) return null

  /* ── Derived values ──────────────────────────── */
  const meta        = user.user_metadata ?? {}
  const displayName = meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? 'User'
  const avatarUrl   = meta.avatar_url ?? meta.picture ?? null
  const firstName   = displayName.split(' ')[0]
  const userInitials = initials(displayName)
  const prov        = providerLabel(user)
  const since       = monthYear(user.created_at)
  const activeTags  = tags.filter(t => t.active).length
  const totalScans  = Object.values(scanCounts).reduce((a, b) => a + b, 0)

  /* ── Render ──────────────────────────────────── */
  return (
    <div className={s.page}>

      {/* ── Topbar ──────────────────────────────── */}
      <header className={s.topbar}>
        <Link href="/" className={s.brand}>
          <img src="/logo.svg" alt="TagGuard" className={s.brandMark} />
          TagGuard
        </Link>

        <div className={s.userRow}>
          <span className={s.userName}>{displayName}</span>
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} className={s.avatarImg} referrerPolicy="no-referrer" />
            : <div className={s.avatarFallback}>{userInitials}</div>}
          <button className={s.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {/* ── Content ─────────────────────────────── */}
      <div className={s.content}>
        <p className={s.greeting}>{greet()}, {firstName} 👋</p>
        <p className={s.greetSub}>Here's everything about your tags and items.</p>

        {/* Stats row */}
        <div className={s.stats}>
          <div className={s.stat}>
            <div className={s.statNum}>{tags.length}</div>
            <div className={s.statLabel}>Total Tags</div>
          </div>
          <div className={s.stat}>
            <div className={`${s.statNum} ${s.statTeal}`}>{activeTags}</div>
            <div className={s.statLabel}>Active Tags</div>
          </div>
          <div className={s.stat}>
            <div className={s.statNum}>{totalScans}</div>
            <div className={s.statLabel}>Total Scans</div>
          </div>
          <div className={s.stat}>
            <div className={s.statNum}>{tags.length - activeTags}</div>
            <div className={s.statLabel}>Inactive</div>
          </div>
        </div>

        {/* ── Recent Chats ──────────────────────── */}
        {(chats.length > 0 || chatsLoading) && (
          <div className={s.panel} style={{ marginBottom: 24 }}>
            <div className={s.panelHead}>
              <span className={s.panelTitle}>Recent Finder Chats</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Messages from people who found your items
              </span>
            </div>

            {chatsLoading ? (
              <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
                <div className={s.spinner} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {chats.map(chat => (
                  <Link
                    key={chat.scan_token}
                    href={`/chat/${chat.scan_token}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
                      transition: 'background .15s',
                      cursor: 'pointer',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: chat.lastSender === 'finder' ? '#185FA5' : '#e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, flexShrink: 0,
                      }}>
                        {assetEmoji(tags.find(t => t.scan_token === chat.scan_token)?.asset_type ?? '')}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#07111f' }}>
                            {chat.asset_name}
                          </span>
                          <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, marginLeft: 8 }}>
                            {new Date(chat.lastTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 13, color: '#64748b',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginTop: 2,
                        }}>
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>
                            {chat.lastSender === 'finder' ? '🔍 Finder: ' : '👤 You: '}
                          </span>
                          {chat.lastMessage}
                        </div>
                      </div>

                      {/* Unread badge */}
                      {chat.unread > 0 && (
                        <div style={{
                          background: '#185FA5', color: '#fff', borderRadius: 99,
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', flexShrink: 0,
                        }}>
                          {chat.unread}
                        </div>
                      )}

                      {/* Arrow */}
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#94a3b8' }}>
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Two-column layout */}
        <div className={s.cols}>

          {/* ── Tags panel ──────────────────────── */}
          <div className={s.panel}>
            <div className={s.panelHead}>
              <span className={s.panelTitle}>My Tags</span>
              <Link href="/register" className={s.addBtn}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Add tag
              </Link>
            </div>

            {tagsLoading ? (
              /* loading */
              <div style={{ padding: '44px 0', display: 'flex', justifyContent: 'center' }}>
                <div className={s.spinner} />
              </div>

            ) : !linkedPhone ? (
              /* Phone link — first time or no phone yet */
              <>
                <div className={s.empty}>
                  <div className={s.emptyIcon}>📱</div>
                  <div className={s.emptyTitle}>Link your phone number</div>
                  <p className={s.emptyText}>
                    Enter the phone number you used when registering your tags to see them here.
                  </p>
                </div>
                <div style={{
                  margin: '0 16px 12px',
                  padding: '10px 14px',
                  background: 'rgba(217,119,6,.07)',
                  border: '1px solid rgba(217,119,6,.2)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: '#92400e',
                  lineHeight: 1.5,
                }}>
                  ⚠️ Phone linking is not verified. Only enter a number you own. Full verification (OTP) coming soon.
                </div>
                <div className={s.linkForm}>
                  <label className={s.linkLabel}>Your WhatsApp / phone number</label>
                  <div className={s.linkRow}>
                    <input
                      type="tel"
                      className={s.linkInput}
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLinkPhone()}
                    />
                    <button
                      className={s.linkSubmit}
                      onClick={handleLinkPhone}
                      disabled={linking || !phone.trim()}
                    >
                      {linking ? 'Loading…' : 'Link'}
                    </button>
                  </div>
                </div>
              </>

            ) : tags.length === 0 ? (
              /* Empty — phone linked but no tags */
              <>
                <div className={s.empty}>
                  <div className={s.emptyIcon}>🏷️</div>
                  <div className={s.emptyTitle}>No tags yet</div>
                  <p className={s.emptyText}>
                    Register your first TagGuard tag to start protecting your items.
                  </p>
                  <Link href="/register" className={s.addBtn}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Register a tag
                  </Link>
                </div>
                <div className={s.linkForm}>
                  <label className={s.linkLabel}>Linked number: {linkedPhone}</label>
                  <div className={s.linkRow}>
                    <input
                      type="tel"
                      className={s.linkInput}
                      placeholder="Use a different number"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLinkPhone()}
                    />
                    <button
                      className={s.linkSubmit}
                      onClick={handleLinkPhone}
                      disabled={linking || !phone.trim()}
                    >
                      {linking ? '…' : 'Update'}
                    </button>
                  </div>
                </div>
              </>

            ) : (
              /* Tag list */
              <>
                {tags.map(tag => (
                  <div key={tag.id} className={s.tagRow}>
                    <div className={s.tagIcon}>{assetEmoji(tag.asset_type)}</div>

                    <div className={s.tagInfo}>
                      <div className={s.tagName}>{tag.asset_name}</div>
                      <div className={s.tagMeta}>
                        {tag.asset_type}
                        {tag.owner_name ? ` · ${tag.owner_name}` : ''}
                      </div>
                    </div>

                    <span className={`${s.badge} ${tag.active ? s.active : s.inactive}`}>
                      {tag.active ? 'Active' : 'Inactive'}
                    </span>

                    <div className={s.scanBox}>
                      <div className={s.scanNum}>{scanCounts[tag.scan_token] ?? 0}</div>
                      <div className={s.scanLabel}>scans</div>
                    </div>

                    <div className={s.actions}>
                      <button
                        className={s.actBtn}
                        title="Copy scan link"
                        onClick={() => handleCopy(tag.scan_token)}
                      >
                        {copiedToken === tag.scan_token ? <CheckIcon /> : <CopyIcon />}
                      </button>
                      <Link href={`/chat/${tag.scan_token}`} className={s.actBtn} title="Open chat">
                        <ChatIcon />
                      </Link>
                    </div>
                  </div>
                ))}

                {/* Re-link form */}
                <div className={s.linkForm}>
                  <label className={s.linkLabel}>Linked number: {linkedPhone}</label>
                  <div className={s.linkRow}>
                    <input
                      type="tel"
                      className={s.linkInput}
                      placeholder="Switch to a different number"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLinkPhone()}
                    />
                    <button
                      className={s.linkSubmit}
                      onClick={handleLinkPhone}
                      disabled={linking || !phone.trim()}
                    >
                      {linking ? '…' : 'Switch'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Account panel ───────────────────── */}
          <div className={s.panel}>
            <div className={s.panelHead}>
              <span className={s.panelTitle}>Account</span>
            </div>
            <div className={s.accountInner}>
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className={s.acAvatar} referrerPolicy="no-referrer" />
                : <div className={s.acAvatarFall}>{userInitials}</div>}

              <div className={s.acName}>{displayName}</div>
              <div className={s.acEmail}>{user.email}</div>

              <div className={s.providerChip}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M8 5v4l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Signed in with {prov}
              </div>

              <div className={s.memberSince}>Member since {since}</div>

              <SupportWidget
                label="Message customer care"
                variant="inline"
                context="dashboard"
                className={s.supportBtnDash}
              />

              <button className={s.acLogout} onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Toast ───────────────────────────────── */}
      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  )
}
