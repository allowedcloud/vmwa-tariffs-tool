import { getQuote } from '../utils/rateLookup'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const miles = Number(query.miles)
  const weight = Number(query.weight)

  if (query.miles === undefined || query.weight === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Both query params are required: miles, weight',
    })
  }

  try {
    return getQuote(miles, weight)
  }
  catch (error) {
    const isInputError = error instanceof TypeError || error instanceof RangeError
    throw createError({
      statusCode: isInputError ? 400 : 500,
      statusMessage: error instanceof Error ? error.message : 'Invalid quote request',
    })
  }
})
