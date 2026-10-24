const orderService = require('../services/order.service')

async function checkout(req, res) {
  const result = await orderService.checkout(
    req.user.id,
    req.body,
    req.get('Idempotency-Key'),
  )
  res
    .status(result.replayed ? 200 : 201)
    .json({ success: true, data: { order: result.order } })
}

async function listOrders(req, res) {
  const data = await orderService.listOrders(req.user.id, req.query)
  res.json({ success: true, data })
}

async function getOrder(req, res) {
  const order = await orderService.getOrderById(
    req.user.id,
    req.params.orderId,
  )
  res.json({ success: true, data: { order } })
}

async function listPharmacyOrders(req, res) {
  const data = await orderService.listPharmacyOrders(req.user.id, req.query)
  res.json({ success: true, data })
}

async function getPharmacyOrder(req, res) {
  const order = await orderService.getPharmacyOrderById(
    req.user.id,
    req.params.orderId,
  )
  res.json({ success: true, data: { order } })
}

async function updatePharmacyOrderStatus(req, res) {
  const order = await orderService.updatePharmacyOrderStatus(
    req.user.id,
    req.params.orderId,
    req.body,
  )
  res.json({ success: true, data: { order } })
}

async function getPharmacyOrderSummary(req, res) {
  const summary = await orderService.getPharmacyOrderSummary(req.user.id)
  res.json({ success: true, data: { summary } })
}

module.exports = {
  checkout,
  listOrders,
  getOrder,
  listPharmacyOrders,
  getPharmacyOrder,
  updatePharmacyOrderStatus,
  getPharmacyOrderSummary,
}
