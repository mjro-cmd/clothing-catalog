import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'

const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME)}`
const AIRTABLE_HEADERS  = {
  'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query

  if (req.method === 'PATCH') {
    const { item, colors, material, pattern, brand, owner, size, location, boxName, comments } = req.body

    const fields = {}
    if (item     !== undefined) fields['Item']     = item     || null
    if (colors   !== undefined) fields['Colors']   = colors
    if (material !== undefined) fields['Material'] = material || null
    if (pattern  !== undefined) fields['Pattern']  = pattern  || null
    if (brand    !== undefined) fields['Brand']    = brand    || null
    if (owner    !== undefined) fields['Owner']    = owner    || null
    if (size     !== undefined) fields['Size']     = size     || null
    if (location !== undefined) fields['Location'] = location || null
    if (boxName  !== undefined) fields['Box Name'] = boxName  || null
    if (comments !== undefined) fields['Comments'] = comments || null

    try {
      const resp = await fetch(`${AIRTABLE_BASE_URL}/${id}`, {
        method: 'PATCH',
        headers: AIRTABLE_HEADERS,
        body: JSON.stringify({ fields }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      return res.status(200).json({ success: true })
    } catch (err) {
      console.error('Airtable update error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
