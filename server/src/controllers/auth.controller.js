const asyncHandler = require('../utils/asyncHandler')
const { registerUser, loginUser } = require('../services/auth.service')

const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body)
  res.status(201).json({
    success: true,
    data: { user },
  })
})

const login = asyncHandler(async (req, res) => {
  const { token, user } = await loginUser(req.body)
  res.status(200).json({
    success: true,
    data: { token, user },
  })
})

const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  })
})

module.exports = {
  register,
  login,
  getCurrentUser,
}