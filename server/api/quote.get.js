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
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Invalid quote request',
    })
  }
})
