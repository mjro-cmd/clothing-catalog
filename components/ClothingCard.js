import Image from 'next/image'

export default function ClothingCard({ item, onClick, priority }) {
  return (
    <div className="flex flex-col cursor-pointer group" onClick={onClick}>
      <div className="relative aspect-square bg-gray-50 overflow-hidden rounded-sm">
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt={item.item || 'Clothing item'}
            fill
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw"
            style={{ transform: `rotate(${item.rotation || 0}deg)` }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-200 text-xs">
            No photo
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-xs text-gray-500 truncate">{item.brand || '—'}</p>
        {item.item && (
          <p className="text-xs text-gray-300 truncate">{item.item}</p>
        )}
      </div>
    </div>
  )
}
