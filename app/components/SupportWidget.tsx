'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import s from './SupportWidget.module.css'

/* ── Headset icon ───────────────────────────────── */
function HeadsetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 9V8a6 6 0 0112 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="1" y="9" width="3" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="12" y="9" width="3" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  )
}

/* ── Modal ──────────────────────────────────────── */
function SupportModal({ onClose, context }: { onClose: () => void; context: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [err,     setErr]     = useState('')

  const handleSubmit = async () => {
    if (!message.trim()) { setErr('Please enter your message.'); return }
    setLoading(true); setErr('')
    const { error } = await supabase.from('support_messages').insert({
      name:       name.trim()    || null,
      email:      email.trim()   || null,
      message:    message.trim(),
      context,
      created_at: new Date().toISOString(),
    })
    setLoading(false)
    if (error) { setErr('Could not send — please try again.'); return }
    setDone(true)
  }

  const handleClose = () => {
    setName(''); setEmail(''); setMessage('')
    setDone(false); setErr('')
    onClose()
  }

  return (
    <div className={s.overlay} onMouseDown={e => e.target === e.currentTarget && handleClose()}>
      <div className={s.modal} role="dialog" aria-modal="true" aria-label="Message customer care">

        <div className={s.modalHeader}>
          <span className={s.modalTitle}>Message customer care</span>
          <button className={s.modalClose} onClick={handleClose} aria-label="Close">×</button>
        </div>

        {done ? (
          <div className={s.success}>
            <div className={s.successIcon}>✓</div>
            <p className={s.successTitle}>Message sent!</p>
            <p className={s.successSub}>
              We've received your message and will get back to you as soon as possible.
            </p>
            <button className={s.submitBtn} onClick={handleClose}>Close</button>
          </div>
        ) : (
          <div className={s.modalBody}>
            <div className={s.field}>
              <label className={s.label}>
                Name <span className={s.opt}>(optional)</span>
              </label>
              <input
                className={s.input}
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className={s.field}>
              <label className={s.label}>
                Email <span className={s.opt}>(optional — so we can reply)</span>
              </label>
              <input
                className={s.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className={s.field}>
              <label className={s.label}>Message *</label>
              <textarea
                className={s.textarea}
                rows={4}
                placeholder="How can we help you?"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            {err && <p className={s.errMsg}>{err}</p>}

            <button
              className={s.submitBtn}
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
            >
              {loading ? 'Sending…' : 'Send message'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Public widget ──────────────────────────────── */
export type SupportVariant = 'inline' | 'link' | 'floating'

interface SupportWidgetProps {
  label?:   string
  variant?: SupportVariant
  context?: string
  className?: string
}

export default function SupportWidget({
  label   = 'Message customer care',
  variant = 'inline',
  context = 'general',
  className,
}: SupportWidgetProps) {
  const [open, setOpen] = useState(false)

  const btnClass =
    variant === 'link'     ? s.btnLink    :
    variant === 'floating' ? s.btnFloat   :
    s.btnInline

  return (
    <>
      <button
        className={`${btnClass}${className ? ' ' + className : ''}`}
        onClick={() => setOpen(true)}
      >
        {variant !== 'link' && <HeadsetIcon />}
        {label}
      </button>

      {open && <SupportModal onClose={() => setOpen(false)} context={context} />}
    </>
  )
}
