const jwt = require('jsonwebtoken')
const env = require('../config/env')

const ACCESS_TOKEN_LIFETIME = '7d'

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: ACCESS_TOKEN_LIFETIME },
  )
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret)
  } catch {
    return null
  }
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
}