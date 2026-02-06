import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OVER_COLUMN_NAME = '12000 and over'
let cachedChart = null

function roundToCents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function assertFiniteNonNegativeNumber(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number. Received: ${value}`)
  }

  if (value < 0) {
    throw new RangeError(`${name} must be non-negative. Received: ${value}`)
  }
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      }
      else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += ch
  }

  cells.push(current.trim())
  return cells
}

function parseNumberField(value, contextLabel) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${contextLabel}: "${value}"`)
  }
  return parsed
}

function normalizeChart(parsed) {
  if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) {
    throw new Error('Rate chart has no data rows.')
  }

  const overColumn = parsed.weightColumns.find(col => col.label === OVER_COLUMN_NAME)
  if (!overColumn) {
    throw new Error(`Missing required weight column: "${OVER_COLUMN_NAME}".`)
  }

  const numericWeightColumns = parsed.weightColumns
    .filter(col => Number.isFinite(col.numericWeight))
    .sort((a, b) => a.numericWeight - b.numericWeight)

  if (numericWeightColumns.length === 0) {
    throw new Error('Rate chart has no numeric weight columns.')
  }

  const sortedRows = parsed.rows.slice().sort((a, b) => a.milesStart - b.milesStart)

  return {
    rows: sortedRows,
    numericWeightColumns,
    overColumnName: OVER_COLUMN_NAME,
  }
}

function parseRateChartCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.')
  }

  const header = parseCsvLine(lines[0])
  if (header.length < 3) {
    throw new Error('CSV header is missing required columns.')
  }

  if (header[0] !== 'miles_start' || header[1] !== 'miles_end') {
    throw new Error('CSV must start with columns: miles_start,miles_end')
  }

  const weightColumns = header.slice(2).map((label) => {
    const numericWeight = Number.parseInt(label, 10)
    return {
      label,
      numericWeight: Number.isFinite(numericWeight) ? numericWeight : Number.NaN,
    }
  })

  const rows = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line)

    if (cells.length !== header.length) {
      throw new Error(
        `Row ${index + 2} has ${cells.length} columns, expected ${header.length}.`,
      )
    }

    const milesStart = parseNumberField(cells[0], `row ${index + 2} miles_start`)
    const milesEnd = parseNumberField(cells[1], `row ${index + 2} miles_end`)

    if (milesStart > milesEnd) {
      throw new Error(`Row ${index + 2} has miles_start > miles_end.`)
    }

    const ratesByColumn = Object.create(null)

    for (let i = 0; i < weightColumns.length; i += 1) {
      const col = weightColumns[i]
      const cell = cells[i + 2]
      ratesByColumn[col.label] = parseNumberField(cell, `row ${index + 2} column "${col.label}"`)
    }

    return {
      milesStart,
      milesEnd,
      ratesByColumn,
    }
  })

  return normalizeChart({ rows, weightColumns })
}

function loadRateChart(csvPath = resolve(process.cwd(), 'mileage_weight_rate_chart.csv')) {
  const raw = readFileSync(csvPath, 'utf8')
  return parseRateChartCsv(raw)
}

function getChart(csvPath) {
  if (!cachedChart || csvPath) {
    cachedChart = loadRateChart(csvPath)
  }
  return cachedChart
}

function getRowForMiles(chart, miles) {
  const firstRow = chart.rows[0]
  const lastRow = chart.rows[chart.rows.length - 1]

  if (miles <= firstRow.milesStart) {
    return firstRow
  }

  if (miles >= lastRow.milesEnd) {
    return lastRow
  }

  const matched = chart.rows.find(row => miles >= row.milesStart && miles <= row.milesEnd)
  return matched || lastRow
}

function getColumnForWeight(chart, weight) {
  const matched = chart.numericWeightColumns.find(col => weight <= col.numericWeight)
  if (matched) {
    return matched.label
  }

  return chart.overColumnName
}

export function getPerMileRate(miles, weight, options = {}) {
  assertFiniteNonNegativeNumber('miles', miles)
  assertFiniteNonNegativeNumber('weight', weight)

  const chart = getChart(options.csvPath)
  const row = getRowForMiles(chart, miles)
  const columnName = getColumnForWeight(chart, weight)
  const rate = row.ratesByColumn[columnName]

  return roundToCents(rate)
}

export function getQuote(miles, weight, options = {}) {
  const perMileRate = getPerMileRate(miles, weight, options)
  const hundredWeightUnits = weight / 100
  const totalCost = roundToCents(perMileRate * hundredWeightUnits)

  return {
    perMileRate,
    totalCost,
  }
}

export function _testing() {
  return {
    parseCsvLine,
    parseRateChartCsv,
    getRowForMiles,
    getColumnForWeight,
    roundToCents,
  }
}
