const appointmentService = require('../services/appointment.service')

async function getAvailability(req, res) {
  const data = await appointmentService.getAvailability(
    req.params.doctorId,
    req.query.date,
  )
  res.json({ success: true, data })
}

async function createAppointment(req, res) {
  const data = await appointmentService.createAppointment(req.user.id, req.body)
  res.status(201).json({ success: true, data: { appointment: data } })
}

async function getMyAppointments(req, res) {
  const data = await appointmentService.listAppointments({
    role: 'PATIENT',
    userId: req.user.id,
    query: req.query,
  })
  res.json({ success: true, data })
}

async function getDoctorAppointments(req, res) {
  const data = await appointmentService.listAppointments({
    role: 'DOCTOR',
    userId: req.user.id,
    query: req.query,
  })
  res.json({ success: true, data })
}

async function getAppointment(req, res) {
  const data = await appointmentService.getAppointmentById(
    req.params.appointmentId,
    req.user.id,
  )
  res.json({ success: true, data: { appointment: data } })
}

async function confirmAppointment(req, res) {
  const data = await appointmentService.confirmAppointment(
    req.params.appointmentId,
    req.user.id,
  )
  res.json({ success: true, data: { appointment: data } })
}

async function rejectAppointment(req, res) {
  const data = await appointmentService.rejectAppointment(
    req.params.appointmentId,
    req.user.id,
  )
  res.json({ success: true, data: { appointment: data } })
}

async function completeAppointment(req, res) {
  const data = await appointmentService.completeAppointment(
    req.params.appointmentId,
    req.user.id,
  )
  res.json({ success: true, data: { appointment: data } })
}

async function cancelAppointment(req, res) {
  const data = await appointmentService.cancelAppointment(
    req.params.appointmentId,
    req.user.id,
  )
  res.json({ success: true, data: { appointment: data } })
}

module.exports = {
  getAvailability,
  createAppointment,
  getMyAppointments,
  getDoctorAppointments,
  getAppointment,
  confirmAppointment,
  rejectAppointment,
  completeAppointment,
  cancelAppointment,
}