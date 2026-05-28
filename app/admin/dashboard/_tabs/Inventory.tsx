'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import s from '../admin.module.css'

interface Props { supabase: SupabaseClient }

type InventoryTag = { id: string; scan_token: string; active: boolean; created_at: string }

function buildPreview(prefix: string, start: number, qty: number): string[] {
  const pad = String(start + qty - 1).length
  return Array.from({ length: qty }, (_, i) =>
    `${prefix.toUpperCase()}${String(start + i).padStart(Math.max(pad, 3), '0')}`
  )
}

function printQRCodes(tags: InventoryTag[], origin: string) {
  const html = `<!DOCTYPE html><html><head><title>TagGuard QR Codes</title>
<style>
  body { font-family: sans-serif; margin: 0; background: #fff; }
  h1   { text-align: center; font-size: 18px; margin: 20px 0 10px; color: #07111f; }
  .grid{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; padding: 20px; }
  .item{ text-align: center; page-break-inside: avoid; }
  .item img { width: 160px; height: 160px; }
  .item .id  { font-weight: 800; font-size: 13px; margin: 4px 0 2px; font-family: monospace; }
  .item .url { font-size: 9px; color: #94a3b8; word-break: break-all; }
  @media print { h1 { display: none; } }
</style></head><body>
<h1>TagGuard Inventory — ${tags.length} QR Codes</h1>
<div class="grid">
${tags.map(t => {
  const url = `${origin}/scan/${t.scan_token}`
  const qr  = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`
  return `<div class="item">
    <img src="${qr}" alt="${t.id}" />
    <div class="id">${t.id}</div>
    <div class="url">${url}</div>
  </div>`
}).join('\n')}
</div>
<script>window.onload = () => window.print()</script>
</body></html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

export default function Inventory({ supabase }: Props) {
  /* generator state */
  const [prefix,    setPrefix]    = useState('TG')
  const [startNum,  setStartNum]  = useState('1')
  const [qty,       setQty]       = useState('10')
  const [generating, setGenerating] = useState(false)
  const [genError,  setGenError]  = useState('')
  const [genSuccess, setGenSuccess] = useState('')

  /* inventory state */
  const [inventory, setInventory] = useState<InventoryTag[]>([])
  const [filter,    setFilter]    = useState<'all' | 'unregistered' | 'registered'>('all')
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<Set<string>>(new Set())

  const preview = buildPreview(prefix, parseInt(startNum) || 1, Math.min(parseInt(qty) || 1, 200))

  const loadInventory = async () => {
    setLoading(true)
    let q = supabase
      .from('tags')
      .select('id, scan_token, active, created_at, owner_phone')
      .order('created_at', { ascending: false })
      .limit(500)

    const { data } = await q
    setInventory(
      (data ?? []).filter(t =>
        filter === 'all'           ? true :
        filter === 'unregistered'  ? !(t as any).owner_phone :
        !!(t as any).owner_phone
      )
    )
    setLoading(false)
  }

  useEffect(() => { loadInventory() }, [supabase, filter])

  const handleGenerate = async () => {
    setGenError(''); setGenSuccess('')
    const start = parseInt(startNum) || 1
    const count = Math.min(parseInt(qty) || 1, 200)
    if (count < 1) { setGenError('Quantity must be at least 1.'); return }

    setGenerating(true)
    const ids = buildPreview(prefix, start, count)
    const rows = ids.map(id => ({
      id,
      scan_token:  crypto.randomUUID(),
      active:      false,
      created_at:  new Date().toISOString(),
    }))

    const { error } = await supabase.from('tags').insert(rows)
    setGenerating(false)

    if (error) {
      setGenError(`Error: ${error.message}`)
    } else {
      setGenSuccess(`✓ Generated ${count} QR codes (${ids[0]} → ${ids[ids.length - 1]})`)
      loadInventory()
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const selectAll = () => setSelected(new Set(inventory.map(t => t.id)))
  const clearAll  = () => setSelected(new Set())

  const selectedTags = inventory.filter(t => selected.has(t.id))

  return (
    <div>
      {/* Generator */}
      <div className={s.panel}>
        <div className={s.panelHead}>
          <span className={s.panelTitle}>Generate New QR Codes</span>
        </div>

        <div className={s.genForm}>
          <div className={s.genField}>
            <label className={s.genLabel}>Prefix</label>
            <input className={s.genInput} value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} placeholder="TG" maxLength={6} />
          </div>
          <div className={s.genField}>
            <label className={s.genLabel}>Start Number</label>
            <input className={s.genInput} type="number" min="1" value={startNum} onChange={e => setStartNum(e.target.value)} />
          </div>
          <div className={s.genField}>
            <label className={s.genLabel}>Quantity (max 200)</label>
            <input className={s.genInput} type="number" min="1" max="200" value={qty} onChange={e => setQty(e.target.value)} />
          </div>
          <button
            className={`${s.btn} ${s.btnPrimary}`}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating…' : '⊕ Generate'}
          </button>
        </div>

        {preview.length > 0 && (
          <div className={s.previewGrid}>
            {preview.map(id => <span key={id} className={s.previewChip}>{id}</span>)}
          </div>
        )}

        {genError   && <p style={{ padding: '10px 20px', color: '#ef4444', fontSize: 13 }}>{genError}</p>}
        {genSuccess  && <p style={{ padding: '10px 20px', color: '#059669', fontSize: 13 }}>{genSuccess}</p>}
      </div>

      {/* Inventory table */}
      <div className={s.panel}>
        <div className={s.panelHead}>
          <span className={s.panelTitle}>Inventory</span>
          <div className={s.toolbar}>
            {/* Filter tabs */}
            {(['all', 'unregistered', 'registered'] as const).map(f => (
              <button
                key={f}
                className={`${s.btn} ${filter === f ? s.btnPrimary : s.btnGhost}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}

            {selected.size > 0 && (
              <button
                className={`${s.btn} ${s.btnDark}`}
                onClick={() => printQRCodes(selectedTags, window.location.origin)}
              >
                🖨 Print {selected.size} QR{selected.size > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th className={s.th}>
                  <input type="checkbox"
                    checked={selected.size === inventory.length && inventory.length > 0}
                    onChange={e => e.target.checked ? selectAll() : clearAll()}
                  />
                </th>
                <th className={s.th}>Tag ID</th>
                <th className={s.th}>QR Code</th>
                <th className={s.th}>Scan URL</th>
                <th className={s.th}>Status</th>
                <th className={s.th}>Created</th>
                <th className={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={s.loadingRow}><td colSpan={7}><div className={s.spinner} /></td></tr>
              ) : inventory.length === 0 ? (
                <tr><td className={s.td} colSpan={7}>
                  <div className={s.empty}>
                    <div className={s.emptyIcon}>📦</div>
                    <div className={s.emptyTitle}>No inventory yet</div>
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>Use the generator above to create QR codes.</p>
                  </div>
                </td></tr>
              ) : inventory.map(tag => {
                const scanUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/scan/${tag.scan_token}`
                const qrThumb = `https://api.qrserver.com/v1/create-qr-code/?size=44x44&data=${encodeURIComponent(scanUrl)}`
                return (
                  <tr key={tag.id} className={s.tr}>
                    <td className={s.td}>
                      <input type="checkbox" checked={selected.has(tag.id)} onChange={() => toggleSelect(tag.id)} />
                    </td>
                    <td className={s.td}><span className={`${s.mono} ${s.bold}`}>{tag.id}</span></td>
                    <td className={s.td}>
                      <div className={s.qrCell}>
                        <img src={qrThumb} alt={tag.id} className={s.qrThumb} />
                      </div>
                    </td>
                    <td className={s.td}>
                      <span className={`${s.mono} ${s.muted}`} style={{ fontSize: 11 }}>
                        /scan/{tag.scan_token.slice(0, 12)}…
                      </span>
                    </td>
                    <td className={s.td}>
                      <span className={`${s.badge} ${tag.active ? s.badgeGreen : s.badgeGray}`}>
                        {tag.active ? 'Registered' : 'Unregistered'}
                      </span>
                    </td>
                    <td className={s.td}>
                      <span className={s.muted}>{new Date(tag.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className={s.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className={`${s.btn} ${s.btnGhost}`}
                          style={{ padding: '5px 10px', fontSize: 11 }}
                          onClick={() => printQRCodes([tag], window.location.origin)}
                        >
                          🖨 Print
                        </button>
                        <button
                          className={`${s.btn} ${s.btnGhost}`}
                          style={{ padding: '5px 10px', fontSize: 11 }}
                          onClick={() => { navigator.clipboard.writeText(scanUrl) }}
                        >
                          Copy URL
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
