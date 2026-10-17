const mongoose = require('mongoose')
const env = require('./env')

const CONNECTION_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
}

async function connectDatabase() {
  mongoose.connection.on('error', (error) => {
    console.error(`MongoDB connection error: ${error.message}`)
  })

  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 10000,
  })

  return mongoose.connection
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) {
    return
  }
  await mongoose.connection.close()
}

function getDatabaseStatus() {
  return CONNECTION_STATES[mongoose.connection.readyState] || 'unknown'
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
}
