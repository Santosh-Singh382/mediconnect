const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const orderController = require('../controllers/order.controller')

const patientRouter = express.Router()
const pharmacyRouter = express.Router()

patientRouter.use(requireAuth, requireRole('PATIENT'))

patientRouter.post('/checkout', orderController.checkout)
patientRouter.get('/', orderController.listOrders)
patientRouter.get('/:orderId', orderController.getOrder)

pharmacyRouter.use(requireAuth, requireRole('PHARMACY'))

pharmacyRouter.get('/summary', orderController.getPharmacyOrderSummary)
pharmacyRouter.get('/', orderController.listPharmacyOrders)
pharmacyRouter.get('/:orderId', orderController.getPharmacyOrder)
pharmacyRouter.patch(
  '/:orderId/status',
  orderController.updatePharmacyOrderStatus,
)

module.exports = { patientRouter, pharmacyRouter }
