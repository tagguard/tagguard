'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type ScanStatus = 'idle' | 'checking' | 'found' | 'unregistered' | 'error'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()
  const [scanning, setScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const jsQRRef = useRef<any>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
    return () => { stopScan() }
  }, [])

  const stopScan = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  const handleScanned = async (decoded: string) => {
    stopScan()
    setScanStatus('checking')
    const match = decoded.match(/\/scan\/([a-f0-9-]{36})$/i)
    const token = match ? match[1] : null
    if (!token) {
      setScanStatus('error')
      setStatusMsg('This does not look like a TagGuard QR code.')
      return
    }
    const { data } = await supabase
      .from('tags')
      .select('id, active, owner_name, asset_name')
      .eq('scan_token', token)
      .single()
    if (!data) {
      setScanStatus('error')
      setStatusMsg('QR code not found in our system.')
      return
    }
    if (data.active && data.owner_name) {
      setScanStatus('found')
      setStatusMsg('Tag found! Taking you there...')
      setTimeout(() => router.push(`/scan/${token}`), 1200)
    } else {
      setScanStatus('unregistered')
      setStatusMsg("Unregistered tag. Let's set it up!")
      setTimeout(() => router.push(`/register?token=${token}`), 1200)
    }
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
          handleScanned(result.data)
          return
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame)
  }

  const startScan = async () => {
    setScanStatus('idle')
    setStatusMsg('')
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
      setScanning(false)
      setScanStatus('error')
      setStatusMsg('Camera access denied. Please allow camera permission.')
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <nav className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <span className="font-semibold text-gray-900 text-lg">TagGuard</span>
        <Link href="/dashboard" className="text-sm text-blue-600 font-medium">My Tags →</Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="#185FA5" strokeWidth="2"/>
            <rect x="18" y="2" width="12" height="12" rx="2" stroke="#185FA5" strokeWidth="2"/>
            <rect x="2" y="18" width="12" height="12" rx="2" stroke="#185FA5" strokeWidth="2"/>
            <rect x="18" y="18" width="4" height="4" fill="#185FA5"/>
            <rect x="26" y="18" width="4" height="4" fill="#185FA5"/>
            <rect x="18" y="26" width="4" height="4" fill="#185FA5"/>
            <rect x="26" y="26" width="4" height="4" fill="#185FA5"/>
          </svg>
        </div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-3">Your lost item, found.</h1>
        <p className="text-gray-500 text-lg mb-8 max-w-sm">Smart QR tags for everything you own. When someone finds it, they reach you instantly.</p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={startScan}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium text-base hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="white" strokeWidth="1.5"/>
              <rect x="13" y="1" width="6" height="6" rx="1" stroke="white" strokeWidth="1.5"/>
              <rect x="1" y="13" width="6" height="6" rx="1" stroke="white" strokeWidth="1.5"/>
              <rect x="13" y="13" width="2" height="2" fill="white"/>
              <rect x="17" y="13" width="2" height="2" fill="white"/>
              <rect x="13" y="17" width="2" height="2" fill="white"/>
              <rect x="17" y="17" width="2" height="2" fill="white"/>
            </svg>
            Scan QR code
          </button>
          <Link href="/register"
            className="border border-gray-200 text-gray-700 px-8 py-3 rounded-xl font-medium text-base hover:bg-gray-50 transition-colors text-center">
            Register a tag
          </Link>
        </div>
        <p className="text-gray-400 text-sm mt-4">No app download needed for finders</p>
      </div>

      <div className="px-6 pb-12 grid grid-cols-3 gap-4 max-w-lg mx-auto w-full">
        {[
          { step: '1', title: 'Stick', desc: 'Attach tag to your item' },
          { step: '2', title: 'Register', desc: 'Set up in 30 seconds' },
          { step: '3', title: 'Relax', desc: 'Get notified if found' },
        ].map(s => (
          <div key={s.step} className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold mx-auto mb-2">{s.step}</div>
            <div className="font-medium text-gray-900 text-sm">{s.title}</div>
            <div className="text-gray-400 text-xs mt-1">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Scanner overlay */}
      {scanning && (
        <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50 px-6">
          <div className="relative bg-black rounded-2xl overflow-hidden w-full max-w-xs" style={{ minHeight: 320 }}>
            <video ref={videoRef} className="w-full object-cover" style={{ minHeight: 320 }} muted playsInline />
            <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-white" />
            <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-white" />
            <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-white" />
            <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-white" />
          </div>
          <p className="text-white text-sm mt-4">Point camera at the QR sticker</p>
          <button onClick={stopScan} className="mt-3 text-white/70 text-sm underline">Cancel</button>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Scan result overlay */}
      {!scanning && scanStatus !== 'idle' && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
          onClick={() => { if (scanStatus === 'error') setScanStatus('idle') }}
        >
          <div className={`rounded-2xl px-8 py-5 text-center text-sm font-medium min-w-[220px] ${
            scanStatus === 'found' ? 'bg-green-500 text-white' :
            scanStatus === 'unregistered' ? 'bg-amber-400 text-amber-900' :
            scanStatus === 'checking' ? 'bg-white text-gray-700' :
            'bg-red-500 text-white'
          }`}>
            {scanStatus === 'checking' ? 'Checking...' : statusMsg}
            {scanStatus === 'error' && <p className="text-xs mt-1 opacity-75">Tap to dismiss</p>}
          </div>
        </div>
      )}
    </main>
  )
}
