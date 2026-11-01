const STORAGE_KEY = 'bore_barrel_catalog_drafts'

export const getCatalogDrafts = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch (error) {
    console.error('Unable to read saved catalog drafts.', error)
    return []
  }
}

export const isCatalogDraft = (productId) =>
  getCatalogDrafts().some((draft) => String(draft.id) === String(productId))

export const saveCatalogDraft = (product) => {
  if (!product?.id) throw new Error('Produk ini belum memiliki ID katalog.')
  const savedProduct = {
    id: product.id,
    name: product.name,
    type: product.type || product.category || 'Hardware',
    category: product.category || product.type || 'Hardware',
    caliber: product.caliber || '',
    price: Number(product.price) || 0,
    description: product.description || '',
    image_url: product.image_urls?.[0] || product.image_url || product.image || '/guns/pistol.svg',
    image_urls: product.image_urls?.length
      ? product.image_urls
      : [product.image_url || product.image || '/guns/pistol.svg'],
    ingredients: Array.isArray(product.ingredients) ? product.ingredients : [],
    steps: Array.isArray(product.steps) ? product.steps : [],
    savedAt: new Date().toISOString(),
  }
  const drafts = getCatalogDrafts().filter((draft) => String(draft.id) !== String(product.id))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([savedProduct, ...drafts]))
  } catch (error) {
    throw new Error(`Draft katalog tidak dapat disimpan: ${error.message}`)
  }
  return savedProduct
}

export const deleteCatalogDraft = (productId) => {
  const drafts = getCatalogDrafts().filter((draft) => String(draft.id) !== String(productId))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
    return true
  } catch (error) {
    console.error('Unable to remove catalog draft.', error)
    return false
  }
}
