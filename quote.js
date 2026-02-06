#!/usr/bin/env node

import { getQuote } from './server/utils/rateLookup.js'

function printUsage() {
  console.error('Usage: node quote.js --miles <number> --weight <number>')
}

function parseArgs(argv) {
  let miles
  let weight

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--miles') {
      miles = Number(argv[i + 1])
      i += 1
      continue
    }

    if (arg === '--weight') {
      weight = Number(argv[i + 1])
      i += 1
      continue
    }
  }

  if (miles === undefined || weight === undefined) {
    throw new Error('Missing required args --miles and --weight')
  }

  return { miles, weight }
}

try {
  const { miles, weight } = parseArgs(process.argv.slice(2))
  const quote = getQuote(miles, weight)
  process.stdout.write(`${JSON.stringify(quote)}\n`)
}
catch (error) {
  printUsage()
  console.error(error instanceof Error ? error.message : 'Unknown error')
  process.exitCode = 1
}
