import { useCallback, useState } from 'react'

const CART_KEY = 'bore_barrel_cart'

const readCart = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export function useCart() {
  const [items, setItems] = useState(readCart)

  const updateCart = useCallback((updater) => {
    setItems((current) => {
      const next = updater(current)
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(next))
      } catch (error) {
        console.error('Unable to persist cart contents.', error)
      }
      return next
    })
  }, [])

  const addItem = useCallback((product) => {
    updateCart((current) => {
      const existing = current.find((item) => String(item.id) === String(product.id))
      if (existing) {
        return current.map((item) =>
          String(item.id) === String(product.id)
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }
      return [...current, {
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        image_url: product.image_url || product.image || '/guns/pistol.svg',
        quantity: 1,
      }]
    })
  }, [updateCart])

  const setQuantity = useCallback((id, quantity) => {
    const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1))
    updateCart((current) => current.map((item) =>
      String(item.id) === String(id) ? { ...item, quantity: safeQuantity } : item,
    ))
  }, [updateCart])

  const removeItem = useCallback((id) => {
    updateCart((current) => current.filter((item) => String(item.id) !== String(id)))
  }, [updateCart])

  const clearCart = useCallback(() => updateCart(() => []), [updateCart])

  return {
    items,
    count: items.reduce((total, item) => total + item.quantity, 0),
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addItem,
    setQuantity,
    removeItem,
    clearCart,
  }
}
