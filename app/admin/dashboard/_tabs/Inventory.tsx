'use client'

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import s from '../admin.module.css'

interface Props { supabase: SupabaseClient }

type AllocationType = 'unallocated' | 'retailer' | 'distributor'
type InventoryTag = {
  id: string
  scan_token: string
  active: boolean
  created_at: string
  owner_phone?: string | null
  allocation?: AllocationType
  allocation_name?: string | null
}

function buildIds(qty: number, start: number): string[] {
  return Array.from({ length: qty }, (_, i) => crypto.randomUUID().toUpperCase())
}

function printQRCodes(tags: InventoryTag[], origin: string) {
  const tagData = tags.map(t => ({
    token: t.scan_token,
    url: `${origin}/scan/${t.scan_token}`,
  }))

  const html = `<!DOCTYPE html><html><head><title>TagGuard QR Codes</title>
<script src="https://unpkg.com/qr-code-styling@1.6.0-rc.1/lib/qr-code-styling.js"><\/script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Montserrat', 'Arial Black', sans-serif;
    background: #111;
    padding: 20px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
  }
  .card {
    background: #000;
    border-radius: 16px;
    padding: 16px 12px 14px;
    text-align: center;
    page-break-inside: avoid;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    border: 1px solid #1f1f1f;
  }
  .brand {
    color: #FFD700;
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  .sub {
    color: rgba(255,215,0,0.45);
    font-size: 7px;
    font-weight: 600;
    letter-spacing: 3.5px;
    text-transform: uppercase;
    margin-top: -4px;
  }
  .qr-slot {
    width: 180px;
    height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .divider {
    width: 36px;
    height: 1px;
    background: rgba(255,215,0,0.35);
    border-radius: 2px;
  }
  .tagline {
    color: #FFD700;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 1.2px;
    line-height: 1.6;
    text-transform: uppercase;
  }
  @media print {
    body { background: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 10px; }
    .grid { gap: 10px; }
  }
</style>
</head><body>
<div class="grid" id="grid">
${tagData.map((_t, i) => `
  <div class="card" id="card-${i}">
    <div class="brand">TagGuard</div>
    <div class="sub">protect · track · recover</div>
    <div class="divider"></div>
    <div class="qr-slot" id="qr-${i}"></div>
    <div class="divider"></div>
    <div class="tagline">Scan me to return me<br/>to my Owner</div>
  </div>`).join('')}
</div>
<script>
const tags = ${JSON.stringify(tagData)};
let rendered = 0;

tags.forEach((t, i) => {
  const qr = new QRCodeStyling({
    width: 180,
    height: 180,
    data: t.url,
    margin: 4,
    qrOptions: { errorCorrectionLevel: 'H' },
    backgroundOptions: { color: '#000000' },
    dotsOptions: {
      type: 'rounded',
      color: '#FFD700',
    },
    cornersSquareOptions: {
      type: 'extra-rounded',
      color: '#FFD700',
    },
    cornersDotOptions: {
      type: 'dot',
      color: '#FFD700',
    },
    imageOptions: { hideBackgroundDots: true, imageSize: 0.3, margin: 4 },
  });

  const slot = document.getElementById('qr-' + i);
  qr.append(slot);
  rendered++;
  if (rendered === tags.length) {
    // Small delay to let canvas render
    setTimeout(() => window.print(), 1200);
  }
});
<\/script>
</body></html>`

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

const ALLOCATION_LABELS: Record<AllocationType, string> = {
  unallocated: 'Unallocated',
  retailer: 'Retailer',
  distributor: 'Distributor',
}

const ALLOCATION_COLORS: Record<AllocationType, string> = {
  unallocated: '#94a3b8',
  retailer: '#3b82f6',
  distributor: '#8b5cf6',
}

export default function Inventory({ supabase }: Props) {
  /* generator */
  const [qty,          setQty]          = useState('10')
  const [allocation,   setAllocation]   = useState<AllocationType>('unallocated')
  const [allocName,    setAllocName]    = useState('')
  const [generating,   setGenerating]   = useState(false)
  const [genError,     setGenError]     = useState('')
  const [genSuccess,   setGenSuccess]   = useState('')

  /* inventory */
  const [inventory,    setInventory]    = useState<InventoryTag[]>([])
  const [filter,       setFilter]       = useState<'all' | 'unregistered' | 'registered'>('all')
  const [allocFilter,  setAllocFilter]  = useState<'all' | AllocationType>('all')
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [search,       setSearch]       = useState('')

  const loadInventory = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tags')
      .select('id, scan_token, active, created_at, owner_phone, allocation, allocation_name')
      .order('created_at', { ascending: false })
      .limit(500)

    let rows: InventoryTag[] = (data ?? [])

    if (filter === 'unregistered') rows = rows.filter(t => !t.owner_phone)
    if (filter === 'registered')   rows = rows.filter(t => !!t.owner_phone)
    if (allocFilter !== 'all')     rows = rows.filter(t => (t.allocation ?? 'unallocated') === allocFilter)

    setInventory(rows)
    setLoading(false)
  }

  useEffect(() => { loadInventory() }, [supabase, filter, allocFilter])

  const handleGenerate = async () => {
    setGenError(''); setGenSuccess('')
    const count = Math.min(Math.max(parseInt(qty) || 1, 1), 200)

    setGenerating(true)
    const rows = Array.from({ length: count }, () => ({
      id:              crypto.randomUUID().toUpperCase(),
      scan_token:      crypto.randomUUID(),
      active:          false,
      created_at:      new Date().toISOString(),
      allocation:      allocation,
      allocation_name: allocation !== 'unallocated' ? (allocName.trim() || null) : null,
      /* required DB fields — will be filled when user registers the tag */
      asset_name:      'Unregistered',
      asset_type:      'Other',
      owner_name:      null,
      owner_phone:     null,
    }))

    const { error } = await supabase.from('tags').insert(rows)
    setGenerating(false)

    if (error) {
      setGenError(`Error: ${error.message}`)
    } else {
      setGenSuccess(`✓ Generated ${count} QR codes${allocation !== 'unallocated' ? ` → ${ALLOCATION_LABELS[allocation]}${allocName ? `: ${allocName}` : ''}` : ''}`)
      setAllocName('')
      loadInventory()
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const selectAll = () => setSelected(new Set(inventory.map(t => t.id)))
  const clearAll  = () => setSelected(new Set())

  const filtered = inventory.filter(t =>
    !search ||
    t.id.toLowerCase().includes(search.toLowerCase()) ||
    (t.allocation_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const selectedTags = filtered.filter(t => selected.has(t.id))

  return (
    <div>
      {/* ── Generator ─────────────────────────── */}
      <div className={s.panel}>
        <div className={s.panelHead}>
          <span className={s.panelTitle}>Generate New QR Codes</span>
        </div>

        <div className={s.genForm}>
          <div className={s.genField}>
            <label className={s.genLabel}>Quantity (max 200)</label>
            <input
              className={s.genInput}
              type="number" min="1" max="200"
              value={qty}
              onChange={e => setQty(e.target.value)}
            />
          </div>

          <div className={s.genField}>
            <label className={s.genLabel}>Allocate To</label>
            <select
              className={s.genInput}
              value={allocation}
              onChange={e => setAllocation(e.target.value as AllocationType)}
            >
              <option value="unallocated">Unallocated</option>
              <option value="retailer">Retailer (e.g. Amazon, Flipkart)</option>
              <option value="distributor">Distributor</option>
            </select>
          </div>

          {allocation !== 'unallocated' && (
            <div className={s.genField}>
              <label className={s.genLabel}>{allocation === 'retailer' ? 'Retailer Name' : 'Distributor Name'}</label>
              <input
                className={s.genInput}
                placeholder={allocation === 'retailer' ? 'e.g. Amazon, Flipkart' : 'e.g. Distributor XYZ'}
                value={allocName}
                onChange={e => setAllocName(e.target.value)}
              />
            </div>
          )}

          <button
            className={`${s.btn} ${s.btnPrimary}`}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating…' : '⊕ Generate'}
          </button>
        </div>

        <div style={{ padding: '0 20px 8px', fontSize: 12, color: '#94a3b8' }}>
          IDs are auto-generated UUIDs (e.g. A3F2E1B0-…). Each QR links to a unique scan URL.
        </div>

        {genError   && <p style={{ padding: '10px 20px', color: '#ef4444', fontSize: 13 }}>{genError}</p>}
        {genSuccess  && <p style={{ padding: '10px 20px', color: '#059669', fontSize: 13 }}>{genSuccess}</p>}
      </div>

      {/* ── Inventory Table ────────────────────── */}
      <div className={s.panel}>
        <div className={s.panelHead}>
          <span className={s.panelTitle}>Inventory</span>
          <div className={s.toolbar} style={{ flexWrap: 'wrap', gap: 6 }}>
            <input
              className={s.searchInput}
              placeholder="Search ID or partner name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            {/* Registration filter */}
            {(['all', 'unregistered', 'registered'] as const).map(f => (
              <button
                key={f}
                className={`${s.btn} ${filter === f ? s.btnPrimary : s.btnGhost}`}
                style={{ padding: '6px 10px', fontSize: 11 }}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            {/* Allocation filter */}
            {(['all', 'unallocated', 'retailer', 'distributor'] as const).map(f => (
              <button
                key={f}
                className={`${s.btn} ${allocFilter === f ? s.btnPrimary : s.btnGhost}`}
                style={{ padding: '6px 10px', fontSize: 11 }}
                onClick={() => setAllocFilter(f)}
              >
                {f === 'all' ? 'All Alloc.' : ALLOCATION_LABELS[f as AllocationType]}
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
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={e => e.target.checked ? selectAll() : clearAll()}
                  />
                </th>
                <th className={s.th}>Tag ID (UUID)</th>
                <th className={s.th}>QR Preview</th>
                <th className={s.th}>Allocation</th>
                <th className={s.th}>Partner</th>
                <th className={s.th}>Reg. Status</th>
                <th className={s.th}>Created</th>
                <th className={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={s.loadingRow}><td colSpan={8}><div className={s.spinner} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className={s.td} colSpan={8}>
                  <div className={s.empty}>
                    <div className={s.emptyIcon}>📦</div>
                    <div className={s.emptyTitle}>No inventory yet</div>
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>Use the generator above to create QR codes.</p>
                  </div>
                </td></tr>
              ) : filtered.map(tag => {
                const scanUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/scan/${tag.scan_token}`
                const qrThumb = `https://api.qrserver.com/v1/create-qr-code/?size=44x44&bgcolor=000000&color=FFD700&data=${encodeURIComponent(scanUrl)}`
                const alloc = (tag.allocation ?? 'unallocated') as AllocationType
                return (
                  <tr key={tag.id} className={s.tr}>
                    <td className={s.td}>
                      <input type="checkbox" checked={selected.has(tag.id)} onChange={() => toggleSelect(tag.id)} />
                    </td>
                    <td className={s.td}>
                      <span className={`${s.mono} ${s.bold}`} style={{ fontSize: 10 }}>
                        {tag.id.slice(0, 18)}…
                      </span>
                    </td>
                    <td className={s.td}>
                      <div className={s.qrCell}>
                        <img src={qrThumb} alt={tag.id} className={s.qrThumb}
                          style={{ borderRadius: 4, background: '#000' }} />
                      </div>
                    </td>
                    <td className={s.td}>
                      <span className={s.badge} style={{
                        background: ALLOCATION_COLORS[alloc] + '22',
                        color: ALLOCATION_COLORS[alloc],
                        border: `1px solid ${ALLOCATION_COLORS[alloc]}44`,
                      }}>
                        {ALLOCATION_LABELS[alloc]}
                      </span>
                    </td>
                    <td className={s.td}>
                      <span className={s.muted}>{tag.allocation_name ?? '—'}</span>
                    </td>
                    <td className={s.td}>
                      <span className={`${s.badge} ${tag.active || tag.owner_phone ? s.badgeGreen : s.badgeGray}`}>
                        {tag.owner_phone ? 'Registered' : 'Unregistered'}
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
                          onClick={() => navigator.clipboard.writeText(scanUrl)}
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
