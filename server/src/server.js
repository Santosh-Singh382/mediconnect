const http = require('http')
const app = require('./app')
const env = require('./config/env')
const { initSocket } = require('./realtime/socket')
const {
  connectDatabase,
  disconnectDatabase,
} = require('./config/database')

async function start() {
  const connection = await connectDatabase()
  console.log(`MongoDB connected (database: ${connection.name})`)

  const server = http.createServer(app)
  const io = initSocket(server)

  await new Promise((resolve) => server.listen(env.port, resolve))
  console.log(`MediConnect API listening on port ${env.port} (${env.nodeEnv})`)

  let shuttingDown = false

  async function shutdown(signal) {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    console.log(`${signal} received. Shutting down MediConnect API.`)

    try {
      await new Promise((resolve) => io.close(resolve))
      await new Promise((resolve) => server.close(resolve))
      await disconnectDatabase()
      console.log('Shutdown complete. Database connection closed.')
      process.exit(0)
    } catch (error) {
      console.error(`Error during shutdown: ${error.message}`)
      process.exit(1)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((error) => {
  console.error(`Failed to start MediConnect API: ${error.message}`)
  process.exit(1)
})
