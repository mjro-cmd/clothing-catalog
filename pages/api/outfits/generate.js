import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import sharp from 'sharp'

async function toBase64(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  const resized = await sharp(buffer)
    .resize(150, 150, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 60 })
    .toBuffer()
  return `data:image/jpeg;base64,${resized.toString('base64')}`
}

const AIRTABLE_BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME)}`

// Items excluded at each formality level
const FORMALITY_EXCLUDE = {
  'Casual':       [],
  'Smart Casual': ['Pjs (long)', 'Pjs (short)', 'Shorts (workout)', 'Leggings (workout)',
                   'Long sleeve (workout)', 'T shirt (workout)', 'Specialized workout',
                   'Underwear', 'Sweatpants'],
  'Formal':       ['Pjs (long)', 'Pjs (short)', 'Shorts (workout)', 'Leggings (workout)',
                   'Long sleeve (workout)', 'T shirt (workout)', 'Specialized workout',
                   'Underwear', 'Sweatpants', 'Fleece', 'Hoodie', 'Shorts (normal)',
                   'T-Shirt', 'T shirt (workout)'],
}

async function getEligibleItems(owners, categories, formality) {
  const excluded = FORMALITY_EXCLUDE[formality] || []
  const records  = []
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
      const photo  = fields['Photo']
      if (!photo?.[0]?.url)                                     continue
      if (owners.length     && !owners.includes(fields['Owner']))    continue
      if (categories.length && !categories.includes(fields['Item'])) continue
      if (excluded.includes(fields['Item']))                         continue
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

async function critiqueOutfits(outfits, prompt, formality, count) {
  const outfitDescriptions = outfits.map((o, i) => {
    const itemList = o.items
      .map(item => `${item.brand || ''} ${item.item} (${item.colors.join('/')}${item.pattern && item.pattern !== 'Solid' ? ', ' + item.pattern : ''})`)
      .join(' + ')
    return `Outfit ${i}: "${o.title}" — ${itemList}`
  }).join('\n')

  const critiqueResp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:           'gpt-4o',
      messages: [{
        role: 'user',
        content: `You are a strict fashion editor. Review these outfit combinations for a ${formality} occasion: "${prompt}"

${outfitDescriptions}

Evaluate each outfit ruthlessly:
- Is it genuinely appropriate and stylish for the occasion?
- Are the patterns cohesive? (Two bold patterns = instant fail)
- Is the formality level right for ${formality}?
- Would a real stylist be proud of this?

Return ONLY a JSON object with the 0-based indices of the outfits that genuinely pass, ranked best first, up to ${count} total:
{"approved": [2, 0, 4]}`,
      }],
      response_format: { type: 'json_object' },
      max_tokens:      200,
      temperature:     0.2,
    }),
  })

  if (!critiqueResp.ok) return outfits.slice(0, count) // fallback: return first N
  const data   = await critiqueResp.json()
  const parsed = JSON.parse(data.choices[0].message.content)
  const approved = parsed.approved || []
  return approved.slice(0, count).map(i => outfits[i]).filter(Boolean)
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { owners = [], categories = [], prompt, count = 4, formality = 'Smart Casual' } = req.body
  if (!prompt?.trim())    return res.status(400).json({ error: 'Occasion prompt is required' })
  if (!categories.length) return res.status(400).json({ error: 'Select at least one category' })

  try {
    const items = await getEligibleItems(owners, categories, formality)
    if (!items.length) return res.status(400).json({ error: 'No items found for the selected filters — try a less restrictive formality level' })

    // Download and resize all images in parallel
    const base64Images = await Promise.all(items.map(item => toBase64(item.photoUrl)))

    // Group by category for clearer GPT instructions
    const byCategory = {}
    for (const cat of categories) byCategory[cat] = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (byCategory[item.item]) byCategory[item.item].push({ item, b64: base64Images[i] })
    }

    // Build GPT-4o multi-modal message
    const content = [
      {
        type: 'text',
        text: `You are an expert personal stylist. Below are clothing items grouped by category. Study each photo carefully — pay close attention to colours, patterns, and textures.`,
      },
    ]

    for (const cat of categories) {
      content.push({ type: 'text', text: `\n— ${cat.toUpperCase()} (pick exactly one per outfit) —` })
      for (const { item, b64 } of byCategory[cat] || []) {
        const label = [item.brand, item.colors.join('/'), item.pattern].filter(Boolean).join(' · ')
        content.push({ type: 'text',      text:      `[${item.id}] ${label}` })
        content.push({ type: 'image_url', image_url: { url: b64, detail: 'low' } })
      }
    }

    // Generate count+4 so the critique pass has extras to choose from
    const generateCount = count + 4

    content.push({
      type: 'text',
      text: `Occasion: "${prompt}"
Formality level: ${formality}

Generate ${generateCount} outfit candidates. Each must contain exactly one item from each category above — no exceptions.

Strict styling rules:
- MAXIMUM ONE non-solid item per outfit. If one item is patterned (striped, floral, plaid, graphic), all others must be solid. Two patterned items together is never acceptable.
- Formality must match: ${formality} means ${
  formality === 'Formal'       ? 'polished and professional — no casual basics' :
  formality === 'Smart Casual' ? 'put-together but not stiff — no athletic or lounge wear' :
                                 'relaxed and everyday'
}
- Vary combinations — each outfit should feel meaningfully different
- Only use IDs listed above — do not invent IDs

Return ONLY valid JSON:
{
  "outfits": [
    {
      "items": ["recXXX", "recYYY", "recZZZ"],
      "title": "Short descriptive name",
      "description": "2–3 sentences on why this works for the occasion"
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
        model:           'gpt-4o-mini',
        messages:        [{ role: 'user', content }],
        response_format: { type: 'json_object' },
        max_tokens:      3000,
        temperature:     0.8,
      }),
    })

    const openaiText = await openaiResp.text()
    if (!openaiResp.ok) throw new Error(`OpenAI error: ${openaiText}`)

    let openaiData
    try { openaiData = JSON.parse(openaiText) }
    catch { throw new Error(`OpenAI returned non-JSON: ${openaiText.slice(0, 300)}`) }

    const rawContent = openaiData.choices?.[0]?.message?.content
    if (!rawContent) throw new Error(`OpenAI empty response: ${JSON.stringify(openaiData).slice(0, 300)}`)

    let parsed
    try { parsed = JSON.parse(rawContent) }
    catch { throw new Error(`OpenAI content not JSON: ${rawContent.slice(0, 300)}`) }

    // Map IDs to full item data
    const itemMap = Object.fromEntries(items.map(i => [i.id, i]))
    const candidates = parsed.outfits
      .map(outfit => {
        const resolved = outfit.items.map(id => itemMap[id]).filter(Boolean)
        if (resolved.length !== outfit.items.length) {
          console.log(`[outfit-gen] Dropped outfit "${outfit.title}": ${outfit.items.length - resolved.length} unknown IDs — ${outfit.items.filter(id => !itemMap[id]).join(', ')}`)
        }
        return { title: outfit.title, description: outfit.description, items: resolved }
      })
      .filter(outfit => {
        const cats = outfit.items.map(i => i.item)
        if (!categories.every(cat => cats.filter(c => c === cat).length === 1)) {
          console.log(`[outfit-gen] Filtered out "${outfit.title}": category mismatch — got [${[...new Set(cats)].join(', ')}], need [${categories.join(', ')}]`)
          return false
        }
        const nonSolid = outfit.items.filter(i => i.pattern && i.pattern !== 'Solid')
        if (nonSolid.length > 1) {
          console.log(`[outfit-gen] Filtered out "${outfit.title}": ${nonSolid.length} non-solid patterns`)
          return false
        }
        return true
      })

    console.log(`[outfit-gen] GPT generated ${parsed.outfits.length} raw, ${candidates.length} passed hard filter`)

    // Pass 2: critique pass — GPT picks the best from the candidates
    let outfits
    if (candidates.length > count) {
      outfits = await critiqueOutfits(candidates, prompt, formality, count)
      console.log(`[outfit-gen] Critique pass: ${candidates.length} in, ${outfits.length} approved`)
      if (outfits.length === 0) {
        console.log(`[outfit-gen] Critique returned 0 — falling back to first ${count} candidates`)
        outfits = candidates.slice(0, count)
      }
    } else {
      outfits = candidates
    }

    return res.status(200).json({ outfits })
  } catch (err) {
    console.error('outfit generation error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export const config = {
  api:         { responseLimit: false },
  maxDuration: 300,
}
