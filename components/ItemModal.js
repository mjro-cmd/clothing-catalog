import { useState } from 'react'
import Image from 'next/image'
import { ITEMS, COLORS, PATTERNS, OWNERS } from '../lib/constants'

function SingleSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? null : opt)}
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
            value === opt
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function MultiSelect({ options, value, onChange }) {
  function toggle(opt) {
    const next = value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]
    onChange(next)
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${
            value.includes(opt)
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export default function ItemModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    owner:    item.owner    || null,
    item:     item.item     || null,
    colors:   item.colors   || [],
    material: item.material || '',
    pattern:  item.pattern  || null,
    brand:    item.brand    || '',
    size:     item.size     || '',
    location: item.location || '',
    boxName:  item.boxName  || '',
    comments: item.comments || '',
  })
  const [saving, setSaving]         = useState(false)
  const [removingBg, setRemovingBg] = useState(false)
  const [rotating, setRotating]     = useState(false)
  const [photoUrl, setPhotoUrl]     = useState(item.photoUrl)
  const [rotation, setRotation]     = useState(item.rotation || 0)
  const [error, setError]           = useState(null)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleRotate() {
    const newRotation = (rotation + 90) % 360
    setRotation(newRotation)
  }

  async function handleSaveRotation() {
    setRotating(true)
    setError(null)
    try {
      const resp = await fetch(`/api/items/${item.id}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ degrees: rotation }),
      })
      if (!resp.ok) throw new Error('Rotation failed')
      onSave({ ...item, ...form, photoUrl, rotation })
    } catch (err) {
      setError('Could not save rotation. Please try again.')
    } finally {
      setRotating(false)
    }
  }

  async function handleRemoveBg() {
    setRemovingBg(true)
    setError(null)
    try {
      const resp = await fetch(`/api/items/${item.id}/remove-bg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl }),
      })
      if (!resp.ok) throw new Error('Background removal failed')
      const data = await resp.json()
      setPhotoUrl(data.photoUrl)
      onSave({ ...item, ...form, photoUrl: data.photoUrl })
    } catch (err) {
      setError('Background removal failed. Please try again.')
    } finally {
      setRemovingBg(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const resp = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!resp.ok) throw new Error('Save failed')
      onSave({ ...item, ...form, photoUrl, rotation })
      onClose()
    } catch (err) {
      setError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet */}
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl overflow-y-auto max-h-[92vh]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Photo */}
        <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
          {photoUrl ? (
            <div
              className="absolute inset-0 transition-transform duration-300"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <Image
                src={photoUrl}
                alt={item.item || 'Item'}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-200 text-sm">No photo</div>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-white/90 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-900 shadow-sm z-10"
          >
            ✕
          </button>

          {photoUrl && (
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-10">
              {/* Rotate controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRotate}
                  className="bg-white/90 rounded-full w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 shadow-sm text-base"
                  title="Rotate 90°"
                >
                  ↻
                </button>
                {rotation !== (item.rotation || 0) && (
                  <button
                    onClick={handleSaveRotation}
                    disabled={rotating}
                    className="bg-gray-900/90 text-white rounded-full px-3 py-1.5 text-xs shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {rotating ? 'Saving…' : 'Save rotation'}
                  </button>
                )}
              </div>

              {/* Remove bg */}
              <button
                onClick={handleRemoveBg}
                disabled={removingBg}
                className="bg-white/90 rounded-full px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 shadow-sm disabled:opacity-50 transition-colors"
              >
                {removingBg ? 'Removing…' : '✦ Remove bg'}
              </button>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="px-5 py-5 space-y-5">

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Owner</label>
            <SingleSelect options={OWNERS} value={form.owner} onChange={(v) => set('owner', v)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Item</label>
            <SingleSelect options={ITEMS} value={form.item} onChange={(v) => set('item', v)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Colors</label>
            <MultiSelect options={COLORS} value={form.colors} onChange={(v) => set('colors', v)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Pattern</label>
            <SingleSelect options={PATTERNS} value={form.pattern} onChange={(v) => set('pattern', v)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Brand</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => set('brand', e.target.value)}
              placeholder="e.g. Everlane"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Material</label>
            <input
              type="text"
              value={form.material}
              onChange={(e) => set('material', e.target.value)}
              placeholder="e.g. cotton, wool"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Size</label>
              <input
                type="text"
                value={form.size}
                onChange={(e) => set('size', e.target.value)}
                placeholder="e.g. M, 32"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. Closet"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Box Name</label>
            <input
              type="text"
              value={form.boxName}
              onChange={(e) => set('boxName', e.target.value)}
              placeholder="e.g. Winter Storage"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">Comments</label>
            <textarea
              value={form.comments}
              onChange={(e) => set('comments', e.target.value)}
              placeholder="Any notes…"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gray-900 text-white rounded-full py-3 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

        </div>
      </div>
    </div>
  )
}
