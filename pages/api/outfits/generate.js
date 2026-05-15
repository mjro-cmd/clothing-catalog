import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import sharp from 'sharp'

async function toBase64(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
  return `data:image/jpeg;base64,${resized.toString('base64')}`
}

const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME)}`

async function getEligibleItems(owners, categories) {
  const records = []
  let offset = null
  do {
    const params = new URLSearchParams({ pageSize: '100' })
    if (offset) params.append('offset', offset)
    const resp = await fetch(`${AIRTABLE_BASE_URL}?${params}`, {
      headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
    })
    const data = await resp.json()
    for (const record of data.records) {
      const fields = record.fields
      const photo   = fields['Photo']
      if (!photo?.[0]?.url) continue
      if (owners.length     && !owners.includes(fields['Owner']))     continue
      if (categories.length && !categories.includes(fields['Item']))  continue
      records.push({
        id:       record.id,
        owner:    fields['Owner']    || null,
        item:     fields['Item']     || null,
        colors:   fields['Colors']   || [],
        pattern:  fields['Pattern']  || null,
        brand:    fields['Brand']    || null,
        rotation: fields['Rotation'] || 0,
        photoUrl: photo[0].url,
      })
    }
    offset = data.offset || null
  } while (offset)
  return records
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { owners = [], categories = [], prompt, count = 4 } = req.body
  if (!prompt?.trim()) return res.status(400).json({ error: 'Occasion prompt is required' })
  if (!categories.length) return res.status(400).json({ error: 'Select at least one category' })

  try {
    const items = await getEligibleItems(owners, categories)
    if (!items.length) return res.status(400).json({ error: 'No items found for the selected filters' })

    // Download and resize all images in parallel (avoids OpenAI size limit)
    const base64Images = await Promise.all(items.map(item => toBase64(item.photoUrl)))

    // Group items by category
    const byCategory = {}
    for (const cat of categories) byCategory[cat] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (byCategory[item.item]) byCategory[item.item].push({ item, b64: base64Images[i] })
    }

    // Build GPT-4o multi-modal message — grouped by category so GPT picks correctly
    const content = [
      {
        type: 'text',
        text: `You are an expert personal stylist. Below are clothing items grouped by category. Study each photo carefully.`,
      },
    ]

    for (const cat of categories) {
      content.push({ type: 'text', text: `\n— ${cat.toUpperCase()} (pick exactly one per outfit) —` })
      for (const { item, b64 } of byCategory[cat] || []) {
        const label = [item.brand, item.colors.join('/'), item.pattern].filter(Boolean).join(' · ')
        content.push({ type: 'text', text: `[${item.id}] ${label}` })
        content.push({ type: 'image_url', image_url: { url: b64, detail: 'high' } })
      }
    }

    content.push({
      type: 'text',
      text: `Occasion: "${prompt}"

Create exactly ${count} outfit combinations. Each outfit must contain exactly one item from each category above — no exceptions.

Styling rules:
- Match the formality level to the occasion
- Avoid combining two heavily patterned items (e.g. floral + floral, plaid + graphic) — if two patterned items must be used, one should be very subtle
- Consider colour harmony — complementary or tonal palettes work best
- Vary combinations across outfits so each suggestion is meaningfully different
- Only use item IDs listed above — do not invent IDs

Return ONLY a valid JSON object, no other text:
{
  "outfits": [
    {
      "items": ["recXXX", "recYYY", "recZZZ"],
      "title": "Short descriptive outfit name",
      "description": "2–3 sentences on why this combination works for the occasion and what makes it visually cohesive"
    }
  ]
}`,
    })

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:           'gpt-4o',
        messages:        [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        max_tokens:      2000,
        temperature:     0.8,
      }),
    })

    if (!openaiResp.ok) throw new Error(`OpenAI error: ${await openaiResp.text()}`)

    const openaiData = await openaiResp.json()
    const parsed     = JSON.parse(openaiData.choices[0].message.content)

    // Map IDs back to full item data and validate one item per category
    const itemMap = Object.fromEntries(items.map(i => [i.id, i]))
    const outfits = parsed.outfits
      .map(outfit => ({
        title:       outfit.title,
        description: outfit.description,
        items:       outfit.items.map(id => itemMap[id]).filter(Boolean),
      }))
      .filter(outfit => {
        // Ensure exactly one item per selected category
        const categoriesInOutfit = outfit.items.map(i => i.item)
        return categories.every(cat => categoriesInOutfit.filter(c => c === cat).length === 1)
      })

    return res.status(200).json({ outfits })
  } catch (err) {
    console.error('outfit generation error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export const config = {
  api:         { responseLimit: false },
  maxDuration: 60,
}
