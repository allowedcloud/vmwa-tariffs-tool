import assert from 'node:assert/strict'
import { getQuote, getPerMileRate } from '../server/utils/rateLookup.js'

// miles at boundary: 30 should use 1-30 row for weight 2100
assert.equal(getPerMileRate(30, 2100), 69.95)

// weight between columns: 7200 should choose 7500 column
// For miles=412 (401-420 row), 7500 column is 144.7
assert.equal(getPerMileRate(412, 7200), 144.7)

// weight > 12000 should choose "12000 and over" column
// For miles=412 (401-420 row), "12000 and over" is 101.78
assert.equal(getPerMileRate(412, 13000), 101.78)

// quote calculation uses per-mile rate * (weight / 100)
assert.deepEqual(getQuote(412, 7200), {
  perMileRate: 144.7,
  totalCost: 10418.4,
})

process.stdout.write('rate-lookup examples passed\n')
