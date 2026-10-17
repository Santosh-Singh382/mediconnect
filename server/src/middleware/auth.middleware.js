const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const { verifyAccessToken } = require('../utils/jwt')
const { serializeUser } = require('../utils/serializeUser')
const User = require('../models/User')

const requireAuth = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization

  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED')
  }

  const token = authorization.slice('Bearer '.length).trim()
  const payload = verifyAccessToken(token)

  if (!payload || !payload.sub) {
    throw new ApiError(401, 'Invalid or expired token', 'INVALID_TOKEN')
  }

  const user = await User.findById(payload.sub)

  if (!user) {
    throw new ApiError(401, 'Account not found', 'UNAUTHORIZED')
  }

  if (!user.isActive) {
    throw new ApiError(401, 'Account is disabled', 'ACCOUNT_DISABLED')
  }

  req.user = serializeUser(user)
  next()
})

const requireRole =
  (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED')
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        'You do not have permission to perform this action',
        'FORBIDDEN',
      )
    }

    next()
  })

module.exports = { requireAuth, requireRole }