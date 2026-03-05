import type { DataRow } from '@/context/DataContext'

export type MissingStrategy = 'drop' | 'mean' | 'median' | 'zero' | 'ffill'
export type ScaleMethod = 'none' | 'minmax' | 'zscore'
export type FilterMethod = 'none' | 'moving_avg'
export type OutlierMethod = 'none' | 'iqr' | 'zscore'

export function movingAverage(data: number[], window: number): number[] {
  const result: number[] = []
  const half = Math.floor(window / 2)
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - half)
    const end = Math.min(data.length - 1, i + half)
    let sum = 0
    let count = 0
    for (let j = start; j <= end; j++) {
      sum += data[j]
      count++
    }
    result.push(sum / count)
  }
  return result
}

export function handleMissingValues(data: DataRow[], cols: string[], strategy: MissingStrategy): DataRow[] {
  let result = data.map((r) => ({ ...r }))

  if (strategy === 'drop') {
    result = result.filter((row) =>
      cols.every((c) => row[c] !== null && row[c] !== undefined && row[c] !== '' && !(typeof row[c] === 'number' && isNaN(row[c] as number)))
    )
  } else {
    const colVals: Record<string, number[]> = {}
    for (const col of cols) {
      colVals[col] = []
      for (const row of result) {
        const v = row[col]
        if (v !== null && v !== undefined && v !== '' && !(typeof v === 'number' && isNaN(v as number))) {
          colVals[col].push(Number(v))
        }
      }
    }

    for (const col of cols) {
      const vals = colVals[col]
      let fillValue = 0
      if (strategy === 'mean') {
        fillValue = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      } else if (strategy === 'median') {
        const sorted = [...vals].sort((a, b) => a - b)
        fillValue = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
      }

      let lastVal = fillValue
      for (const row of result) {
        const v = row[col]
        if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v as number))) {
          if (strategy === 'ffill') {
            row[col] = lastVal
          } else {
            row[col] = +fillValue.toFixed(6)
          }
        } else {
          lastVal = Number(v)
        }
      }
    }
  }

  return result
}

export function removeOutliers(data: DataRow[], cols: string[], method: OutlierMethod, threshold: number): DataRow[] {
  if (method === 'none') return data
  let result = [...data]

  for (const col of cols) {
    const vals = result.map((r) => Number(r[col])).filter((v) => !isNaN(v))
    if (vals.length === 0) continue

    if (method === 'iqr') {
      const sorted = [...vals].sort((a, b) => a - b)
      const q1 = sorted[Math.floor(sorted.length * 0.25)]
      const q3 = sorted[Math.floor(sorted.length * 0.75)]
      const iqr = q3 - q1
      const lower = q1 - threshold * iqr
      const upper = q3 + threshold * iqr
      result = result.filter((r) => {
        const v = Number(r[col])
        return v >= lower && v <= upper
      })
    } else if (method === 'zscore') {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1e-10
      result = result.filter((r) => {
        const z = Math.abs((Number(r[col]) - mean) / std)
        return z <= threshold
      })
    }
  }

  return result
}

export function applySmoothingFilter(data: DataRow[], cols: string[], method: FilterMethod, window: number): DataRow[] {
  if (method === 'none' || window <= 1) return data
  const result = data.map((r) => ({ ...r }))

  for (const col of cols) {
    const vals = result.map((r) => Number(r[col]))
    const smoothed = movingAverage(vals, window)
    result.forEach((row, i) => { row[col] = +smoothed[i].toFixed(6) })
  }

  return result
}

export function scaleData(data: DataRow[], cols: string[], method: ScaleMethod): DataRow[] {
  if (method === 'none') return data
  const result = data.map((r) => ({ ...r }))

  for (const col of cols) {
    const vals = result.map((r) => Number(r[col]))
    if (vals.length === 0) continue

    if (method === 'minmax') {
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const range = max - min || 1e-10
      result.forEach((row) => { row[col] = +((Number(row[col]) - min) / range).toFixed(6) })
    } else if (method === 'zscore') {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 1e-10
      result.forEach((row) => { row[col] = +((Number(row[col]) - mean) / std).toFixed(6) })
    }
  }

  return result
}

export function computeColumnStats(data: DataRow[], cols: string[]): Record<string, { missing: number; mean: number; std: number; min: number; max: number }> {
  const stats: Record<string, { missing: number; mean: number; std: number; min: number; max: number }> = {}
  for (const col of cols) {
    const vals: number[] = []
    let missing = 0
    for (const row of data) {
      const v = row[col]
      if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) {
        missing++
      } else {
        vals.push(Number(v))
      }
    }
    const mean = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    const std = vals.length > 0 ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) : 0
    stats[col] = {
      missing,
      mean: +mean.toFixed(4),
      std: +std.toFixed(4),
      min: vals.length > 0 ? +Math.min(...vals).toFixed(4) : 0,
      max: vals.length > 0 ? +Math.max(...vals).toFixed(4) : 0,
    }
  }
  return stats
}
