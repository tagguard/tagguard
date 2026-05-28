'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import s from './login.module.css'

export default function AdminLogin() {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Please enter email and password.'); return }
    setLoading(true); setError('')

    /* 1. Sign in with email + password */
    const { data: authData, error: authErr } =
      await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (authErr || !authData.user) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    /* 2. Verify this user is in the admins table */
    const { data: adminRow } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (!adminRow) {
      await supabase.auth.signOut()
      setError('Access denied. This account is not an admin.')
      setLoading(false)
      return
    }

    router.replace('/admin/dashboard')
  }

  return (
    <div className={s.page}>
      <div className={s.card}>

        <div className={s.brand}>
          <img src="/logo.svg" alt="TagGuard" className={s.brandMark} />
          <span className={s.brandName}>TagGuard</span>
          <span className={s.adminBadge}>Admin</span>
        </div>

        <h1 className={s.heading}>Admin Sign In</h1>
        <p className={s.sub}>Restricted access — authorised personnel only.</p>

        {error && <div className={s.errBanner}>{error}</div>}

        <div className={s.field}>
          <label className={s.label}>Email</label>
          <input
            className={s.input}
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <div className={s.field}>
          <label className={s.label}>Password</label>
          <input
            className={s.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>

        <button className={s.submitBtn} onClick={handleLogin} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in to Admin'}
        </button>

        <Link href="/" className={s.backLink}>← Back to TagGuard</Link>
      </div>
    </div>
  )
}
