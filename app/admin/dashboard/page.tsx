'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import s from './admin.module.css'

import Overview    from './_tabs/Overview'
import Users       from './_tabs/Users'
import Inventory   from './_tabs/Inventory'
import Support     from './_tabs/Support'
import Subscribers from './_tabs/Subscribers'

type Tab = 'overview' | 'users' | 'inventory' | 'support' | 'subscribers'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',    label: 'Overview',    icon: '◈' },
  { id: 'users',       label: 'Users & Tags', icon: '👥' },
  { id: 'inventory',   label: 'Inventory',   icon: '📦' },
  { id: 'support',     label: 'Support',     icon: '💬' },
  { id: 'subscribers', label: 'Subscribers', icon: '📧' },
]

export default function AdminDashboard() {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [user,        setUser]        = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab,   setActiveTab]   = useState<Tab>('overview')

  /* Auth + admin check */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/admin'); return }

      const { data: adminRow } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!adminRow) {
        await supabase.auth.signOut()
        router.replace('/admin')
        return
      }

      setUser(session.user)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!session) router.replace('/admin')
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/admin')
  }

  if (authLoading) {
    return (
      <div className={s.center}>
        <div className={s.spinner} />
        <span style={{ color: '#667385', fontSize: 13 }}>Verifying admin access…</span>
      </div>
    )
  }

  return (
    <div className={s.page}>

      {/* ── Topbar ── */}
      <header className={s.topbar}>
        <Link href="/" className={s.brand}>
          <span className={s.brandMark} />
          TagGuard
          <span className={s.adminBadge}>Admin</span>
        </Link>

        <div className={s.topRight}>
          <span className={s.adminEmail}>{user?.email}</span>
          <button className={s.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      {/* ── Tab nav ── */}
      <nav className={s.tabNav}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${s.tabBtn} ${activeTab === tab.id ? s.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <div className={s.content}>
        {activeTab === 'overview'    && <Overview    supabase={supabase} />}
        {activeTab === 'users'       && <Users       supabase={supabase} />}
        {activeTab === 'inventory'   && <Inventory   supabase={supabase} />}
        {activeTab === 'support'     && <Support     supabase={supabase} />}
        {activeTab === 'subscribers' && <Subscribers supabase={supabase} />}
      </div>

    </div>
  )
}
