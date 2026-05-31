'use client'

import { useEffect, useState } from 'react'

/* Detects if already installed as PWA */
function isInstalled() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

export default function PWAInstallBanner() {
  const [prompt, setPrompt]   = useState<any>(null)
  const [show,   setShow]     = useState(false)
  const [isIOS,  setIsIOS]    = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installed,  setInstalled]  = useState(false)

  useEffect(() => {
    /* Don't show if already installed */
    if (isInstalled()) return

    /* Don't show if dismissed in last 7 days */
    const dismissed = localStorage.getItem('pwa_dismissed')
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return

    /* iOS detection (Safari doesn't fire beforeinstallprompt) */
    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
    setIsIOS(ios)

    if (ios) {
      /* Show iOS instructions after short delay */
      setTimeout(() => setShow(true), 1500)
      return
    }

    /* Android/Chrome — capture beforeinstallprompt */
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setTimeout(() => setShow(true), 1500)
    }
    window.addEventListener('beforeinstallprompt', handler)

    /* Register service worker */
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    setInstalling(true)
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
      setShow(false)
    } else {
      setInstalling(false)
    }
    setPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa_dismissed', Date.now().toString())
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 9999,
      padding: '0 12px 12px',
      animation: 'slideUp .35s ease',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div style={{
        background: '#07111f',
        borderRadius: 18,
        padding: '16px 18px',
        boxShadow: '0 -2px 32px rgba(0,0,0,.35), 0 8px 40px rgba(0,0,0,.25)',
        border: '1px solid rgba(255,255,255,.07)',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}>
        {/* Icon */}
        <img
          src="/icon-192.png"
          alt="TagGuard"
          style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }}
        />

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
            Install TagGuard
          </div>

          {isIOS ? (
            <div style={{ color: '#94a3b8', fontSize: 12.5, lineHeight: 1.5 }}>
              Tap <strong style={{ color: '#fff' }}>Share</strong> <span style={{ fontSize: 14 }}>⎋</span> then{' '}
              <strong style={{ color: '#fff' }}>Add to Home Screen</strong> to get instant alerts when your item is found.
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 12.5, lineHeight: 1.5 }}>
              Get notified instantly when someone finds your lost item. Works offline too.
            </div>
          )}

          {!isIOS && (
            <button
              onClick={handleInstall}
              disabled={installing}
              style={{
                marginTop: 10,
                background: '#185FA5',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              {installing ? 'Installing…' : '📲 Add to Home Screen'}
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          style={{
            background: 'rgba(255,255,255,.07)',
            border: 'none',
            borderRadius: 8,
            color: '#94a3b8',
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, flexShrink: 0,
          }}
        >✕</button>
      </div>
    </div>
  )
}
