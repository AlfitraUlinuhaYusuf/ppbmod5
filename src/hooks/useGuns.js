import { useState, useEffect, useCallback, useRef } from 'react'
import gunService from '../services/gunService'

// ---------------------------------------------------------------------------
// useGuns — fetch the paginated / filtered product list from the API.
//
// Returns { guns, loading, error, pagination, refetch }.
// When the API is unreachable the `error` string will be set and `guns`
// will remain an empty array so the UI can show a proper error state.
// ---------------------------------------------------------------------------

export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)
  const [loadedQueryKey, setLoadedQueryKey] = useState(null)
  const [loadedPage, setLoadedPage] = useState(null)
  const requestId = useRef(0)

  // Serialise params so the effect re-runs when they change.
  const paramKey = JSON.stringify(params)

  const fetchGuns = useCallback(async () => {
    const request = ++requestId.current
    const requestParams = JSON.parse(paramKey)
    const queryBaseKey = JSON.stringify({ ...requestParams, page: 1 })
    try {
      setLoading(true)
      setError(null)

      const response = await gunService.getGuns(requestParams)
      if (request !== requestId.current) return

      if (response.success) {
        const pageData = response.data || []
        setLoadedQueryKey(queryBaseKey)
        setLoadedPage(Number(requestParams.page) || 1)
        setGuns(pageData)
        const pageInfo = response.pagination || {}
        setPagination({
          ...pageInfo,
          page: Number(pageInfo.page || requestParams.page || 1),
          limit: Number(pageInfo.limit || requestParams.limit || 12),
          hasMore: pageInfo.hasMore ?? pageData.length >= Number(requestParams.limit || 12),
          totalPages: Number(pageInfo.totalPages || pageInfo.total_pages || 0),
        })
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      if (request === requestId.current) {
        setError(err.message || 'An error occurred while fetching products.')
        setGuns([])
      }
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [paramKey])

  useEffect(() => {
    fetchGuns()
  }, [fetchGuns])

  const currentBaseKey = JSON.stringify({ ...JSON.parse(paramKey), page: 1 })
  const isCurrentQuery = loadedQueryKey === currentBaseKey
  const currentPage = Number(JSON.parse(paramKey).page) || 1
  const isCurrentPage = loadedPage === currentPage
  return {
    guns: isCurrentQuery && isCurrentPage ? guns : [],
    loading,
    error,
    pagination: isCurrentQuery && isCurrentPage ? pagination : null,
    refetch: fetchGuns,
  }
}

// ---------------------------------------------------------------------------
// useGunById — fetch a single product by its UUID.
//
// Returns { gun, loading, error, refetch }.
// ---------------------------------------------------------------------------

export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGun = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)

      const response = await gunService.getGunById(id)

      if (response.success) {
        setGun(response.data)
      } else {
        setError(response.message || 'Product not found.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load product details.')
      setGun(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchGun()
  }, [fetchGun])

  return { gun, loading, error, refetch: fetchGun }
}
