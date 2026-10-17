const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/

const POSTAL_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s-]{0,19}$/

const ADDRESS_KEYS = ['street', 'city', 'state', 'postalCode', 'country']

function cleanStringArray(value, { field, maxItems, maxItemLength }) {
  if (!Array.isArray(value)) {
    return { error: { field, message: `${field} must be an array of strings` } }
  }
  if (value.length > maxItems) {
    return {
      error: { field, message: `${field} cannot contain more than ${maxItems} items` },
    }
  }

  const cleaned = []
  for (const item of value) {
    if (typeof item !== 'string') {
      return { error: { field, message: `${field} must contain only strings` } }
    }
    const trimmed = item.trim()
    if (trimmed.length === 0) continue
    if (trimmed.length > maxItemLength) {
      return {
        error: { field, message: `${field} items cannot exceed ${maxItemLength} characters` },
      }
    }
    cleaned.push(trimmed)
  }

  return { value: cleaned }
}

function applyAddressValidation(updates, addError, value, { prefix, label }) {
  if (value === undefined) return

  if (value === null || value === '') {
    for (const key of ADDRESS_KEYS) {
      updates[`${prefix}.${key}`] = null
    }
    return
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    addError(`${prefix}`, `${label} must be an object`)
    return
  }

  for (const key of ADDRESS_KEYS) {
    if (value[key] === undefined) continue

    const field = value[key]
    if (field === null || field === '') {
      updates[`${prefix}.${key}`] = null
      continue
    }
    if (typeof field !== 'string') {
      addError(`${prefix}.${key}`, `${label} fields must be strings`)
      continue
    }

    const trimmed = field.trim()
    if (key === 'postalCode' && !POSTAL_CODE_PATTERN.test(trimmed)) {
      addError(`${prefix}.postalCode`, 'Postal code is not valid')
      continue
    }
    updates[`${prefix}.${key}`] = trimmed || null
  }
}

module.exports = {
  PHONE_PATTERN,
  POSTAL_CODE_PATTERN,
  ADDRESS_KEYS,
  applyAddressValidation,
  cleanStringArray,
}