import { signOut } from 'next-auth/react'
import { useState, useMemo } from 'react'
import { getAllItems } from '../lib/airtable'
import ClothingCard from '../components/ClothingCard'
import FilterBar from '../components/FilterBar'
import ItemModal from '../components/ItemModal'
import HelpMeModal from '../components/HelpMeModal'


const EMPTY_FILTERS = { owner: [], item: [], color: [], pattern: [], brand: [] }

export default function Home({ initialItems }) {
  const [items, setItems]           = useState(initialItems)
  const [filters, setFilters]       = useState(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selected, setSelected]     = useState(null)
  const [helpMeOpen, setHelpMeOpen] = useState(false)

  const brands = useMemo(() => {
    const set = new Set(items.map((i) => i.brand).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [items])

  const itemTypes = useMemo(() => {
    const set = new Set(items.map((i) => i.item).filter(Boolean))
    return Array.from(set).sort()
  }, [items])

  const colors = useMemo(() => {
    const set = new Set(items.flatMap((i) => i.colors || []).filter(Boolean))
    return Array.from(set).sort()
  }, [items])

  const patterns = useMemo(() => {
    const set = new Set(items.map((i) => i.pattern).filter(Boolean))
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filters.owner.length   && !filters.owner.includes(item.owner))     return false
      if (filters.item.length    && !filters.item.includes(item.item))       return false
      if (filters.pattern.length && !filters.pattern.includes(item.pattern)) return false
      if (filters.brand.length   && !filters.brand.includes(item.brand))     return false
      if (filters.color.length   && !filters.color.some((c) => item.colors?.includes(c))) return false
      return true
    })
  }, [items, filters])

  function handleSave(updated) {
    setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i))
  }

  const activeFilterCount = Object.values(filters).flat().length

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-light tracking-widest uppercase">Wardrobe</h1>
            <p className="text-xs text-gray-300">PT & MJ</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHelpMeOpen(true)}
              className="flex items-center gap-1.5 text-xs border rounded-full px-3 py-1.5 border-gray-200 text-gray-400 hover:border-gray-400 transition-colors"
            >
              Help Me
            </button>
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`flex items-center gap-1.5 text-xs border rounded-full px-3 py-1.5 transition-colors ${
                filtersOpen || activeFilterCount > 0
                  ? 'border-gray-900 text-gray-900'
                  : 'border-gray-200 text-gray-400 hover:border-gray-400'
              }`}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M3 6h18M7 12h10M11 18h2"/>
              </svg>
              Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {filtersOpen && (
          <div className="border-t border-gray-100 bg-white px-4 py-4 max-w-2xl mx-auto">
            <FilterBar filters={filters} brands={brands} itemTypes={itemTypes} colors={colors} patterns={patterns} onChange={setFilters} />
          </div>
        )}
      </header>

      {/* Item count */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2">
        <p className="text-xs text-gray-300">
          {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          {activeFilterCount > 0 && ` · ${items.length} total`}
        </p>
      </div>

      {/* Grid */}
      <main className="max-w-2xl mx-auto px-4 pb-12">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-sm text-gray-300">
            No items match your filters
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((item, i) => (
              <ClothingCard
                key={item.id}
                item={item}
                priority={i < 6}
                onClick={() => setSelected(item)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Edit modal */}
      {selected && (
        <ItemModal
          item={selected}
          onClose={() => setSelected(null)}
          onSave={handleSave}
        />
      )}

      {/* Help Me modal */}
      {helpMeOpen && (
        <HelpMeModal
          onClose={() => setHelpMeOpen(false)}
          items={items}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export async function getStaticProps() {
  const items = await getAllItems()
  return {
    props: { initialItems: items },
    revalidate: 60, // rebuild in background every 60 seconds
  }
}
