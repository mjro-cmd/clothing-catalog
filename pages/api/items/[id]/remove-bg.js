import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'

const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_NAME}`
const AIRTABLE_HEADERS  = {
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
}

const REMBG_VERSION = 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003'

async function removeBg(imageUrl) {
  // Start prediction using versioned endpoint
  const resp = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait',
    },
    body: JSON.stringify({ version: REMBG_VERSION, input: { image: imageUrl } }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Replicate error ${resp.status}: ${err}`)
  }

  const prediction = await resp.json()

  // If it didn't finish in time, poll until done
  let result = prediction
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise((r) => setTimeout(r, 1500))
    const poll = await fetch(result.urls.get, {
      headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    })
    result = await poll.json()
  }

  if (result.status === 'failed') throw new Error('Background removal failed')
  return result.output // URL of the processed PNG
}

async function updateAirtablePhoto(recordId, photoUrl) {
  const resp = await fetch(`${AIRTABLE_BASE_URL}/${recordId}`, {
    method: 'PATCH',
    headers: AIRTABLE_HEADERS,
    body: JSON.stringify({
      fields: { Photo: [{ url: photoUrl, filename: 'photo-nobg.png' }] },
    }),
  })
  if (!resp.ok) throw new Error(`Airtable update failed: ${await resp.text()}`)
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  const { photoUrl } = req.body

  if (!photoUrl) return res.status(400).json({ error: 'photoUrl required' })

  try {
    const cleanedUrl = await removeBg(photoUrl)
    await updateAirtablePhoto(id, cleanedUrl)
    // Return the Replicate URL directly — Airtable takes a few seconds
    // to re-host the image so fetching the record immediately would
    // return the old URL. ISR revalidation (60s) will pick up the
    // Airtable-hosted version once Airtable has finished processing.
    res.status(200).json({ success: true, photoUrl: cleanedUrl })
  } catch (err) {
    console.error('remove-bg error:', err)
    res.status(500).json({ error: err.message })
  }
}

// Background removal can take up to 60s — extend Next.js timeout
export const config = { api: { responseLimit: false } }
