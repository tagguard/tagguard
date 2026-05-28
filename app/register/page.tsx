'use client'
import { useState, useRef, useEffect, useMemo, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenFromScan = searchParams.get('token')
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [registeredTagId, setRegisteredTagId] = useState('')
  const [registeredScanToken, setRegisteredScanToken] = useState('')
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({
    tag_id: '', asset_name: '', asset_type: 'Bag',
    message_to_finder: "Hi! You've found my item. Please tap Chat to reach me — happy to reward you.",
    owner_name: '', owner_phone: '', privacy: 'chat_only'
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const jsQRRef = useRef<any>(null)

  // Pre-fill tag ID when arriving from QR scan
  useEffect(() => {
    if (!tokenFromScan) return
    const fetchTag = async () => {
      const { data } = await supabase
        .from('tags')
        .select('id')
        .eq('scan_token', tokenFromScan)
        .single()
      if (data) {
        setForm(f => ({ ...f, tag_id: data.id }))
      }
    }
    fetchTag()
  }, [tokenFromScan])

  const stopScan = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  const scanFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const jsQR = jsQRRef.current
    if (!video || !canvas || !jsQR) return
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(img.data, img.width, img.height)
        if (result) {
          const raw = result.data
          // UUID scan tokens contain hyphens — must include [-] in character class
          const match = raw.match(/\/scan\/([\w-]+)$/i)
          const tagId = match ? match[1].toUpperCase() : raw.trim().toUpperCase()
          setForm(f => ({ ...f, tag_id: tagId }))
          stopScan()
          return
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame)
  }

  const startScan = async () => {
    setScanError('')
    setScanning(true)
    try {
      if (!jsQRRef.current) {
        const mod = await import('jsqr')
        jsQRRef.current = mod.default
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: 640, height: 480 }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scanFrame()
      }
    } catch {
      setScanError('Camera access denied. Please allow camera permission and try again.')
      setScanning(false)
    }
  }

  useEffect(() => {
    return () => { stopScan() }
  }, [])

  const handleSubmit = async () => {
    if (!form.tag_id || !form.asset_name || !form.owner_phone) {
      alert('Please fill in Tag ID, item name, and your phone number')
      return
    }
    setLoading(true)

    if (tokenFromScan) {
      /* ── Security: verify tag is NOT already registered ── */
      const { data: existingCheck } = await supabase
        .from('tags')
        .select('id, active, owner_phone')
        .eq('scan_token', tokenFromScan)
        .maybeSingle()

      if (!existingCheck) {
        setLoading(false)
        alert('Invalid tag. Please contact support.')
        return
      }
      if (existingCheck.active || existingCheck.owner_phone) {
        setLoading(false)
        alert('This tag is already registered. Contact support if it belongs to you.')
        return
      }

      const { error } = await supabase
        .from('tags')
        .update({
          asset_name: form.asset_name,
          asset_type: form.asset_type,
          message_to_finder: form.message_to_finder,
          owner_name: form.owner_name,
          owner_phone: form.owner_phone,
          privacy: form.privacy,
          active: true
        })
        .eq('scan_token', tokenFromScan)
        .eq('active', false)   // extra guard: never overwrite an active tag
      setLoading(false)
      if (error) { alert('Error: ' + error.message); return }
      setRegisteredTagId(form.tag_id.toUpperCase().trim())
      setRegisteredScanToken(tokenFromScan)
      setDone(true)
    } else {
      /* ── Security: look up tag in admin inventory first ── */
      const { data: inventoryTag } = await supabase
        .from('tags')
        .select('id, scan_token, active, owner_phone')
        .eq('id', form.tag_id.toUpperCase().trim())
        .maybeSingle()

      if (!inventoryTag) {
        setLoading(false)
        alert('Tag ID not found in our system. Please check the ID printed on your sticker and try again.')
        return
      }
      if (inventoryTag.active || inventoryTag.owner_phone) {
        setLoading(false)
        alert('This tag is already registered. Contact support if it belongs to you.')
        return
      }

      /* Use the existing scan_token created by admin — never create a new one */
      const { error } = await supabase.from('tags').update({
        asset_name: form.asset_name,
        asset_type: form.asset_type,
        message_to_finder: form.message_to_finder,
        owner_name: form.owner_name,
        owner_phone: form.owner_phone,
        privacy: form.privacy,
        active: true,
      }).eq('id', inventoryTag.id).eq('active', false)  // extra guard

      setLoading(false)
      if (error) { alert('Error: ' + error.message); return }
      setRegisteredTagId(inventoryTag.id)
      setRegisteredScanToken(inventoryTag.scan_token)
      setDone(true)
    }
  }

  const handleCopy = () => {
    const url = `${window.location.origin}/scan/${registeredScanToken}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (done) {
    const scanUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/scan/${registeredScanToken}`
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 16l8 8 12-12" stroke="#3B6D11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Tag activated!</h2>

        <div className="w-full max-w-sm text-left mt-4 mb-6 space-y-4">
          <div className="bg-blue-50 rounded-2xl p-5">
            <p className="text-sm font-semibold text-blue-900 mb-2">Your QR code URL</p>
            <p className="font-mono text-xs text-blue-800 bg-white rounded-lg px-3 py-2 border border-blue-100 break-all mb-3">{scanUrl}</p>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <a
                href="https://qr-code-monkey.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center border border-blue-200 text-blue-700 py-2 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors">
                Generate QR code
              </a>
            </div>
            <p className="text-xs text-blue-700 mt-3">Use this URL to generate your QR sticker. Keep it private — this is what your finder will see.</p>
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">Your tag ID (for your dashboard only)</p>
            <p className="font-mono font-semibold text-gray-800">{registeredTagId}</p>
          </div>
        </div>

        <button onClick={() => { setDone(false); setCopied(false); setForm({...form, tag_id: ''}) }} className="text-blue-600 font-medium">Register another tag</button>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white px-6 py-4 border-b border-gray-100">
        <span className="font-semibold text-gray-900">Register a tag</span>
      </nav>
      <div className="max-w-lg mx-auto px-6 py-8 space-y-4">
        {tokenFromScan && form.tag_id ? (
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
            Setting up tag <span className="font-mono font-semibold">{form.tag_id}</span> — just fill in your details below
          </div>
        ) : (
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
            Your Tag ID is printed on your sticker (e.g. TG001). Enter it below or scan the QR code.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tag ID *</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.tag_id}
              onChange={e => !tokenFromScan && setForm({...form, tag_id: e.target.value})}
              readOnly={!!tokenFromScan}
              placeholder="e.g. TG001"
              className={`flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none ${tokenFromScan ? 'opacity-60 cursor-default' : 'focus:ring-2 focus:ring-blue-500'}`}
            />
            {!tokenFromScan && (
              <button
                type="button"
                onClick={scanning ? stopScan : startScan}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors whitespace-nowrap bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="10" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="1" y="10" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="10" y="10" width="2" height="2" fill="currentColor"/>
                  <rect x="14" y="10" width="2" height="2" fill="currentColor"/>
                  <rect x="10" y="14" width="2" height="2" fill="currentColor"/>
                  <rect x="14" y="14" width="2" height="2" fill="currentColor"/>
                </svg>
                {scanning ? 'Cancel' : 'Scan QR'}
              </button>
            )}
          </div>

          {scanError && (
            <p className="mt-2 text-sm text-red-600">{scanError}</p>
          )}

          {!scanning && form.tag_id && !tokenFromScan && (
            <div className="mt-2 flex items-center gap-1.5 text-green-700 text-sm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Scanned: <span className="font-mono font-semibold">{form.tag_id}</span>
            </div>
          )}

          {scanning && (
            <div className="mt-3">
              <div className="relative bg-black rounded-xl overflow-hidden" style={{ height: 280 }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[200px] h-[200px] border-2 border-white rounded-lg" />
                </div>
              </div>
              <p className="text-center text-xs text-gray-400 mt-2">Point camera at QR code on sticker</p>
              <button
                type="button"
                onClick={stopScan}
                className="mt-2 w-full border border-gray-200 text-gray-600 py-2 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>

        {[
          { label: 'Item name *', key: 'asset_name', placeholder: 'e.g. My blue backpack', type: 'text' },
          { label: 'Your name', key: 'owner_name', placeholder: 'e.g. Priya', type: 'text' },
          { label: 'Your WhatsApp number *', key: 'owner_phone', placeholder: '+91 98765 43210', type: 'tel' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
            <input type={f.type} value={(form as any)[f.key]}
              onChange={e => setForm({...form, [f.key]: e.target.value})}
              placeholder={f.placeholder}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item type</label>
          <select value={form.asset_type} onChange={e => setForm({...form, asset_type: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {['Bag','Wallet','Keys','Passport','Certificate','Laptop','Pet collar','Other'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message to finder</label>
          <textarea rows={3} value={form.message_to_finder}
            onChange={e => setForm({...form, message_to_finder: e.target.value})}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          {loading ? 'Activating...' : 'Activate tag'}
        </button>
      </div>
    </main>
  )
}

export default function Register() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <RegisterForm />
    </Suspense>
  )
}
