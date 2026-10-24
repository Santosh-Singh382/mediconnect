import api from './api.js'

export function getCart() {
  return api.get('/cart')
}

export function addCartItem(medicineId, quantity) {
  return api.post('/cart/items', { medicineId, quantity })
}

export function updateCartItem(medicineId, quantity) {
  return api.patch(`/cart/items/${medicineId}`, { quantity })
}

export function removeCartItem(medicineId) {
  return api.delete(`/cart/items/${medicineId}`)
}

export function clearCart(cartId) {
  return api.delete(`/cart/${cartId}`)
}
