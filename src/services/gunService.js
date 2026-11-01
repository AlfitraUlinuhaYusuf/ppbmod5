import { apiClient, IS_SUPABASE } from '../config/api'

const QUERY_CACHE_TTL = 30_000
const queryCache = new Map()
const pendingQueries = new Map()
let cacheVersion = 0
let supportsDeletedAt = null
let supportsImageUrls = null
const LOCAL_METADATA_KEY = 'bore_barrel_product_metadata'

const readLocalMetadata = () => {
  try {
    const metadata = JSON.parse(localStorage.getItem(LOCAL_METADATA_KEY) || '{}')
    return {
      deletedIds: Array.isArray(metadata.deletedIds) ? metadata.deletedIds.map(String) : [],
      images: metadata.images && typeof metadata.images === 'object' ? metadata.images : {},
    }
  } catch (error) {
    console.warn('Product metadata could not be read from local storage.', error)
    return { deletedIds: [], images: {} }
  }
}

const writeLocalMetadata = (metadata) => {
  try {
    localStorage.setItem(LOCAL_METADATA_KEY, JSON.stringify(metadata))
  } catch (error) {
    throw new Error(`Product metadata could not be saved locally: ${error.message}`)
  }
}

const isMissingColumn = (error, column) => {
  const message = `${error?.message || ''} ${JSON.stringify(error?.raw || '')}`.toLowerCase()
  return message.includes(column.toLowerCase()) &&
    /(does not exist|could not find|unknown column|schema cache)/.test(message)
}

const rememberProductImages = (id, urls) => {
  if (id === undefined || id === null) return
  const metadata = readLocalMetadata()
  metadata.images[String(id)] = urls
  writeLocalMetadata(metadata)
}

const updateLocalDeletedIds = (id, isDeleted) => {
  const metadata = readLocalMetadata()
  const targetId = String(id)
  metadata.deletedIds = isDeleted
    ? [...new Set([...metadata.deletedIds, targetId])]
    : metadata.deletedIds.filter((deletedId) => deletedId !== targetId)
  writeLocalMetadata(metadata)
}

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return {
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          }
        }
        return {
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  const localImages = readLocalMetadata().images[String(item.id)]
  const imageUrls = Array.isArray(localImages)
    ? localImages
    : Array.isArray(item.image_urls)
    ? item.image_urls.filter((url) => typeof url === 'string' && url)
    : item.image_url || item.image
      ? [item.image_url || item.image]
      : []

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_urls: imageUrls.length > 0 ? imageUrls : ['/guns/pistol.svg'],
    image_url: imageUrls[0] || '/guns/pistol.svg',
    image: imageUrls[0] || '/guns/pistol.svg',
    ingredients: specsList,
    steps: stepsList,
  }
}

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints.
// Supports both Supabase PostgREST table (/rest/v1/products) and
// standard REST API (/api/v1/recipes).
// ---------------------------------------------------------------------------
class GunService {
  invalidateCache() {
    cacheVersion += 1
    queryCache.clear()
    pendingQueries.clear()
  }

  /**
   * Fetch a paginated, filterable list of products.
   */
  async getGuns(params = {}) {
    const cacheKey = JSON.stringify(params)
    const cached = queryCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL) {
      return cached.value
    }
    if (pendingQueries.has(cacheKey)) {
      return pendingQueries.get(cacheKey)
    }

    const requestVersion = cacheVersion
    const request = this.fetchGuns(params)
      .then((value) => {
        if (requestVersion === cacheVersion) {
          queryCache.set(cacheKey, { value, timestamp: Date.now() })
        }
        return value
      })
      .finally(() => pendingQueries.delete(cacheKey))
    pendingQueries.set(cacheKey, request)
    return request
  }

  async fetchGuns(params = {}) {
    if (IS_SUPABASE) {
      const queryParts = ['select=*']

      if (params.search) {
        queryParts.push(`name=ilike.*${encodeURIComponent(params.search)}*`)
      }

      if (params.category && params.category !== 'All') {
        queryParts.push(`type=eq.${encodeURIComponent(params.category)}`)
      }

      if (params.sort_by) {
        const order = params.order === 'desc' ? 'desc' : 'asc'
        queryParts.push(`order=${encodeURIComponent(params.sort_by)}.${order}`)
      } else {
        queryParts.push('order=created_at.desc')
      }

      if (supportsDeletedAt !== false) {
        queryParts.push(params.include_deleted ? 'deleted_at=not.is.null' : 'deleted_at=is.null')
      }
      const limit = Number(params.limit) || 12
      const page = Math.max(Number(params.page) || 1, 1)
      let total = null
      let allRows = []
      try {
        const requestParts = [...queryParts]
        if (supportsDeletedAt !== false) {
          requestParts.push(`limit=${limit}`, `offset=${(page - 1) * limit}`)
        }
        const response = await apiClient.get(`/rest/v1/products?${requestParts.join('&')}`, {
          headers: { Prefer: 'count=exact' },
          returnFullResponse: true,
        })
        allRows = Array.isArray(response.data) ? response.data : []
        const contentRange = response.headers?.['content-range']
        const countMatch = typeof contentRange === 'string' && contentRange.match(/\/(\d+|\*)$/)
        if (countMatch && countMatch[1] !== '*') total = Number(countMatch[1])
        if (supportsDeletedAt === null) supportsDeletedAt = true
      } catch (error) {
        if (supportsDeletedAt !== false && isMissingColumn(error, 'deleted_at')) {
          supportsDeletedAt = false
          console.warn('Supabase products has no deleted_at column; using this browser’s demo archive.')
          const compatibleParts = queryParts.filter((part) => !part.startsWith('deleted_at='))
          const response = await apiClient.get(`/rest/v1/products?${compatibleParts.join('&')}`, {
            headers: { Prefer: 'count=exact' },
            returnFullResponse: true,
          })
          allRows = Array.isArray(response.data) ? response.data : []
          const contentRange = response.headers?.['content-range']
          const countMatch = typeof contentRange === 'string' && contentRange.match(/\/(\d+|\*)$/)
          if (countMatch && countMatch[1] !== '*') total = Number(countMatch[1])
        } else {
          throw error
        }
      }
      let products = allRows.map(normalizeProduct)
      if (supportsDeletedAt === false) {
        const deletedIds = new Set(readLocalMetadata().deletedIds)
        products = products.filter((product) =>
          deletedIds.has(String(product.id)) === Boolean(params.include_deleted),
        )
        total = products.length
      }
      if (total === null) total = allRows.length
      const list = supportsDeletedAt === false
        ? products.slice((page - 1) * limit, page * limit)
        : products

      return {
        success: true,
        data: list,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
          localArchive: supportsDeletedAt === false,
        },
      }
    }

    // Fallback: university REST API
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    )
    const response = await apiClient.get('/api/v1/recipes', { params: clean })
    if (response?.data && Array.isArray(response.data)) {
      response.data = response.data.map(normalizeProduct)
      const pageInfo = response.pagination || {}
      const page = Number(pageInfo.page || params.page || 1)
      const limit = Number(pageInfo.limit || params.limit || 12)
      response.pagination = {
        ...pageInfo,
        page,
        limit,
        totalPages: Number(pageInfo.totalPages || pageInfo.total_pages || (Number.isFinite(Number(pageInfo.total)) ? Math.ceil(Number(pageInfo.total) / limit) : 0)),
        hasMore: pageInfo.hasMore ?? pageInfo.has_more ?? pageInfo.has_next_page ?? response.data.length >= limit,
      }
    }
    return response
  }

  /**
   * Fetch a single product by ID.
   */
  async getGunById(id) {
    const cacheKey = `gun:${id}`
    const cached = queryCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL) return cached.value
    if (pendingQueries.has(cacheKey)) return pendingQueries.get(cacheKey)
    const requestVersion = cacheVersion
    const request = this.fetchGunById(id).then((value) => {
      if (requestVersion === cacheVersion) queryCache.set(cacheKey, { value, timestamp: Date.now() })
      return value
    }).finally(() => pendingQueries.delete(cacheKey))
    pendingQueries.set(cacheKey, request)
    return request
  }

  async fetchGunById(id) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) {
        return { success: true, data: normalizeProduct(data[0]) }
      }
      throw new Error('Hardware item not found.')
    }
    return apiClient.get(`/api/v1/recipes/${id}`)
  }

  /**
   * Create a new product.
   */
  async createGun(data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : []

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: data.image_urls?.[0] || data.image_url || null,
        image_urls: data.image_urls || (data.image_url ? [data.image_url] : []),
      }

      if (supportsImageUrls === false) delete payload.image_urls
      let res
      try {
        res = await apiClient.post('/rest/v1/products', payload, {
          headers: { Prefer: 'return=representation' },
        })
        if (supportsImageUrls === null) supportsImageUrls = true
      } catch (error) {
        if (supportsImageUrls !== false && isMissingColumn(error, 'image_urls')) {
          supportsImageUrls = false
          console.warn('Supabase products has no image_urls column; storing additional images in this browser.')
          const compatiblePayload = { ...payload }
          delete compatiblePayload.image_urls
          res = await apiClient.post('/rest/v1/products', compatiblePayload, {
            headers: { Prefer: 'return=representation' },
          })
        } else {
          throw error
        }
      }
      const created = Array.isArray(res) ? res[0] : res
      if (supportsImageUrls === false && data.image_urls) rememberProductImages(created?.id, data.image_urls)
      this.invalidateCache()
      return { success: true, data: normalizeProduct(created) }
    }
    const response = await apiClient.post('/api/v1/recipes', data)
    this.invalidateCache()
    return response
  }

  /**
   * Update existing product.
   */
  async updateGun(id, data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : undefined

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (data.image_url !== undefined || data.image_urls !== undefined) {
        const imageUrls = data.image_urls || [data.image_url]
        payload.image_url = imageUrls[0] || null
        payload.image_urls = imageUrls
      }

      if (supportsImageUrls === false) delete payload.image_urls
      let res
      try {
        res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
          headers: { Prefer: 'return=representation' },
        })
        if (supportsImageUrls === null) supportsImageUrls = true
      } catch (error) {
        if (supportsImageUrls !== false && isMissingColumn(error, 'image_urls')) {
          supportsImageUrls = false
          console.warn('Supabase products has no image_urls column; storing additional images in this browser.')
          const compatiblePayload = { ...payload }
          delete compatiblePayload.image_urls
          res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, compatiblePayload, {
            headers: { Prefer: 'return=representation' },
          })
        } else {
          throw error
        }
      }
      const updated = Array.isArray(res) ? res[0] : res
      if (supportsImageUrls === false && data.image_urls) rememberProductImages(id, data.image_urls)
      this.invalidateCache()
      return { success: true, data: normalizeProduct(updated) }
    }
    const response = await apiClient.put(`/api/v1/recipes/${id}`, data)
    this.invalidateCache()
    return response
  }

  /**
   * Partial update (PATCH).
   */
  async patchGun(id, data) {
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    const response = await apiClient.patch(`/api/v1/recipes/${id}`, data)
    this.invalidateCache()
    return response
  }

  /**
   * Soft-delete product so it can be restored.
   */
  async deleteGun(id) {
    const deletedAt = new Date().toISOString()
    if (IS_SUPABASE) {
      if (supportsDeletedAt === false) {
        updateLocalDeletedIds(id, true)
      } else {
        try {
          await apiClient.patch(
            `/rest/v1/products?id=eq.${id}`,
            { deleted_at: deletedAt },
            { headers: { Prefer: 'return=representation' } },
          )
          supportsDeletedAt = true
        } catch (error) {
          if (!isMissingColumn(error, 'deleted_at')) throw error
          supportsDeletedAt = false
          console.warn('Supabase products has no deleted_at column; archiving this item in this browser.')
          updateLocalDeletedIds(id, true)
        }
      }
      this.invalidateCache()
      return { success: true }
    }
    const response = await apiClient.patch(`/api/v1/recipes/${id}`, { deleted_at: deletedAt })
    this.invalidateCache()
    return response
  }

  async restoreGun(id) {
    if (IS_SUPABASE) {
      if (supportsDeletedAt === false) {
        updateLocalDeletedIds(id, false)
      } else {
        try {
          await apiClient.patch(
            `/rest/v1/products?id=eq.${id}`,
            { deleted_at: null },
            { headers: { Prefer: 'return=representation' } },
          )
          supportsDeletedAt = true
        } catch (error) {
          if (!isMissingColumn(error, 'deleted_at')) throw error
          supportsDeletedAt = false
          console.warn('Supabase products has no deleted_at column; restoring this item in this browser.')
          updateLocalDeletedIds(id, false)
        }
      }
      this.invalidateCache()
      return { success: true }
    }
    const response = await apiClient.patch(`/api/v1/recipes/${id}`, { deleted_at: null })
    this.invalidateCache()
    return response
  }

  async permanentlyDeleteGun(id) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      const metadata = readLocalMetadata()
      metadata.deletedIds = metadata.deletedIds.filter((deletedId) => deletedId !== String(id))
      delete metadata.images[String(id)]
      writeLocalMetadata(metadata)
      this.invalidateCache()
      return { success: true }
    }
    const response = await apiClient.delete(`/api/v1/recipes/${id}`)
    this.invalidateCache()
    return response
  }
}

export default new GunService()
