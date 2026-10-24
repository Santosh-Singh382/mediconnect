import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  addCartItem,
  clearCart as clearCartRequest,
  getCart,
  removeCartItem,
  updateCartItem,
} from '../lib/cartApi.js'
import { CartContext } from './cartContext.js'

function emptySummary() {
  return {
    cartCount: 0,
    itemCount: 0,
    totalQuantity: 0,
    subtotal: 0,
  }
}

function emptyState(ownerId = null) {
  return {
    carts: [],
    summary: emptySummary(),
    loading: false,
    error: null,
    ownerId,
  }
}

function summarize(carts) {
  const summary = carts.reduce(
    (total, cart) => ({
      cartCount: total.cartCount + 1,
      itemCount: total.itemCount + (cart.itemCount || 0),
      totalQuantity: total.totalQuantity + (cart.totalQuantity || 0),
      subtotal: total.subtotal + (cart.subtotal || 0),
    }),
    emptySummary(),
  )

  return {
    ...summary,
    subtotal: Math.round((summary.subtotal + Number.EPSILON) * 100) / 100,
  }
}

function sortCarts(carts) {
  return [...carts].sort((left, right) => {
    const leftName = left.pharmacy?.pharmacyName || ''
    const rightName = right.pharmacy?.pharmacyName || ''
    return leftName.localeCompare(rightName)
  })
}

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id || null
  const isPatient = !authLoading && user?.role === 'PATIENT'
  const [state, setState] = useState(emptyState)
  const requestVersion = useRef(0)

  const refresh = useCallback(() => {
    requestVersion.current += 1
    const version = requestVersion.current

    if (!isPatient) {
      return Promise.resolve(null)
    }

    return getCart()
      .then((response) => {
        if (requestVersion.current !== version) {
          return null
        }

        const data = response.data.data
        const carts = Array.isArray(data.carts) ? data.carts : []
        setState({
          carts,
          summary: data.summary || summarize(carts),
          loading: false,
          error: null,
          ownerId: userId,
        })
        return data
      })
      .catch((error) => {
        if (requestVersion.current !== version) {
          return null
        }
        setState((current) => ({
          ...(current.ownerId === userId ? current : emptyState(userId)),
          ownerId: userId,
          loading: false,
          error: getApiErrorMessage(
            error,
            'Unable to load your cart right now.',
          ),
        }))
        return null
      })
  }, [isPatient, userId])

  useEffect(() => {
    if (authLoading) {
      return undefined
    }

    if (!isPatient) {
      requestVersion.current += 1
      return undefined
    }

    refresh()
    return () => {
      requestVersion.current += 1
    }
  }, [authLoading, isPatient, refresh])

  const applyCart = useCallback(
    (cart) => {
      requestVersion.current += 1
      setState((current) => {
        const baseCarts = current.ownerId === userId ? current.carts : []
        const carts = sortCarts([
          ...baseCarts.filter((item) => item.cartId !== cart.cartId),
          cart,
        ])
        return {
          carts,
          summary: summarize(carts),
          loading: false,
          error: null,
          ownerId: userId,
        }
      })
    },
    [userId],
  )

  const addItem = useCallback(
    async (medicineId, quantity = 1) => {
      const response = await addCartItem(medicineId, quantity)
      const cart = response.data.data.cart
      applyCart(cart)
      return cart
    },
    [applyCart],
  )

  const updateItem = useCallback(
    async (medicineId, quantity) => {
      const response = await updateCartItem(medicineId, quantity)
      const cart = response.data.data.cart
      applyCart(cart)
      return cart
    },
    [applyCart],
  )

  const removeItem = useCallback(async (medicineId, cartId) => {
    const response = await removeCartItem(medicineId)
    const cart = response.data.data.cart

    requestVersion.current += 1
    setState((current) => {
      const baseCarts = current.ownerId === userId ? current.carts : []
      const removedCartId =
        cartId ||
        baseCarts.find((item) =>
          item.items.some((entry) => entry.medicineId === medicineId),
        )?.cartId
      const carts = cart
        ? sortCarts([
            ...baseCarts.filter((item) => item.cartId !== cart.cartId),
            cart,
          ])
        : baseCarts.filter((item) => item.cartId !== removedCartId)

      return {
        carts,
        summary: summarize(carts),
        loading: false,
        error: null,
        ownerId: userId,
      }
    })
    return cart
  }, [userId])

  const clearCart = useCallback(
    async (cartId) => {
      await clearCartRequest(cartId)
      requestVersion.current += 1
      setState((current) => {
        const baseCarts = current.ownerId === userId ? current.carts : []
        const carts = baseCarts.filter((cart) => cart.cartId !== cartId)
        return {
          carts,
          summary: summarize(carts),
          loading: false,
          error: null,
          ownerId: userId,
        }
      })
    },
    [userId],
  )

  const ownerMatches = isPatient && state.ownerId === userId

  return (
    <CartContext.Provider
      value={{
        carts: ownerMatches ? state.carts : [],
        summary: ownerMatches ? state.summary : emptySummary(),
        loading: isPatient && !ownerMatches ? true : state.loading,
        error: ownerMatches ? state.error : null,
        refresh,
        addItem,
        updateItem,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}
