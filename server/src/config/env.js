require('dotenv').config({ quiet: true })

const parseOrigins = (value) =>
  (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

function required(name) {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to server/.env (see server/.env.example).`,
    )
  }
  return value.trim()
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongodbUri: required('MONGODB_URI'),
  clientOrigins: parseOrigins(process.env.CLIENT_URL),
  jwtSecret: required('JWT_SECRET'),
}

if (env.clientOrigins.length === 0) {
  env.clientOrigins = ['http://localhost:5173']
}

module.exports = env
