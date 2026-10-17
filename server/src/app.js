const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

const env = require('./config/env')
const routes = require('./routes')
const notFound = require('./middleware/notFound')
const errorHandler = require('./middleware/errorHandler')
const { apiLimiter } = require('./middleware/rateLimiter')

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(
  cors({
    origin: env.clientOrigins,
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api', apiLimiter, routes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
