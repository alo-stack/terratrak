// trend.ts
type TrendSettings = {
  slopeNormThreshold?: number
  pctThreshold?: number
  slightPct?: number
}

const TREND_SETTINGS_KEY = 'tt_trend_settings'

export function getTrendSettings(): TrendSettings {
  try {
    const raw = localStorage.getItem(TREND_SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { slopeNormThreshold: 0.6, pctThreshold: 3, slightPct: 1.5 }
}

export function computeTrend(arr: number[], times?: number[]) {
  const opts = getTrendSettings()
  const slopeNormThreshold = opts.slopeNormThreshold ?? 0.6
  const pctThreshold = opts.pctThreshold ?? 3
  const slightPct = opts.slightPct ?? 1.5

  const n = arr.length
  if (n < 2) return { pct: 0, slope: 0, slopeNorm: 0, trend: 'N/A', interp: 'Not enough data' }

  const first = arr[0]
  const last = arr[n - 1]
  const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0

  // If timestamps are provided and match length, do regression vs time (ms -> days)
  let slope = 0
  let slopeNorm = 0
  try {
    if (times && Array.isArray(times) && times.length >= n) {
      // align last n timestamps
      const ts = times.slice(-n).map(t => Number(t))
      const t0 = ts[0]
      const xs = ts.map(t => (t - t0) / (1000 * 60 * 60 * 24)) // days since start
      const sumX = xs.reduce((a,b)=>a+b,0)
      const sumY = arr.reduce((a,b)=>a+b,0)
      const sumXY = xs.reduce((s,x,i)=>s + x * arr[i], 0)
      const sumXX = xs.reduce((s,x)=>s + x * x, 0)
      const denom = n * sumXX - sumX * sumX || 1
      slope = (n * sumXY - sumX * sumY) / denom // units: value per day
      const mean = sumY / n || 1
      const timeSpanDays = xs[xs.length-1] - xs[0] || (n>1? (n-1):1)
      slopeNorm = (slope * timeSpanDays) / Math.max(1, Math.abs(mean))
    } else {
      // fallback: regression over indices (original behaviour)
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
      for (let i = 0; i < n; i++) {
        const x = i
        const y = arr[i]
        sumX += x
        sumY += y
        sumXY += x * y
        sumXX += x * x
      }
      slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1)
      const mean = sumY / n || 1
      slopeNorm = slope * n / Math.max(1, Math.abs(mean)) // approximate relative change over window
    }
  } catch (e) {
    slope = 0
    slopeNorm = 0
  }

  // classification thresholds (configurable)
  let trend = 'Stable'
  if (slopeNorm > slopeNormThreshold || pct > pctThreshold) trend = 'Rising'
  else if (slopeNorm < -slopeNormThreshold || pct < -pctThreshold) trend = 'Falling'
  else if (Math.abs(pct) > slightPct) trend = pct > 0 ? 'Slightly rising' : 'Slightly falling'

  const interp = trend === 'Rising' ? 'Increasing — investigate causes' :
                trend === 'Falling' ? 'Decreasing — consider corrective action' :
                'Stable — within expected variation'

  return { pct, slope, slopeNorm, trend, interp }
}

export function formatValue(v: number, unit?: string) {
  if (!Number.isFinite(v)) return '--'
  if (!unit) return `${Math.round(v)}`
  if (unit === '°C') return `${v.toFixed(1)}${unit}`
  if (unit === '%') return `${v.toFixed(1)}${unit}`
  if (unit.toLowerCase().includes('ppm')) return `${Math.round(v)} ppm`
  // fallback
  return `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`
}

export function setTrendSettings(s: TrendSettings) {
  try { localStorage.setItem(TREND_SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

export default { computeTrend, formatValue, setTrendSettings }

export function movingAverage(arr:number[], windowSize=5){
  if (!arr.length) return []
  const res:number[] = []
  for (let i=0;i<arr.length;i++){
    const start = Math.max(0,i-windowSize+1)
    const slice = arr.slice(start,i+1)
    const avg = slice.reduce((a,b)=>a+b,0)/slice.length
    res.push(Number(avg.toFixed(2)))
  }
  return res
}

export function stddev(arr:number[]){
  if (!arr.length) return 0
  const mean = arr.reduce((a,b)=>a+b,0)/arr.length
  const v = arr.reduce((s,x)=>s+(x-mean)*(x-mean),0)/arr.length
  return Number(Math.sqrt(v).toFixed(2))
}

export function detectAnomalies(arr:number[], zThreshold=2){
  const m = arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length)
  const sd = Math.sqrt(arr.reduce((s,x)=>s+(x-m)*(x-m),0)/Math.max(1,arr.length))
  if (!sd) return []
  const res:number[] = []
  for (let i=0;i<arr.length;i++){
    const z = (arr[i]-m)/sd
    if (Math.abs(z) >= zThreshold) res.push(i)
  }
  return res
}

export function pearsonCorrelation(a:number[], b:number[]) {
  if (!Array.isArray(a) || !Array.isArray(b)) return NaN
  const n = Math.min(a.length, b.length)
  if (n < 2) return NaN
  const ax = a.slice(-n)
  const bx = b.slice(-n)
  const meanA = ax.reduce((s,x)=>s+x,0)/n
  const meanB = bx.reduce((s,x)=>s+x,0)/n
  let num = 0
  let sA = 0
  let sB = 0
  for (let i=0;i<n;i++){
    const da = ax[i] - meanA
    const db = bx[i] - meanB
    num += da * db
    sA += da * da
    sB += db * db
  }
  const den = Math.sqrt(sA * sB)
  if (!den) return NaN
  return Number((num / den).toFixed(2))
}
