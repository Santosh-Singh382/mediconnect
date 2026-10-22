require('dotenv').config({ quiet: true })

const path = require('path')

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
  medicalDocumentMaxSizeMb: Number(process.env.MEDICAL_DOCUMENT_MAX_SIZE_MB) || 10,
  // Private directory where uploaded medical documents are stored. Overridable
  // so tests can point at a temp location instead of the real uploads folder.
  medicalDocumentUploadDir:
    process.env.MEDICAL_DOCUMENT_UPLOAD_DIR ||
    path.join(__dirname, '..', '..', 'uploads', 'medical-documents'),
}

if (env.clientOrigins.length === 0) {
  env.clientOrigins = ['http://localhost:5173']
}

module.exports = env
