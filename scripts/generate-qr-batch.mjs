import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function generateBatch(startNum, count) {
  console.log(`Generating ${count} tags starting from TG${String(startNum).padStart(4,'0')}`)

  const tags = []
  for (let i = startNum; i < startNum + count; i++) {
    const id = 'TG' + String(i).padStart(4, '0')
    const scanToken = crypto.randomUUID()
    tags.push({
      id,
      scan_token: scanToken,
      asset_name: 'Unregistered',
      active: false
    })
  }

  const { error } = await supabase.from('tags').insert(tags)
  if (error) {
    console.error('Supabase insert error:', error.message)
    return
  }
  console.log(`Inserted ${count} tags into Supabase`)

  let htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>TagGuard QR Batch TG${String(startNum).padStart(4,'0')} - TG${String(startNum+count-1).padStart(4,'0')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; }
  .page {
    width: 210mm; padding: 10mm;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4mm;
    page-break-after: always;
  }
  .tag {
    border: 1px dashed #ccc; border-radius: 6px;
    padding: 4px; text-align: center;
  }
  .tag img { width: 100%; height: auto; display: block; }
  .tag-id {
    font-size: 9px; font-weight: bold;
    color: #185FA5; margin-top: 2px;
  }
  .tag-brand {
    font-size: 8px; color: #333; margin-top: 1px;
  }
  @media print {
    body { margin: 0; }
    .page { page-break-after: always; }
  }
</style>
</head>
<body>`

  for (let p = 0; p < tags.length; p += 50) {
    htmlContent += '<div class="page">'
    const pageTags = tags.slice(p, p + 50)
    for (const tag of pageTags) {
      const url = `${BASE_URL}/scan/${tag.scan_token}`
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300, margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      })
      htmlContent += `
      <div class="tag">
        <img src="${qrDataUrl}" alt="${tag.id}"/>
        <div class="tag-id">${tag.id}</div>
        <div class="tag-brand">TagGuard</div>
      </div>`
    }
    htmlContent += '</div>'
  }

  htmlContent += '</body></html>'

  const filename = `qr-batch-TG${String(startNum).padStart(4,'0')}-TG${String(startNum+count-1).padStart(4,'0')}.html`
  writeFileSync(filename, htmlContent)
  console.log(`\nDone! Open this file in your browser and print:`)
  console.log(filename)
  console.log(`\nPrint settings: A4, no margins, use sticker paper`)
}

const startNum = parseInt(process.argv[2] || '1')
const count = parseInt(process.argv[3] || '1000')
generateBatch(startNum, count)
