import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import sharp from 'sharp'

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

  try {
    // Fetch the original image
    const imgResp = await fetch(photoUrl)
    if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`)
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer())

    // Rotate with sharp
    const rotated = await sharp(imgBuffer).rotate(degrees).toBuffer()

    // Upload rotated image to Airtable via PATCH with content URL
    // First upload to get a hosted URL — use Airtable's upload endpoint
    const uploadUrl = `https://content.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${id}/Photo/uploadAttachment`
    const uploadResp = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
        'Content-Type': 'application/octet-stream',
        'x-airtable-attachment-filename': 'photo-rotated.jpg',
      },
      body: rotated,
    })

    if (!uploadResp.ok) {
      const errText = await uploadResp.text()
      throw new Error(`Upload failed ${uploadResp.status}: ${errText}`)
    }

    // Fetch updated record to get new photo URL
    const recordResp = await fetch(`${AIRTABLE_BASE_URL}/${id}`, {
      headers: { 'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}` },
    })
    const record = await recordResp.json()
    const attachments = record.fields?.Photo || []
    const newPhotoUrl = attachments[attachments.length - 1]?.url || photoUrl

    // Keep only the newest attachment
    await fetch(`${AIRTABLE_BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: AIRTABLE_HEADERS,
      body: JSON.stringify({
        fields: { Photo: [{ id: attachments[attachments.length - 1]?.id }] },
      }),
    })

    return res.status(200).json({ success: true, photoUrl: newPhotoUrl })
  } catch (err) {
    console.error('rotate error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export const config = { api: { bodyParser: { sizeLimit: '20mb' }, responseLimit: false } }
