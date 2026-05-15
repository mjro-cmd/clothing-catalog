import { useState } from 'react'
import Image from 'next/image'
import { ITEMS, OWNERS } from '../lib/constants'
import ItemModal from './ItemModal'

const COUNTS = [4, 6, 8, 10, 12]

export default function HelpMeModal({ onClose, items = [], onSave }) {
  const [view, setView]             = useState('config')
  const [owners, setOwners]         = useState(['PT', 'MJ'])
  const [categories, setCategories] = useState([])
  const [prompt, setPrompt]         = useState('')
  const [count, setCount]           = useState(4)
  const [outfits, setOutfits]       = useState([])
  const [error, setError]           = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)

  function toggleOwner(owner) {
    setOwners(prev =>
      prev.includes(owner)
        ? prev.length > 1 ? prev.filter(o => o !== owner) : prev
        : [...prev, owner]
    )
  }

  function toggleCategory(cat) {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  async function generate() {
    if (!prompt.trim() || !categories.length) return
    setView('loading')
    setError(null)
    try {
      const resp = await fetch('/api/outfits/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ owners, categories, prompt, count }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Generation failed')
      setOutfits(data.outfits)
      setView('results')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setView('config')
    }
  }

  const canGenerate = prompt.trim().length > 0 && categories.length > 0

  return (
    <>
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[92vh]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {view === 'results' && (
              <button
                onClick={() => setView('config')}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                ← Adjust
              </button>
            )}
            <h2 className="text-sm font-medium text-gray-900">
              {view === 'results' ? `${outfits.length} Outfit Ideas` : 'Help Me Get Dressed'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Loading */}
        {view === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Putting outfits together…</p>
          </div>
        )}

        {/* Config */}
        {view === 'config' && (
          <div className="px-5 py-5 space-y-6">

            {/* Who */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Who</label>
              <div className="flex gap-2">
                {OWNERS.map(o => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggleOwner(o)}
                    className={`px-4 py-1.5 rounded-full text-xs border transition-colors ${
                      owners.includes(o)
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                Draw outfits from
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ITEMS.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleCategory(item)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      categories.includes(item)
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Occasion */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Occasion</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the occasion, vibe, or any constraints…"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400 resize-none"
              />
            </div>

            {/* Outfit count */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Number of outfits</label>
              <div className="flex gap-1.5">
                {COUNTS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`w-10 h-8 rounded-full text-xs border transition-colors ${
                      count === n
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={generate}
              disabled={!canGenerate}
              className="w-full bg-gray-900 text-white rounded-full py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-30"
            >
              Generate Outfits
            </button>
          </div>
        )}

        {/* Results */}
        {view === 'results' && (
          <div className="px-5 py-5 space-y-8">
            {outfits.map((outfit, i) => (
              <div key={i} className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{outfit.title}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{outfit.description}</p>
                </div>
                <div className="flex gap-2">
                  {outfit.items.map(item => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(items.find(i => i.id === item.id) || item)}
                      className="relative flex-1 aspect-square bg-gray-50 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-gray-300 transition-all"
                    >
                      <Image
                        src={item.photoUrl}
                        alt={item.item || 'Item'}
                        fill
                        className="object-contain"
                        unoptimized
                        style={{ transform: `rotate(${item.rotation || 0}deg)` }}
                      />
                    </div>
                  ))}
                </div>
                {i < outfits.length - 1 && (
                  <div className="border-b border-gray-100 pt-2" />
                )}
              </div>
            ))}

            <button
              onClick={generate}
              className="w-full border border-gray-200 text-gray-600 rounded-full py-3 text-sm font-medium hover:border-gray-400 transition-colors"
            >
              Regenerate
            </button>
          </div>
        )}

      </div>
    </div>

    {/* Item detail — rendered on top, closing returns to outfits */}
    {selectedItem && (
      <ItemModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSave={(updated) => { setSelectedItem(null); onSave?.(updated) }}
      />
    )}
    </>
  )
}
