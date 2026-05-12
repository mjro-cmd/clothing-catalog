// Run with: node scripts/count-bg-status.mjs
// Requires AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME in .env.local
// Or set them inline: AIRTABLE_API_KEY=... node scripts/count-bg-status.mjs

import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
  try {
    const lines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) process.env[match[1].trim()] = match[2].trim()
    }
  } catch {}
}

loadEnv()

const API_KEY   = process.env.AIRTABLE_API_KEY
const BASE_ID   = process.env.AIRTABLE_BASE_ID
const TABLE     = process.env.AIRTABLE_TABLE_NAME

if (!API_KEY || !BASE_ID || !TABLE) {
  console.error('Missing AIRTABLE_API_KEY, AIRTABLE_BASE_ID, or AIRTABLE_TABLE_NAME')
  process.exit(1)
}

let records = []
let offset  = null

do {
  const params = new URLSearchParams({ pageSize: '100' })
  if (offset) params.append('offset', offset)

  const resp = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}?${params}`,
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  )
  if (!resp.ok) throw new Error(`Airtable error ${resp.status}: ${await resp.text()}`)

  const data = await resp.json()
  records = records.concat(data.records)
  offset  = data.offset || null
} while (offset)

let done = 0, needsProcessing = 0, noPhoto = 0
const toProcess = []

for (const r of records) {
  const photo = r.fields['Photo']
  if (!photo || photo.length === 0) {
    noPhoto++
  } else if (photo[0].filename === 'photo-nobg.png') {
    done++
  } else {
    needsProcessing++
    toProcess.push({ id: r.id, filename: photo[0].filename })
  }
}

console.log(`Total records:                  ${records.length}`)
console.log(`Already processed (nobg):       ${done}`)
console.log(`Needs background removal:       ${needsProcessing}`)
console.log(`No photo:                       ${noPhoto}`)

if (toProcess.length > 0) {
  console.log('\nEntries needing processing:')
  toProcess.forEach(e => console.log(`  ${e.id}  ${e.filename}`))
}
