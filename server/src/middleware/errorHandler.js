const BODY_PARSE_ERRORS = new Set(['entity.parse.failed', 'entity.too.large'])

function errorHandler(err, req, res, next) {
  if (err.type && BODY_PARSE_ERRORS.has(err.type)) {
    res.status(400).json({
      success: false,
      message: 'The request body could not be parsed',
      code: 'INVALID_REQUEST_BODY',
    })
    return
  }

  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500
  const isOperational = err.isOperational === true

  if (!isOperational) {
    console.error(err)
  }

  const body = {
    success: false,
    message: isOperational
      ? err.message
      : 'Something went wrong. Please try again later.',
    code: err.code || (isOperational ? 'REQUEST_ERROR' : 'INTERNAL_ERROR'),
  }

  if (isOperational && err.details) {
    body.details = err.details
  }

  res.status(statusCode).json(body)
}

module.exports = errorHandler
