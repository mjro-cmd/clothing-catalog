import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'

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
  const { degrees } = req.body

  if (degrees === undefined) return res.status(400).json({ error: 'degrees required' })

  try {
    const patchResp = await fetch(`${AIRTABLE_BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: AIRTABLE_HEADERS,
      body: JSON.stringify({ fields: { Rotation: degrees } }),
    })
    if (!patchResp.ok) throw new Error(`Airtable PATCH failed: ${await patchResp.text()}`)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('rotate error:', err)
    return res.status(500).json({ error: err.message })
  }
}
