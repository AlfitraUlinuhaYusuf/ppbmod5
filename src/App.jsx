import { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Catalog from './pages/Catalog.jsx'
import FavoritesPage from './pages/FavoritesPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ProfileEditPage from './pages/ProfileEditPage.jsx'
import CartPage from './pages/CartPage.jsx'
import CreateGunPage from './pages/CreateGunPage.jsx'
import EditGunPage from './pages/EditGunPage.jsx'
import GunDetail from './components/gun/GunDetail.jsx'
import PWABadge from './components/PWABadge.jsx'
import ConfirmModal from './components/modals/ConfirmModal.jsx'
import SplashScreen from './components/common/SplashScreen.jsx'
import gunService from './services/gunService.js'
import { useCart } from './hooks/useCart.js'
import GUNS_LOCAL from './data/guns.js'
import './App.css'

const clearSharedProductParam = () => {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('product')) return
  url.searchParams.delete('product')
  window.history.replaceState({}, '', url)
}

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [tab, setTab] = useState('Catalog')
  const [mode, setMode] = useState(() =>
    new URLSearchParams(window.location.search).has('product') ? 'shared-loading' : 'list',
  )
  const [selectedGun, setSelectedGun] = useState(null)
  const [editingGun, setEditingGun] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [sharedLinkError, setSharedLinkError] = useState('')
  const cart = useCart()

  useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get('product')
    if (!productId) return undefined

    let active = true
    const openSharedProduct = async () => {
      try {
        let product
        const localMatch = productId.match(/^local-(\d+)$/)
        if (localMatch) {
          const index = Number(localMatch[1])
          const localProduct = GUNS_LOCAL[index]
          if (!localProduct) throw new Error('Produk lokal tidak ditemukan.')
          product = { ...localProduct, id: productId, image_urls: localProduct.image_urls || [localProduct.image] }
        } else {
          const response = await gunService.getGunById(productId)
          product = response?.data || response
          if (!product || Array.isArray(product)) throw new Error('Produk tidak ditemukan.')
        }
        if (!active) return
        setSelectedGun(product)
        setTab('Catalog')
        setMode('detail')
      } catch (error) {
        if (!active) return
        setSharedLinkError(error.message || 'Link produk tidak dapat dibuka.')
        setTab('Catalog')
        setMode('list')
        clearSharedProductParam()
      }
    }

    openSharedProduct()
    return () => { active = false }
  }, [])

  // Unified navigation handler
  const handleNavigate = (target, payload) => {
    if (target === 'Create') {
      setMode('create')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Edit') {
      setEditingGun(payload)
      setMode('edit')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Detail') {
      setSelectedGun(payload)
      setMode('detail')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'ProfileEdit') {
      setMode('profile-edit')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Tab change
      clearSharedProductParam()
      setSharedLinkError('')
      setTab(target)
      setMode('list')
      setSelectedGun(null)
      setEditingGun(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBackToList = () => {
    clearSharedProductParam()
    setMode('list')
    setSelectedGun(null)
    setEditingGun(null)
  }

  return (
    <div className="shell">
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      <Header
        tab={mode === 'list' ? tab : ''}
        onTab={(newTab) => handleNavigate(newTab)}
        onNavigateCreate={() => handleNavigate('Create')}
        cartCount={cart.count}
      />

      <main className="main">
        {sharedLinkError && (
          <div className="toast toast--error" role="alert">
            {sharedLinkError}
          </div>
        )}
        {mode === 'shared-loading' && (
          <div className="state-box" role="status">Memuat produk yang dibagikan…</div>
        )}

        {/* Sub-page views */}
        {mode === 'create' && (
          <CreateGunPage
            onBack={handleBackToList}
            onSuccess={() => {
              handleBackToList()
              setTab('Catalog')
            }}
          />
        )}

        {mode === 'edit' && (
          <EditGunPage
            gun={editingGun}
            gunId={editingGun?.id}
            onBack={handleBackToList}
            onSuccess={() => {
              handleBackToList()
              setTab('Catalog')
            }}
          />
        )}

        {mode === 'profile-edit' && (
          <ProfileEditPage
            onBack={handleBackToList}
            onSuccess={() => {
              handleBackToList()
              setTab('Profile')
            }}
          />
        )}

        {mode === 'detail' && selectedGun && (
          <GunDetail
            gun={selectedGun}
            onBack={handleBackToList}
            onEdit={(g) => handleNavigate('Edit', g)}
            onDelete={(g) => setDeleteTarget(g)}
            onAddToCart={cart.addItem}
          />
        )}

        {/* Top-level Tabs */}
        {mode === 'list' && (
          <>
            {tab === 'Catalog' && (
              <Catalog
                onNavigate={(destination, payload) => handleNavigate(destination, payload)}
                onAddToCart={cart.addItem}
              />
            )}
            {tab === 'Favorites' && (
              <FavoritesPage
                onSelectGun={(g) => handleNavigate('Detail', g)}
                onNavigateCatalog={() => setTab('Catalog')}
              />
            )}
            {tab === 'Profile' && (
              <ProfilePage
                onReplaySplash={() => setShowSplash(true)}
                onEditProfile={() => handleNavigate('ProfileEdit')}
                onResumeDraft={async (draft) => {
                  if (draft.kind === 'catalog') {
                    setTab('Catalog')
                    handleNavigate('Detail', draft.product)
                    return
                  }
                  if (draft.id === 'create') {
                    handleNavigate('Create')
                    return
                  }
                  try {
                    const response = await gunService.getGunById(draft.id)
                    handleNavigate('Edit', response.data)
                  } catch (error) {
                    alert(error.message || 'Draft tidak dapat dibuka.')
                  }
                }}
              />
            )}
            {tab === 'Cart' && (
              <CartPage
                items={cart.items}
                total={cart.total}
                onQuantity={cart.setQuantity}
                onRemove={cart.removeItem}
              />
            )}
          </>
        )}
      </main>

      {/* Global Delete Confirmation */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Pindahkan ke Sampah"
        message={`"${deleteTarget?.name}" akan disembunyikan dari katalog dan bisa dipulihkan dari tab Sampah.`}
        confirmLabel="Pindahkan"
        danger
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            setDeleting(true)
            await gunService.deleteGun(deleteTarget.id)
            setDeleteTarget(null)
            handleBackToList()
            setTab('Catalog')
          } catch (err) {
            alert(err.message || 'Gagal memindahkan item ke Sampah.')
          } finally {
            setDeleting(false)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <PWABadge />
      <Footer />
    </div>
  )
}

export default App
