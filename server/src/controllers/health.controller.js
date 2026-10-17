const env = require('../config/env')
const { getDatabaseStatus } = require('../config/database')

function getHealth(req, res) {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'mediconnect-api',
      environment: env.nodeEnv,
      database: getDatabaseStatus(),
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  })
}

module.exports = { getHealth }