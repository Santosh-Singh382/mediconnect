const ApiError = require('../utils/ApiError')

function notFound(req, res, next) {
  next(
    new ApiError(
      404,
      `The requested resource was not found: ${req.method} ${req.originalUrl}`,
      'ROUTE_NOT_FOUND',
    ),
  )
}

module.exports = notFound
