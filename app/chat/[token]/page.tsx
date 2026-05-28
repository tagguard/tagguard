'use client'
import { useEffect, useMemo, useRef, useState, use } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Message = { id: string; sender: string; content: string; created_at: string }
type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended'

export default function ChatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCallMode = searchParams.get('mode') === 'call'

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sender] = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('tg_role') || 'finder') : 'finder')
  const [tagName, setTagName] = useState('')
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [isMuted, setIsMuted] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const callChannelRef = useRef<any>(null)

  const supabase = useMemo(() => createClient(), [])
  const chatId = token

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined

    const init = async () => {
      const { data: tag } = await supabase
        .from('tags')
        .select('asset_name, id')
        .eq('scan_token', chatId)
        .single()
      if (tag) setTagName(tag.asset_name)

      const { data: existing } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at')
      setMessages(existing || [])

      channel = supabase.channel(`chat-${chatId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
          (payload) => setMessages(prev => [...prev, payload.new as Message]))
        .subscribe()
    }

    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [chatId, supabase])

  useEffect(() => {
    const callChannel = supabase.channel(`webrtc-${chatId}`, {
      config: { broadcast: { self: false } }
    })

    callChannel
      .on('broadcast', { event: 'call_offer' }, async ({ payload }) => {
        setCallStatus('incoming')
        const pc = createPC()
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: payload.sdp })
        )
      })
      .on('broadcast', { event: 'call_answer' }, async ({ payload }) => {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: payload.sdp })
          )
          setCallStatus('connected')
        }
      })
      .on('broadcast', { event: 'ice_candidate' }, async ({ payload }) => {
        if (pcRef.current && payload.candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
        }
      })
      .on('broadcast', { event: 'call_ended' }, () => {
        hangUp()
      })
      .subscribe()

    callChannelRef.current = callChannel

    if (isCallMode) {
      setTimeout(() => startCall(), 1000)
    }

    return () => { supabase.removeChannel(callChannel) }
  }, [chatId, supabase])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const createPC = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    pc.onicecandidate = (e) => {
      if (e.candidate && callChannelRef.current) {
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'ice_candidate',
          payload: { candidate: e.candidate.toJSON() }
        })
      }
    }

    pc.ontrack = (e) => {
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio()
        remoteAudioRef.current.autoplay = true
      }
      remoteAudioRef.current.srcObject = e.streams[0]
      setCallStatus('connected')
    }

    pcRef.current = pc
    return pc
  }

  const startCall = async () => {
    try {
      setCallStatus('calling')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      const pc = createPC()
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      callChannelRef.current?.send({
        type: 'broadcast',
        event: 'call_offer',
        payload: { sdp: offer.sdp }
      })
    } catch {
      alert('Could not access microphone. Please allow mic permission.')
      setCallStatus('idle')
    }
  }

  const acceptCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      if (!pcRef.current) return
      stream.getTracks().forEach(t => pcRef.current!.addTrack(t, stream))
      const answer = await pcRef.current.createAnswer()
      await pcRef.current.setLocalDescription(answer)
      callChannelRef.current?.send({
        type: 'broadcast',
        event: 'call_answer',
        payload: { sdp: answer.sdp }
      })
      setCallStatus('connected')
    } catch {
      alert('Could not access microphone.')
    }
  }

  const hangUp = () => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    callChannelRef.current?.send({
      type: 'broadcast', event: 'call_ended', payload: {}
    })
    setCallStatus('ended')
  }

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }

  const send = async () => {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    await supabase.from('messages').insert({ chat_id: chatId, sender, content: text, created_at: new Date().toISOString() })
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const CallBar = () => {
    if (callStatus === 'idle' && !isCallMode) return null

    if (callStatus === 'idle' && isCallMode) return (
      <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-center text-sm">
        Connecting...
      </div>
    )

    if (callStatus === 'calling') return (
      <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <span className="text-sm">Calling... waiting for owner to answer</span>
        <button onClick={hangUp} className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
          End Call
        </button>
      </div>
    )

    if (callStatus === 'incoming') return (
      <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
        <span className="text-sm">Finder wants to talk to you</span>
        <div className="flex gap-2">
          <button onClick={acceptCall} className="bg-white text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
            Accept
          </button>
          <button onClick={hangUp} className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
            Decline
          </button>
        </div>
      </div>
    )

    if (callStatus === 'connected') return (
      <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
        <span className="text-sm">Call connected</span>
        <div className="flex gap-2">
          <button onClick={toggleMute}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg ${isMuted ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 hover:bg-white/30'}`}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={hangUp} className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
            Hang Up
          </button>
        </div>
      </div>
    )

    if (callStatus === 'ended') return (
      <div className="bg-gray-500 text-white px-4 py-3 flex items-center justify-between">
        <span className="text-sm">Call ended</span>
        <button onClick={() => router.push(`/chat/${chatId}`)} className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
          Chat instead
        </button>
      </div>
    )

    return null
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <a href={`/scan/${chatId}`} className="text-gray-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </a>
        <div>
          <div className="font-semibold text-gray-900 text-sm">{tagName || 'TagGuard'}</div>
          <div className="text-xs text-green-500">Connected</div>
        </div>
      </div>

      <CallBar />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-10">
            <p>Say hello to start the conversation.</p>
            <p className="text-xs mt-1">The owner will be notified.</p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.sender === sender ? 'items-end' : 'items-start'}`}>
            {m.sender !== sender && (
              <p className="text-xs text-gray-400 font-medium mb-1 px-1">
                {m.sender === 'owner' ? 'Owner' : 'Finder'}
              </p>
            )}
            <div className={`text-sm leading-relaxed px-4 py-2.5 rounded-2xl max-w-[75%] ${m.sender === sender ? 'bg-blue-600 text-white' : 'bg-white text-gray-900 border border-gray-100'}`}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white border-t border-gray-100 px-4 py-3 flex gap-2 items-end">
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder="Type a message..." rows={1}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={send} disabled={!input.trim()}
          className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M16 9L2 2l2.5 7L2 16l14-7z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </main>
  )
}
