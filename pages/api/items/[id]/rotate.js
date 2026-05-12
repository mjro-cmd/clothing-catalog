import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { AIRTABLE_BASE_URL, AIRTABLE_HEADERS } from '../../../../lib/airtable'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  const { degrees } = req.body

  if (![0, 90, 180, 270].includes(degrees)) return res.status(400).json({ error: 'degrees must be 0, 90, 180, or 270' })

  try {
    const patchResp = await fetch(`${AIRTABLE_BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: AIRTABLE_HEADERS,
      body: JSON.stringify({ fields: { Rotation: degrees } }),
    })
    if (!patchResp.ok) throw new Error(`Airtable PATCH failed: ${await patchResp.text()}`)

    await res.revalidate('/')
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('rotate error:', err)
    return res.status(500).json({ error: 'Could not save rotation' })
  }
}
