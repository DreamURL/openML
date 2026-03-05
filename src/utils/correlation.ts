import type { DataRow } from '@/context/DataContext'

export type CorrelationMethod = 'pearson' | 'spearman'

export interface CorrelationResult {
  matrix: number[][]
  features: string[]
  method: CorrelationMethod
  dataCount: number
}

export function pearson(x: number[], y: number[]): number {
  const n = x.length
  if (n === 0) return 0
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0)
  const sumX2 = x.reduce((s, xi) => s + xi * xi, 0)
  const sumY2 = y.reduce((s, yi) => s + yi * yi, 0)
  const num = n * sumXY - sumX * sumY
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  return den === 0 ? 0 : num / den
}

export function spearman(x: number[], y: number[]): number {
  const rank = (arr: number[]) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const ranks = new Array(arr.length)
    sorted.forEach((item, r) => { ranks[item.i] = r + 1 })
    return ranks
  }
  return pearson(rank(x), rank(y))
}

export function getCorrelationColor(value: number): string {
  const abs = Math.abs(value)
  if (abs < 0.1) return 'rgba(148, 163, 184, 0.15)'
  if (value > 0) {
    if (abs < 0.3) return 'rgba(108, 99, 255, 0.2)'
    if (abs < 0.5) return 'rgba(108, 99, 255, 0.4)'
    if (abs < 0.7) return 'rgba(108, 99, 255, 0.6)'
    return 'rgba(108, 99, 255, 0.85)'
  } else {
    if (abs < 0.3) return 'rgba(239, 68, 68, 0.2)'
    if (abs < 0.5) return 'rgba(239, 68, 68, 0.4)'
    if (abs < 0.7) return 'rgba(239, 68, 68, 0.6)'
    return 'rgba(239, 68, 68, 0.85)'
  }
}

export function computeCorrelationMatrix(
  rawData: DataRow[],
  features: string[],
  method: CorrelationMethod
): CorrelationResult {
  const processed = rawData
    .map((row) => {
      const r: Record<string, number | null> = {}
      for (const f of features) {
        const v = Number(row[f])
        r[f] = isNaN(v) ? null : v
      }
      return r
    })
    .filter((r) => features.every((f) => r[f] !== null)) as Record<string, number>[]

  const matrix: number[][] = []
  const corrFn = method === 'pearson' ? pearson : spearman

  for (let i = 0; i < features.length; i++) {
    const row: number[] = []
    for (let j = 0; j < features.length; j++) {
      if (i === j) {
        row.push(1)
      } else {
        const x = processed.map((r) => r[features[i]])
        const y = processed.map((r) => r[features[j]])
        row.push(corrFn(x, y))
      }
    }
    matrix.push(row)
  }

  return { matrix, features: [...features], method, dataCount: processed.length }
}

export function getStrongCorrelations(
  result: CorrelationResult,
  minCorrelation: number
): { f1: string; f2: string; corr: number; strength: string; dir: string }[] {
  const pairs: { f1: string; f2: string; corr: number; strength: string; dir: string }[] = []
  for (let i = 0; i < result.features.length; i++) {
    for (let j = i + 1; j < result.features.length; j++) {
      const c = result.matrix[i][j]
      if (Math.abs(c) >= minCorrelation) {
        const abs = Math.abs(c)
        pairs.push({
          f1: result.features[i],
          f2: result.features[j],
          corr: c,
          strength: abs >= 0.7 ? 'veryStrong' : abs >= 0.5 ? 'strong' : abs >= 0.3 ? 'moderate' : 'weak',
          dir: c > 0 ? 'positive' : 'negative',
        })
      }
    }
  }
  return pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))
}
