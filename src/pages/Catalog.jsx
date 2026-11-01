import { useMemo, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Loader, PackageOpen, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'
import { saveCatalogDraft } from '../utils/catalogDraftStorage'
import { matchesSearch, matchesCategory, sortItems, extractCategories } from '../utils/helpers'

const PAGE_SIZE = 6

export default function Catalog({ onNavigate, onAddToCart }) {
  const [useLocal, setUseLocal] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [showDeleted, setShowDeleted] = useState(false)
  const [selectedGun, setSelectedGun] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [permanentTarget, setPermanentTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [draftMessage, setDraftMessage] = useState('')

  const query = useMemo(() => ({
    limit: PAGE_SIZE,
    page,
    search: search.trim(),
    category: activeCategory,
    sort_by: sortKey,
    order: sortOrder,
    include_deleted: showDeleted,
  }), [page, search, activeCategory, sortKey, sortOrder, showDeleted])
  const { guns: apiGuns, loading, error, pagination, refetch } = useGuns(query)

  const rawGuns = useMemo(() => {
    if (!showDeleted && (useLocal || (error && apiGuns.length === 0))) {
      return GUNS_LOCAL.map((gun, index) => ({
        ...gun,
        id: gun.id || `local-${index}`,
        image_urls: gun.image_urls || [gun.image],
      }))
    }
    return apiGuns
  }, [apiGuns, error, useLocal, showDeleted])
  const categories = useMemo(() => extractCategories([...rawGuns, ...GUNS_LOCAL]), [rawGuns])
  const filteredGuns = useMemo(() => sortItems(
    rawGuns.filter((gun) => matchesSearch(gun, search) && matchesCategory(gun, activeCategory)),
    sortKey,
    sortOrder,
  ), [rawGuns, search, activeCategory, sortKey, sortOrder])
  const totalItems = useLocal
    ? filteredGuns.length
    : pagination?.total != null && Number.isFinite(Number(pagination.total))
      ? Number(pagination.total)
      : null
  const totalPages = useLocal
    ? Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
    : Number(pagination?.totalPages) || (pagination?.hasMore ? page + 1 : page)
  const canGoNext = useLocal
    ? page < totalPages
    : Boolean(pagination?.hasMore)
  const refreshAfterMutation = () => {
    if (page === 1) return refetch()
    setPage(1)
  }

  const handleSearch = (value) => {
    setSearch(value)
    setPage(1)
  }
  const handleCategory = (value) => {
    setActiveCategory(value)
    setPage(1)
  }
  const handleSort = ({ key, order }) => {
    setSortKey(key)
    setSortOrder(order)
    setPage(1)
  }
  const toggleDeleted = () => {
    setShowDeleted((value) => !value)
    setUseLocal(false)
    setPage(1)
  }

  const handleSaveDraft = (gun) => {
    try {
      saveCatalogDraft(gun)
      setDraftMessage(`"${gun.name}" disimpan ke Draft profil.`)
      setActionError('')
      return true
    } catch (error) {
      setDraftMessage('')
      setActionError(error.message || 'Produk gagal disimpan ke Draft.')
      return false
    }
  }

  const handleSoftDelete = async () => {
    if (!deleteTarget) return
    try {
      setBusy(true)
      setActionError('')
      await gunService.deleteGun(deleteTarget.id)
      setDeleteTarget(null)
      refreshAfterMutation()
    } catch (action) {
      setActionError(action.message || 'Produk gagal dipindahkan ke Sampah.')
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (gun) => {
    try {
      setBusy(true)
      setActionError('')
      await gunService.restoreGun(gun.id)
      refreshAfterMutation()
    } catch (action) {
      setActionError(action.message || 'Produk gagal dipulihkan.')
    } finally {
      setBusy(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!permanentTarget) return
    try {
      setBusy(true)
      setActionError('')
      await gunService.permanentlyDeleteGun(permanentTarget.id)
      setPermanentTarget(null)
      refreshAfterMutation()
    } catch (action) {
      setActionError(action.message || 'Produk gagal dihapus permanen.')
    } finally {
      setBusy(false)
    }
  }

  if (selectedGun) {
    return (
      <GunDetail
        gun={selectedGun}
        onBack={() => setSelectedGun(null)}
        onEdit={showDeleted ? undefined : (gun) => onNavigate?.('Edit', gun)}
        onDelete={showDeleted ? undefined : setDeleteTarget}
        onAddToCart={showDeleted ? undefined : onAddToCart}
        onSaveDraft={showDeleted ? undefined : handleSaveDraft}
      />
    )
  }

  const visibleGuns = useLocal
    ? filteredGuns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filteredGuns
  const pageWindowStart = Math.max(1, Math.min(page - 2, totalPages - 4))
  const pageNumbers = Array.from(
    { length: Math.max(0, Math.min(5, totalPages - pageWindowStart + 1)) },
    (_, index) => pageWindowStart + index,
  )

  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          Katalog demo. Gunakan pencarian dan filter, lalu navigasikan halaman katalog.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>{showDeleted ? 'Sampah katalog' : 'Current stock'}</h2>
          <div className="list-head-right">
            <span className="count">
              {totalItems ?? visibleGuns.length} item
              {' · '}halaman {page}{totalPages > 1 ? ` dari ${totalPages}` : ''}
            </span>
            <button type="button" className="btn btn--outline btn--sm" onClick={toggleDeleted}>
              {showDeleted ? 'Kembali ke katalog' : <><Trash2 size={14} /> Sampah</>}
            </button>
            {!showDeleted && onNavigate && (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => onNavigate('Create')}>
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        <AdvancedFilter
          search={search}
          onSearch={handleSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={handleCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />

        {pagination?.localArchive && (
          <p className="local-notice">
            Sampah tersimpan di browser ini saja. Jalankan migrasi kolom Supabase dari README agar arsip tersinkron.
          </p>
        )}
        {draftMessage && <div className="toast toast--success" role="status">{draftMessage}</div>}
        {actionError && <div className="toast toast--error" role="alert">{actionError}</div>}

        {loading && apiGuns.length === 0 && (
          <div className="state-box"><Loader size={28} className="spin" /><p>Loading products…</p></div>
        )}

        {!loading && error && !useLocal && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={refetch}><RefreshCw size={16} /> Retry</button>
              {!showDeleted && <button type="button" className="btn btn--outline" onClick={() => { setUseLocal(true); setPage(1) }}>View Local Catalog</button>}
            </div>
          </div>
        )}

        {!loading && visibleGuns.length === 0 && !error && (
          <div className="state-box"><PackageOpen size={28} /><p>{showDeleted ? 'Sampah kosong.' : 'No products match your search.'}</p></div>
        )}

        {visibleGuns.length > 0 && (
          <ul className="stock">
            {visibleGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={setSelectedGun}
                onEdit={!showDeleted && !String(gun.id).startsWith('local-') ? (item) => onNavigate?.('Edit', item) : undefined}
                onDelete={!showDeleted && !String(gun.id).startsWith('local-') ? setDeleteTarget : undefined}
                onAddToCart={!showDeleted ? onAddToCart : undefined}
                onSaveDraft={!showDeleted ? handleSaveDraft : undefined}
                onRestore={showDeleted ? handleRestore : undefined}
                onPermanentlyDelete={showDeleted ? setPermanentTarget : undefined}
              />
            ))}
          </ul>
        )}

        {(page > 1 || totalPages > 1 || canGoNext) && (
          <nav className="catalog-pagination" aria-label="Pagination katalog">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || loading}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={16} /> Sebelumnya
            </button>
            <div className="catalog-pagination__pages">
              {pageNumbers.map((pageNumber) => (
                <button
                  type="button"
                  key={pageNumber}
                  className={`catalog-pagination__page${pageNumber === page ? ' is-active' : ''}`}
                  onClick={() => setPage(pageNumber)}
                  disabled={loading || pageNumber === page}
                  aria-current={pageNumber === page ? 'page' : undefined}
                  aria-label={`Halaman ${pageNumber}`}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setPage((current) => current + 1)}
              disabled={!canGoNext || loading}
              aria-label="Halaman berikutnya"
            >
              Berikutnya <ChevronRight size={16} />
            </button>
          </nav>
        )}

        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button type="button" className="link-btn" onClick={() => { setUseLocal(false); refetch() }}>Retry server</button>
          </p>
        )}
      </section>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Pindahkan ke Sampah"
        message={`"${deleteTarget?.name}" akan dipindahkan ke Sampah dan dapat dipulihkan.`}
        confirmLabel="Pindahkan"
        loading={busy}
        onConfirm={handleSoftDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={Boolean(permanentTarget)}
        title="Hapus Permanen"
        message={`"${permanentTarget?.name}" akan dihapus permanen dan tidak dapat dipulihkan.`}
        confirmLabel="Hapus permanen"
        danger
        loading={busy}
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentTarget(null)}
      />
    </>
  )
}
