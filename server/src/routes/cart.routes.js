const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const cartController = require('../controllers/cart.controller')

const router = express.Router()

// Cart operations are private to authenticated PATIENT accounts. Identity is
// always derived from the JWT; ownership fields in request bodies are ignored.
router.use(requireAuth, requireRole('PATIENT'))

router.get('/', cartController.getCart)
router.post('/items', cartController.addCartItem)
router.patch('/items/:medicineId', cartController.updateCartItem)
router.delete('/items/:medicineId', cartController.removeCartItem)
router.delete('/:cartId', cartController.clearCart)

module.exports = router
