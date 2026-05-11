const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

export async function getAllItems() {
  const records = []

  await base(process.env.AIRTABLE_TABLE_NAME)
    .select({ view: 'Grid view' })
    .eachPage((page, fetchNext) => {
      page.forEach((record) => {
        const photo = record.get('Photo')
        records.push({
          id: record.id,
          owner:     record.get('Owner')     || null,
          item:      record.get('Item')      || null,
          colors:    record.get('Colors')    || [],
          material:  record.get('Material')  || null,
          pattern:   record.get('Pattern')   || null,
          brand:     record.get('Brand')     || null,
          size:      record.get('Size')      || null,
          location:  record.get('Location')  || null,
          boxName:   record.get('Box Name')  || null,
          comments:  record.get('Comments')  || null,
          photoUrl:  photo?.[0]?.url         || null,
          dateAdded: record.get('Date Added') || null,
        })
      })
      fetchNext()
    })

  return records
}
