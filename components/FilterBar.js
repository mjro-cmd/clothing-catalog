import { OWNERS } from '../lib/constants'

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-3 py-1 rounded-full text-xs border transition-colors ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

function FilterGroup({ title, options, selected, onToggle }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-300 uppercase tracking-wider w-14 shrink-0">{title}</span>
      {options.map((opt) => (
        <Chip
          key={opt}
          label={opt}
          active={selected.includes(opt)}
          onClick={() => onToggle(opt)}
        />
      ))}
    </div>
  )
}

export default function FilterBar({ filters, brands, itemTypes, colors, patterns, onChange }) {
  function toggle(key, value) {
    const current = filters[key]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  function clearAll() {
    onChange({ owner: [], item: [], color: [], pattern: [], brand: [] })
  }

  const hasActive = Object.values(filters).some((f) => f.length > 0)

  return (
    <div className="space-y-2.5">
      <FilterGroup title="Who"     options={OWNERS}   selected={filters.owner}   onToggle={(v) => toggle('owner', v)} />
      <FilterGroup title="Item"    options={itemTypes} selected={filters.item}   onToggle={(v) => toggle('item', v)} />
      <FilterGroup title="Color"   options={colors}   selected={filters.color}   onToggle={(v) => toggle('color', v)} />
      <FilterGroup title="Pattern" options={patterns} selected={filters.pattern} onToggle={(v) => toggle('pattern', v)} />
      <FilterGroup title="Brand"   options={brands}   selected={filters.brand}   onToggle={(v) => toggle('brand', v)} />
      {hasActive && (
        <button onClick={clearAll} className="text-xs text-gray-300 hover:text-gray-500 underline underline-offset-2 transition-colors ml-16">
          Clear all
        </button>
      )}
    </div>
  )
}
