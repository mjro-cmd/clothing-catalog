export async function getAllItems() {
  const records = []
  let offset = null

  do {
    const params = new URLSearchParams({ pageSize: '100' })
    if (offset) params.append('offset', offset)

    const resp = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME)}?${params}`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    )

    if (!resp.ok) throw new Error(`Airtable error ${resp.status}: ${await resp.text()}`)

    const data = await resp.json()

    for (const record of data.records) {
      const photo = record.fields['Photo']
      records.push({
        id:        record.id,
        owner:     record.fields['Owner']     || null,
        item:      record.fields['Item']      || null,
        colors:    record.fields['Colors']    || [],
        material:  record.fields['Material']  || null,
        pattern:   record.fields['Pattern']   || null,
        brand:     record.fields['Brand']     || null,
        size:      record.fields['Size']      || null,
        location:  record.fields['Location']  || null,
        boxName:   record.fields['Box Name']  || null,
        comments:  record.fields['Comments']  || null,
        photoUrl:  photo?.[0]?.url            || null,
        dateAdded: record.fields['Date Added'] || null,
      })
    }

    offset = data.offset || null
  } while (offset)

  return records
}
