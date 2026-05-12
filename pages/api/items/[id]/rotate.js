import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import sharp from 'sharp'
import { put, del } from '@vercel/blob'

const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME)}`
const AIRTABLE_HEADERS  = {
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  const { photoUrl, degrees } = req.body

  if (!photoUrl || !degrees) return res.status(400).json({ error: 'photoUrl and degrees required' })

  let blobUrl = null

  try {
    // 1. Fetch original image
    const imgResp = await fetch(photoUrl)
    if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`)
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer())

    // 2. Rotate with sharp
    const rotated = await sharp(imgBuffer).rotate(degrees).jpeg().toBuffer()

    // 3. Upload to Vercel Blob to get a public URL
    const blob = await put(`rotated-${id}-${Date.now()}.jpg`, rotated, {
      access: 'public',
      contentType: 'image/jpeg',
    })
    blobUrl = blob.url

    // 4. PATCH Airtable with the public URL (Airtable downloads and stores it)
    const patchResp = await fetch(`${AIRTABLE_BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: AIRTABLE_HEADERS,
      body: JSON.stringify({
        fields: { Photo: [{ url: blobUrl, filename: 'photo-rotated.jpg' }] },
      }),
    })
    if (!patchResp.ok) throw new Error(`Airtable PATCH failed: ${await patchResp.text()}`)

    // 5. Fetch updated record to get the Airtable-hosted URL
    const recordResp = await fetch(`${AIRTABLE_BASE_URL}/${id}`, {
      headers: { 'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}` },
    })
    const record = await recordResp.json()
    const newPhotoUrl = record.fields?.Photo?.[0]?.url || blobUrl

    // 6. Clean up the temporary blob
    await del(blobUrl)

    return res.status(200).json({ success: true, photoUrl: newPhotoUrl })
  } catch (err) {
    console.error('rotate error:', err)
    // Clean up blob if Airtable update failed
    if (blobUrl) await del(blobUrl).catch(() => {})
    return res.status(500).json({ error: err.message })
  }
}

export const config = { api: { bodyParser: { sizeLimit: '20mb' }, responseLimit: false } }
