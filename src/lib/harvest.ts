// harvest.ts
// Helpers to compute cumulative degree-hours (CDH), estimate rate/ETA, and a readiness score.

export type CdhResult = {
  cdh: number
  series: number[]
}

export type HarvestMetrics = {
  cdh: number
  cdhSeries: number[]
  targetCdh: number
  percent: number
  ratePerHour: number
  etaHours: number | null
  readiness: number // 0-100
}

const clamp = (v:number, lo=0, hi=1) => Math.max(lo, Math.min(hi, v))

/**
 * Compute cumulative degree-hours (CDH) for a series of temperatures.
 * - temps: array of temperature samples (°C)
 * - times: optional array of timestamps in ms aligned to temps
 * - baseTemp: temperature baseline (°C) below which no degree-hours accumulate
 * Returns total CDH and a cumulative series (same length as temps)
 */
export function computeCdh(temps: number[], times?: number[], baseTemp = 20): CdhResult {
  const n = temps.length
  if (n === 0) return { cdh: 0, series: [] }

  // If no times provided, assume uniform small interval (samples per second scale may vary).
  const series: number[] = new Array(n).fill(0)
  let total = 0

  for (let i = 0; i < n; i++) {
    const t = temps[i]
    // duration to next sample in hours
    let dtHours = 0
    if (times && times[i] !== undefined && times[i+1] !== undefined) {
      dtHours = Math.max(0, (times[i+1] - times[i]) / 1000 / 3600)
    } else if (i > 0 && times && times[i-1] !== undefined) {
      dtHours = Math.max(0, (times[i] - times[i-1]) / 1000 / 3600)
    } else {
      // fallback to a small interval (0.0025 h ~ 9s) which matches the Overview sim cadence
      dtHours = 9 / 3600
    }

    const delta = Math.max(0, t - baseTemp) * dtHours
    total += delta
    series[i] = Number(total.toFixed(3))
  }

  return { cdh: Number(total.toFixed(3)), series }
}

/** Estimate CDH growth rate (°C-hours per hour) using the last windowHours of data. */
export function estimateRate(cdhSeries: number[], times?: number[], windowHours = 6): number {
  if (!cdhSeries || cdhSeries.length < 2) return 0
  const n = cdhSeries.length
  // Determine approximate time span from times if available
  let spanHours = 0
  if (times && times.length >= 2) {
    const start = times[Math.max(0, times.length - Math.floor((windowHours*3600) / 9) - 1)]
    const end = times[times.length - 1]
    spanHours = Math.max(1e-6, (end - start) / 1000 / 3600)
  } else {
    // fallback approximate: assume samples ~9s (as Overview sim), so compute hours
    const samples = Math.min(n, Math.max(2, Math.floor((windowHours*3600)/9)))
    spanHours = (samples - 1) * 9 / 3600
  }

  const startIdx = Math.max(0, n - Math.max(2, Math.floor((windowHours*3600)/9)))
  const deltaCdh = cdhSeries[n-1] - cdhSeries[startIdx]
  const rate = deltaCdh / Math.max(1e-6, spanHours)
  return Number(rate)
}

/**
 * Compute readiness score combining CDH progress, moisture, and stability.
 * - cdh: current CDH
 * - targetCdh: target CDH for harvest readiness
 * - moisture: latest moisture % (0-100) or null
 * - temps: temperature series to compute a simple stability metric (stddev)
 */
export function computeReadiness(cdh: number, targetCdh = 1000, moisture: number | null = null, temps: number[] = []) : { readiness:number; components:{cdh:number; moisture:number; stability:number} } {
  const normCdh = clamp(cdh / Math.max(1, targetCdh), 0, 1)

  // moisture: ideal around 60% (farm-friendly). Map to 0..1 with tolerance +/-20
  let moistureScore = 0.5
  if (moisture === null || moisture === undefined || Number.isNaN(moisture)) {
    moistureScore = 0.5
  } else {
    const ideal = 60
    const tol = 20
    moistureScore = 1 - clamp(Math.abs(moisture - ideal) / tol, 0, 1)
  }

  // stability: use simple stddev of temps; lower is better
  let stabilityScore = 0.5
  if (temps && temps.length >= 3) {
    const mean = temps.reduce((a,b)=>a+b,0)/temps.length
    const sd = Math.sqrt(temps.reduce((a,b)=>a + Math.pow(b-mean,2),0)/temps.length)
    // map sd to 0..1 where sd 0 -> 1, sd >=6 -> 0 (6°C is quite variable)
    stabilityScore = 1 - clamp(sd / 6, 0, 1)
  }

  // weighting: cdh 70%, moisture 20%, stability 10%
  const readiness = clamp(normCdh * 0.7 + moistureScore * 0.2 + stabilityScore * 0.1, 0, 1)

  return { readiness: Number((readiness*100).toFixed(1)), components: { cdh: Number((normCdh*100).toFixed(1)), moisture: Number((moistureScore*100).toFixed(1)), stability: Number((stabilityScore*100).toFixed(1)) } }
}

/** Convenience: full metric aggregator */
export function harvestMetrics(temps: number[], times?: number[], moistureArray?: number[], opts?: { baseTemp?: number; targetCdh?: number }) : HarvestMetrics {
  const baseTemp = opts?.baseTemp ?? 20
  const targetCdh = opts?.targetCdh ?? 1000
  const moisture = (moistureArray && moistureArray.length) ? (moistureArray[moistureArray.length-1]) : null
  const { cdh, series } = computeCdh(temps, times, baseTemp)
  const ratePerHour = estimateRate(series, times, 6)
  const etaHours = ratePerHour > 0 ? Math.max(0, (targetCdh - cdh) / ratePerHour) : null
  const r = computeReadiness(cdh, targetCdh, moisture, temps)
  return {
    cdh,
    cdhSeries: series,
    targetCdh,
    percent: Number(clamp(cdh / Math.max(1, targetCdh),0,1).toFixed(3)),
    ratePerHour: Number(ratePerHour.toFixed(3)),
    etaHours: etaHours === null ? null : Number(etaHours.toFixed(2)),
    readiness: Number(r.readiness)
  }
}

export default { computeCdh, estimateRate, computeReadiness, harvestMetrics }
