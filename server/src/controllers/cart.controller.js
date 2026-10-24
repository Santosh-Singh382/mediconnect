const cartService = require('../services/cart.service')

async function getCart(req, res) {
  const data = await cartService.getCart(req.user.id)
  res.json({ success: true, data })
}

async function addCartItem(req, res) {
  const cart = await cartService.addCartItem(req.user.id, req.body)
  res.status(201).json({ success: true, data: { cart } })
}

async function updateCartItem(req, res) {
  const cart = await cartService.updateCartItem(
    req.user.id,
    req.params.medicineId,
    req.body,
  )
  res.json({ success: true, data: { cart } })
}

async function removeCartItem(req, res) {
  const cart = await cartService.removeCartItem(
    req.user.id,
    req.params.medicineId,
  )
  res.json({ success: true, data: { cart } })
}

async function clearCart(req, res) {
  const data = await cartService.clearCart(req.user.id, req.params.cartId)
  res.json({ success: true, data })
}

module.exports = {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
}
