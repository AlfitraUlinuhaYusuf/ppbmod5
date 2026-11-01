import FavoriteButton from '../common/FavoriteButton'
import { formatPrice, truncate } from '../../utils/helpers'
import { BookmarkPlus, Plus, RotateCcw, Trash2 } from 'lucide-react'

/**
 * Product card used in the catalog grid.
 *
 * @param {Object}   props
 * @param {Object}   props.gun       — product data
 * @param {Function} props.onSelect  — called with the gun when clicked
 * @param {Function} [props.onEdit]  — called when Edit is clicked (admin)
 * @param {Function} [props.onDelete]— called when Delete is clicked (admin)
 */
export default function GunCard({
  gun,
  onSelect,
  onEdit,
  onDelete,
  onAddToCart,
  onSaveDraft,
  onRestore,
  onPermanentlyDelete,
}) {
  const imgSrc = gun.image_urls?.[0] || gun.image_url || gun.image || '/guns/pistol.svg'
  const category = gun.type || gun.category || '—'
  const caliber = gun.caliber || gun.difficulty || ''
  const price = gun.price ?? gun.cook_time ?? 0

  return (
    <li className="card">
      <button
        type="button"
        className="card-btn"
        onClick={() => onSelect(gun)}
        aria-label={`View ${gun.name}`}
      >
        <img
          className="card-img"
          src={imgSrc}
          alt={gun.name}
          width="240"
          height="180"
          loading="lazy"
        />

        <span className="name display">{gun.name}</span>

        <span className="type">
          {category}
          {caliber ? ` · ${caliber}` : ''}
        </span>

        {gun.description && (
          <span className="card-desc">{truncate(gun.description, 72)}</span>
        )}

        <span className="price">{formatPrice(price)}</span>
      </button>

      {/* Floating actions row */}
      <div className="card-actions">
        {!onRestore && <FavoriteButton gunId={gun.id || gun.name} />}

        {onAddToCart && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onAddToCart(gun) }}
            aria-label={`Add ${gun.name} to demo cart`}
            title="Add to demo cart"
          >
            <Plus size={16} />
          </button>
        )}

        {onSaveDraft && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onSaveDraft(gun) }}
            aria-label={`Add ${gun.name} to drafts`}
            title="Simpan ke Draft"
          >
            <BookmarkPlus size={16} />
          </button>
        )}

        {onEdit && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onEdit(gun) }}
            aria-label={`Edit ${gun.name}`}
            title="Edit"
          >
            ✏️
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => { e.stopPropagation(); onDelete(gun) }}
            aria-label={`Delete ${gun.name}`}
            title="Delete"
          >
            🗑️
          </button>
        )}
        {onRestore && (
          <button
            type="button"
            className="card-act-btn"
            onClick={(e) => { e.stopPropagation(); onRestore(gun) }}
            aria-label={`Restore ${gun.name}`}
            title="Restore"
          >
            <RotateCcw size={15} />
          </button>
        )}
        {onPermanentlyDelete && (
          <button
            type="button"
            className="card-act-btn card-act-btn--danger"
            onClick={(e) => { e.stopPropagation(); onPermanentlyDelete(gun) }}
            aria-label={`Permanently delete ${gun.name}`}
            title="Delete permanently"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </li>
  )
}
