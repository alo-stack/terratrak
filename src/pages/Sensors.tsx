// Sensors.tsx
import React from "react"
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  limit as qlimit,
} from "firebase/firestore"
import { db } from "../lib/firebase"
import { motion, AnimatePresence, easeOut } from "framer-motion"
import { computeTrend, formatValue, movingAverage, stddev, detectAnomalies, setTrendSettings, getTrendSettings, pearsonCorrelation } from "../lib/trend"
import HelpTip from "../components/HelpTip"

/* ----------------------------- Config --------------------------------- */
const DEVICE_ID = "esp32-001"

/* --------------------------- Types & helpers --------------------------- */
type Sample = {
  ts: number
  temp: number
  moist: number
  n: number
  p: number
  k: number
  tempArray?: number[]
  moistureArray?: number[]
}
type Status = "ok" | "low" | "high"
type RangeKey = "live" | "1h" | "24h" | "7d"

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))
const avg = (arr: number[]) =>
  arr.length
    ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1))
    : 0
const colorFor = (s: Status) =>
  s === "ok" ? "#10b981" : s === "low" ? "#38bdf8" : "#f59e0b"
const statusFor = (v: number, min: number, max: number): Status =>
  v < min ? "low" : v > max ? "high" : "ok"

const RANGES = {
  temp: { min: 15, max: 65 },
  moist: { min: 40, max: 80 },
  n: { min: 150, max: 900 },
  p: { min: 50, max: 300 },
  k: { min: 100, max: 800 },
}

const WINDOWS: Record<RangeKey, number> = {
  live: 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
}

/* trend helpers live in src/lib/trend.ts */

/* ---------------------- Firestore hook ------------------------ */
function useSensorHistory(range: RangeKey, deviceId = DEVICE_ID) {
  const [samples, setSamples] = React.useState<Sample[]>([])
  const [mode, setMode] = React.useState<"firebase" | "sim">("sim")

  React.useEffect(() => {
    let simTimer: number | undefined
    const MAX = 5000
    const cutoffDate = new Date(Date.now() - WINDOWS[range])

    const startSim = () => {
      if (simTimer) return
      const now = Date.now()
      let temp = 48,
        moist = 62,
        n = 420,
        p = 140,
        k = 380
      const seeded: Sample[] = []
      for (let i = 300; i > 0; i--) {
        temp = clamp(temp + (Math.random() - 0.5) * 1.0, 20, 70)
        moist = clamp(moist + (Math.random() - 0.5) * 1.2, 25, 90)
        n = clamp(n + (Math.random() - 0.5) * 18, RANGES.n.min / 2, RANGES.n.max * 1.2)
        p = clamp(p + (Math.random() - 0.5) * 6, RANGES.p.min / 2, RANGES.p.max * 1.2)
        k = clamp(k + (Math.random() - 0.5) * 14, RANGES.k.min / 2, RANGES.k.max * 1.2)
        seeded.push({
          ts: now - i * 12000,
          temp: +temp.toFixed(1),
          moist: +moist.toFixed(1),
          n: Math.round(n),
          p: Math.round(p),
          k: Math.round(k),
        })
      }
      setSamples(seeded)
      setMode("sim")
      simTimer = window.setInterval(() => {
        setSamples((s) => {
          const last =
            s.at(-1) ?? { ts: Date.now(), temp: 48, moist: 62, n: 420, p: 140, k: 380 }
          const next: Sample = {
            ts: Date.now(),
            temp: +clamp(last.temp + (Math.random() - 0.5) * 1.0, 20, 70).toFixed(1),
            moist: +clamp(last.moist + (Math.random() - 0.5) * 1.2, 25, 90).toFixed(1),
            n: Math.round(
              clamp(last.n + (Math.random() - 0.5) * 18, RANGES.n.min / 2, RANGES.n.max * 1.2)
            ),
            p: Math.round(
              clamp(last.p + (Math.random() - 0.5) * 6, RANGES.p.min / 2, RANGES.p.max * 1.2)
            ),
            k: Math.round(
              clamp(last.k + (Math.random() - 0.5) * 14, RANGES.k.min / 2, RANGES.k.max * 1.2)
            ),
          }
          return [...s.slice(-(MAX - 1)), next]
        })
      }, 9000) as unknown as number
    }

    const ref = collection(db, "sensor_readings", deviceId, "readings")
    const q = query(
      ref,
      where("updatedAt", ">=", Timestamp.fromDate(cutoffDate)),
      orderBy("updatedAt", "asc"),
      qlimit(range === "7d" ? 5000 : range === "24h" ? 3000 : 1000)
    )

    let sawValid = false
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: Sample[] = snap.docs
          .map((d) => {
            const x = d.data() as any
            
            // Parse temperature array (if available)
            let tempArray: number[] | undefined
            if (x.tempArray && Array.isArray(x.tempArray)) {
              tempArray = x.tempArray
                .map((v: any) => Number(v))
                .filter((v: number) => Number.isFinite(v) && v > -127)
            }
            
            // Parse moisture array (if available)
            let moistureArray: number[] | undefined
            if (x.moistureArray && Array.isArray(x.moistureArray)) {
              moistureArray = x.moistureArray
                .map((v: any) => Number(v))
                .filter((v: number) => Number.isFinite(v) && v >= 0 && v <= 100)
            }
            
            return {
              ts: x.updatedAt?.toMillis?.() ?? Date.now(),
              temp: Number(x.tempC ?? x.temperature),
              moist: Number(x.moisturePct ?? x.moisture),
              n: Number(x.npk?.n),
              p: Number(x.npk?.p),
              k: Number(x.npk?.k),
              tempArray,
              moistureArray,
            }
          })
          .filter((r) => [r.temp, r.moist, r.n, r.p, r.k].every(Number.isFinite))

        if (rows.length > 0) {
          sawValid = true
          setMode("firebase")
          setSamples(rows.slice(-MAX))
          if (simTimer) {
            window.clearInterval(simTimer)
            simTimer = undefined
          }
        } else if (!sawValid && !simTimer) {
          startSim()
        }
      },
      () => {
        if (!simTimer) startSim()
      }
    )

    startSim()

    return () => {
      unsub()
      if (simTimer) window.clearInterval(simTimer)
    }
  }, [range, deviceId])

  return { samples, mode }
}

/* ------------------------------- Page ---------------------------------- */
export default function Sensors() {
  const [range, setRange] = React.useState<RangeKey>("live")
  const { samples, mode } = useSensorHistory(range, DEVICE_ID)
  const [showSettings, setShowSettings] = React.useState(false)
  const [trendSettingsState, setTrendSettingsState] = React.useState(() => getTrendSettings())
  const [settingsVersion, setSettingsVersion] = React.useState(0)

  const cutoff = Date.now() - WINDOWS[range]
  const windowed = React.useMemo(
    () => samples.filter((s) => s.ts >= cutoff),
    [samples, cutoff]
  )

  const series = React.useMemo(
    () => ({
      temp: windowed.map((s) => s.temp),
      moist: windowed.map((s) => s.moist),
      n: windowed.map((s) => s.n),
      p: windowed.map((s) => s.p),
      k: windowed.map((s) => s.k),
    }),
    [windowed]
  )

  const kpi = React.useMemo(
    () => {
      // For Live range, use sensor arrays from latest reading for min/max
      // For historical ranges, use time-based min/max
      const isLive = range === "live"
      const latestSample = windowed[windowed.length - 1]
      
      let tempMin = 0, tempMax = 0, moistMin = 0, moistMax = 0
      let tempAvg = 0, moistAvg = 0
      
      if (isLive && latestSample) {
        // Use latest tempC and moisturePct values directly (already averaged by ESP32)
        tempAvg = latestSample.temp
        moistAvg = latestSample.moist
        
        // Use sensor arrays for min/max if available
        if (latestSample.tempArray && latestSample.tempArray.length > 0) {
          tempMin = Math.min(...latestSample.tempArray)
          tempMax = Math.max(...latestSample.tempArray)
        } else {
          tempMin = tempMax = latestSample.temp
        }
        
        if (latestSample.moistureArray && latestSample.moistureArray.length > 0) {
          moistMin = Math.min(...latestSample.moistureArray)
          moistMax = Math.max(...latestSample.moistureArray)
        } else {
          moistMin = moistMax = latestSample.moist
        }
      } else {
        // Use time-based average and min/max for historical ranges
        tempAvg = avg(series.temp)
        moistAvg = avg(series.moist)
        tempMin = Math.min(...series.temp, Infinity) || 0
        tempMax = Math.max(...series.temp, -Infinity) || 0
        moistMin = Math.min(...series.moist, Infinity) || 0
        moistMax = Math.max(...series.moist, -Infinity) || 0
      }
      
      return {
        temp: {
          avg: tempAvg,
          min: tempMin,
          max: tempMax,
        },
        moist: {
          avg: moistAvg,
          min: moistMin,
          max: moistMax,
        },
        n: {
          avg: Math.round(avg(series.n)),
          min: Math.min(...series.n, Infinity) || 0,
          max: Math.max(...series.n, -Infinity) || 0,
        },
        p: {
          avg: Math.round(avg(series.p)),
          min: Math.min(...series.p, Infinity) || 0,
          max: Math.max(...series.p, -Infinity) || 0,
        },
        k: {
          avg: Math.round(avg(series.k)),
          min: Math.min(...series.k, Infinity) || 0,
          max: Math.max(...series.k, -Infinity) || 0,
        },
      }
    },
    [series, windowed, range]
  )

  const sTemp = statusFor(kpi.temp.avg, RANGES.temp.min, RANGES.temp.max)
  const sMoist = statusFor(kpi.moist.avg, RANGES.moist.min, RANGES.moist.max)
  const sN = statusFor(kpi.n.avg, RANGES.n.min, RANGES.n.max)
  const sP = statusFor(kpi.p.avg, RANGES.p.min, RANGES.p.max)
  const sK = statusFor(kpi.k.avg, RANGES.k.min, RANGES.k.max)

  const insights = React.useMemo(() => {
    const list: string[] = []
    const N = Math.min(96, series.temp.length)
    const tt = computeTrend(series.temp.slice(-N), windowed.slice(-N).map(s=>s.ts))
    const M = Math.min(96, series.moist.length)
    const mt = computeTrend(series.moist.slice(-M), windowed.slice(-M).map(s=>s.ts))
    const NN = Math.min(96, series.n.length)
    const nT = computeTrend(series.n.slice(-NN), windowed.slice(-NN).map(s=>s.ts))
    const PP = Math.min(96, series.p.length)
    const pT = computeTrend(series.p.slice(-PP), windowed.slice(-PP).map(s=>s.ts))
    const KK = Math.min(96, series.k.length)
    const kT = computeTrend(series.k.slice(-KK), windowed.slice(-KK).map(s=>s.ts))

    // Simple, actionable summaries (short)
    if (mt.trend.includes('Falling') || sMoist === 'low')
      list.push(`Moisture falling — add a little water.`)
    else if (mt.trend.includes('Rising') || sMoist === 'high')
      list.push(`Moisture rising — add dry bedding and aerate.`)

    if (tt.trend.includes('Rising') || sTemp === 'high')
      list.push(`Temperature rising — reduce fresh food or increase ventilation.`)
    else if (tt.trend.includes('Falling') || sTemp === 'low')
      list.push(`Temperature falling — insulate or check moisture.`)

    const npkOkay = [sN, sP, sK].every((s) => s === "ok")
    if (!npkOkay) {
      const bad = [] as string[]
      if (sN !== 'ok') bad.push(`N ${nT.trend.toLowerCase()} ${nT.pct.toFixed(0)}%`)
      if (sP !== 'ok') bad.push(`P ${pT.trend.toLowerCase()} ${pT.pct.toFixed(0)}%`)
      if (sK !== 'ok') bad.push(`K ${kT.trend.toLowerCase()} ${kT.pct.toFixed(0)}%`)
      list.push(`NPK imbalance: ${bad.join(', ')} — adjust feed or bedding accordingly.`)
    }

    if (list.length === 0) list.push('All parameters look healthy. Maintain current routine.')
    // Cross-sensor correlations (conservative messaging)
    try {
      const N = Math.min(96, series.temp.length, series.moist.length)
      if (N >= 12) {
        const sTemp = series.temp.slice(-N)
        const sMoist = series.moist.slice(-N)
        const rTM = pearsonCorrelation(sTemp, sMoist)
          if (Number.isFinite(rTM) && Math.abs(rTM) >= 0.35) {
            const dir = rTM > 0 ? 'positive' : 'negative'
            list.push(`Temp ↔ Moisture: ${dir} correlation (r=${rTM}). Check logs to confirm.`)
          }

        // moisture vs nutrients
        const nutrients = ['n','p','k'] as const
        for (const key of nutrients) {
          const sNut = (series as any)[key].slice(-N)
          const r = pearsonCorrelation(sMoist, sNut)
          if (Number.isFinite(r) && Math.abs(r) >= 0.35) {
            const dir = r > 0 ? 'positive' : 'negative'
            list.push(`Moisture ↔ ${key.toUpperCase()}: ${dir} correlation (r=${r}). Investigate if moisture affects nutrient readings.`)
          }
        }
      }
    } catch (e) {
      // fail safe: do not break insights
      console.warn('correlation calc failed', e)
    }
    return list
  }, [sTemp, sMoist, sN, sP, sK, settingsVersion])

  function helpTextForInsight(text: string){
    const t = text.toLowerCase()
    if (t.includes('moist') || t.includes('moisture')) return 'Moisture: percent water in the pile. If it keeps falling, add small amounts of water and mix; don’t soak it.'
    if (t.includes('temperature') || t.includes('temp')) return 'Temperature: shows heat from decomposition. A steady rise can mean high activity; a big jump may need a turn or cooling.'
    if (t.includes('npk') || t.includes('n ') || t.includes('p ') || t.includes('k ')) return 'N,P,K: nutrient readings in ppm. If one is out of range, review feed ingredients or dilution—check before large changes.'
    if (t.includes('correlation') || t.includes('↔')) return 'Shows how two metrics move together (association). Not proof one causes the other.'
    if (t.includes('anomaly') || t.includes('flag')) return 'Anomaly: a reading that differs a lot from recent values. Re-check sensor and recent actions before reacting.'
    return 'Tip: compare with recent actions (watering, feeding, turning) to decide what to do.'
  }

  const cardMotion = {
    initial: { opacity: 0, y: 20, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.4, ease: easeOut },
    whileHover: { scale: 1.02, y: -4, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" },
  }

  return (
    <motion.div
      className="min-h-screen px-4 md:px-6 py-6 bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100 transition-colors duration-300"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <motion.section
        {...cardMotion}
        className="relative rounded-2xl p-5 md:p-6 border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
        <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <h2 className="text-lg font-semibold">Sensors</h2>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                mode === "firebase"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              }`}
            >
              {mode === "firebase" ? "LIVE • Firebase" : "SIM"}
            </span>
            <button
              onClick={() => setShowSettings(s => !s)}
              className="ml-2 px-2 py-0.5 rounded-md text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              aria-expanded={showSettings}
            >
              Settings
            </button>
            
          </div>
          <p className="text-xs opacity-70 italic">
            {range === "live" ? "Last 30 mins" : `Range: ${range}`}
          </p>
        </div>
        <p className="mt-2 text-sm opacity-80">
          {mode === "sim"
            ? "ESP32 not transmitting data, in simulation mode."
            : `ESP32 transmitted data last ${
                samples.length > 0
                  ? new Date(samples[samples.length - 1].ts).toLocaleString()
                  : "N/A"
              }`}
        </p>
        {showSettings && (
          <div className="mt-3 p-3 border rounded-lg bg-white/60 dark:bg-gray-800/40">
            <h4 className="text-sm font-semibold mb-2">Trend settings</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="text-xs">
                Slope norm threshold
                <input type="number" step="0.1" value={String(trendSettingsState.slopeNormThreshold ?? 0.6)}
                  onChange={(e)=> setTrendSettingsState(s=>({...s, slopeNormThreshold: Number(e.target.value)}))}
                  className="mt-1 w-full px-2 py-1 rounded bg-gray-100 dark:bg-gray-900 text-sm" />
              </label>
              <label className="text-xs">
                Percent change threshold
                <input type="number" step="0.1" value={String(trendSettingsState.pctThreshold ?? 3)}
                  onChange={(e)=> setTrendSettingsState(s=>({...s, pctThreshold: Number(e.target.value)}))}
                  className="mt-1 w-full px-2 py-1 rounded bg-gray-100 dark:bg-gray-900 text-sm" />
              </label>
              <label className="text-xs">
                Slight change threshold
                <input type="number" step="0.1" value={String(trendSettingsState.slightPct ?? 1.5)}
                  onChange={(e)=> setTrendSettingsState(s=>({...s, slightPct: Number(e.target.value)}))}
                  className="mt-1 w-full px-2 py-1 rounded bg-gray-100 dark:bg-gray-900 text-sm" />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
                onClick={()=>{ setTrendSettings(trendSettingsState); setSettingsVersion(v=>v+1); setShowSettings(false)}}>Save</button>
              <button className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-sm"
                onClick={()=>{ setTrendSettingsState(getTrendSettings()); setShowSettings(false)}}>Cancel</button>
            </div>
          </div>
        )}
      </motion.section>

      {/* Range Buttons */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
        {(["live", "1h", "24h", "7d"] as RangeKey[]).map((key) => (
          <motion.button
            key={key}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setRange(key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              range === key
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {key.toUpperCase()}
          </motion.button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        <KpiCard title="Temperature" unit="°C" color={colorFor(sTemp)} status={sTemp} values={kpi.temp} range={range} />
        <KpiCard title="Moisture" unit="%" color={colorFor(sMoist)} status={sMoist} values={kpi.moist} range={range} />
        <NpkKpiCard nSeries={series.n} pSeries={series.p} kSeries={series.k} kpi={kpi} status={{ n: sN, p: sP, k: sK }} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 mt-5">
        <ChartCard title="Temperature" unit="°C" color="#10b981" data={series.temp} times={windowed.map(s=>s.ts)} bigValue={kpi.temp.avg} />
        <ChartCard title="Moisture" unit="%" color="#38bdf8" data={series.moist} times={windowed.map(s=>s.ts)} bigValue={kpi.moist.avg} />
        <NpkChartCard
          nSeries={series.n}
          pSeries={series.p}
          kSeries={series.k}
          times={windowed.map(s => s.ts)}
          kpi={{ n: kpi.n, p: kpi.p, k: kpi.k }}
        />
      </div>

      {/* Insights */}
      <motion.section
        {...cardMotion}
        className="relative mt-5 p-5 md:p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
        <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <h3 className="text-base font-semibold mb-3 text-center sm:text-left">Actionable Tips</h3>
        <ul className="space-y-2 text-sm leading-relaxed text-center sm:text-left">
          <AnimatePresence>
            {insights.map((t, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.25 }}
                className="flex items-start justify-center sm:justify-start gap-2"
              >
                <span className="mt-[6px] inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="flex-1">{t}</span>
                {/* help tip: brief 1-line explanation */}
                <span className="ml-2">
                  <HelpTip text={helpTextForInsight(t)} />
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </motion.section>
    </motion.div>
  )
}

/* ------------------------------ Subcomponents ------------------------------ */
function KpiCard({
  title,
  unit,
  color,
  status,
  values,
  range,
}: {
  title: string
  unit: string
  color: string
  status: Status
  values: { avg: number; min: number; max: number }
  range: RangeKey
}) {
  const isLive = range === "live"
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.03, y: -4 }}
      className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-5 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
      <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
      <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-semibold">{title}</h4>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap"
          style={{
            color,
            borderColor: color + "55",
            background: color + "10",
          }}
        >
          {status.toUpperCase()}
        </span>
      </div>

      {isLive ? (
        /* Live mode: Show current average prominently, with sensor range below */
        <div className="space-y-3">
          <div className="text-center py-2">
            <div className="text-xs opacity-70 mb-1">Current Average</div>
            <div className="text-3xl font-bold tabular-nums" style={{ color }}>
              {values.avg.toFixed(1)}
              <span className="text-lg ml-1 opacity-80">{unit}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-xs opacity-60 mb-1">Sensor Min</div>
              <div className="text-sm font-semibold tabular-nums">
                {values.min.toFixed(1)}{unit}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs opacity-60 mb-1">Sensor Max</div>
              <div className="text-sm font-semibold tabular-nums">
                {values.max.toFixed(1)}{unit}
              </div>
            </div>
          </div>
          
          <div className="text-xs opacity-50 text-center mt-2">
            Range across all active sensors
          </div>
        </div>
      ) : (
        /* Historical mode: Show avg, min, max for the time period */
        <div className="space-y-3">
          <div className="text-center py-2">
            <div className="text-xs opacity-70 mb-1">Period Average</div>
            <div className="text-3xl font-bold tabular-nums" style={{ color }}>
              {values.avg.toFixed(1)}
              <span className="text-lg ml-1 opacity-80">{unit}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-xs opacity-60 mb-1">Period Min</div>
              <div className="text-sm font-semibold tabular-nums">
                {values.min.toFixed(1)}{unit}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs opacity-60 mb-1">Period Max</div>
              <div className="text-sm font-semibold tabular-nums">
                {values.max.toFixed(1)}{unit}
              </div>
            </div>
          </div>
          
          <div className="text-xs opacity-50 text-center mt-2">
            {range === "1h" ? "Last hour" : range === "24h" ? "Last 24 hours" : "Last 7 days"}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function NpkKpiCard({ nSeries, pSeries, kSeries, kpi, status }:{ nSeries:number[]; pSeries:number[]; kSeries:number[]; kpi:any; status:{ n:Status; p:Status; k:Status } }){
  const COLORS = { n: '#22c55e', p: '#06b6d4', k: '#f59e0b' }
  const nMA = movingAverage(nSeries, 5).at(-1) ?? 0
  const pMA = movingAverage(pSeries, 5).at(-1) ?? 0
  const kMA = movingAverage(kSeries, 5).at(-1) ?? 0
  const nSd = stddev(nSeries)
  const pSd = stddev(pSeries)
  const kSd = stddev(kSeries)
  const nAn = detectAnomalies(nSeries).length
  const pAn = detectAnomalies(pSeries).length
  const kAn = detectAnomalies(kSeries).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.03, y: -4 }}
      className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-5 text-center sm:text-left overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
      <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
      <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-semibold">NPK</h4>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap"
          style={{ color: status.n === 'ok' && status.p === 'ok' && status.k === 'ok' ? '#10b981' : '#f59e0b', borderColor: (status.n === 'ok' && status.p === 'ok' && status.k === 'ok' ? '#10b981' : '#f59e0b') + '55', background: (status.n === 'ok' && status.p === 'ok' && status.k === 'ok' ? '#10b981' : '#f59e0b') + '10' }}>
            { (status.n === 'ok' && status.p === 'ok' && status.k === 'ok') ? 'OK' : 'Check' }
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[{label:'N', val:kpi.n.avg, color:COLORS.n, ma:nMA, sd:nSd, an:nAn, stat:status.n},{label:'P', val:kpi.p.avg, color:COLORS.p, ma:pMA, sd:pSd, an:pAn, stat:status.p},{label:'K', val:kpi.k.avg, color:COLORS.k, ma:kMA, sd:kSd, an:kAn, stat:status.k}].map((it)=> (
          <div key={it.label} className="rounded-lg border p-3 text-center" style={{ borderColor: it.color+'33' }}>
            <div className="flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: it.color }} />
              <div className="text-xs opacity-80">{it.label}</div>
              <div className="px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ borderColor: colorFor(it.stat)+'55', background: colorFor(it.stat)+'10', color: colorFor(it.stat) }}>{it.stat.toUpperCase()}</div>
            </div>
            <div className="text-2xl font-bold mt-2 tabular-nums" style={{ color: it.color }}>{it.val}</div>
            <div className="text-xs opacity-70 mt-1">MA(5): {formatValue(it.ma,'ppm')} • σ: {it.sd}</div>
            <div className="text-xs opacity-60 mt-1">Anomalies: {it.an}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs opacity-70">Units based on your NPK sensor (ppm). Analytics: moving average (MA), standard deviation (σ), anomaly count (z≥2).</div>
    </motion.div>
  )
}

function ChartCard({
  title,
  unit,
  color,
  data,
  times,
  bigValue,
}: {
  title: string
  unit: string
  color: string
  data: number[]
  times?: number[]
  bigValue?: number
}) {
  // compute refined trend metrics using regression + percent change (pass timestamps if available)
  const SL = Math.min(96, data.length)
  const t = computeTrend(data.slice(-SL), times ? times.slice(-SL) : undefined)
  const pctStr = Number.isFinite(t.pct) ? `${t.pct >= 0 ? '+' : ''}${t.pct.toFixed(1)}%` : '--'
  const trend = t.trend
  const interp = t.interp
  const minV = data.length ? Math.min(...data) : 0
  const maxV = data.length ? Math.max(...data) : 0
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-5 text-center sm:text-left overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
      <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
      <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between text-center sm:text-left">
        <h4 className="text-base font-semibold">{title}</h4>
        <div className="text-lg font-semibold tabular-nums mt-1 sm:mt-0">
          {Number.isFinite(bigValue) ? `${bigValue!.toFixed(1)}${unit}` : "--"}
        </div>
      </div>
      <AutoChart data={data} stroke={color} times={times} unit={unit} />

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-3">
          <span className="font-medium">Δ:</span>
          <span className="tabular-nums">{pctStr}</span>
          <span className="opacity-70">•</span>
          <span className="font-medium">Trend:</span>
          <span>{trend}</span>
        </div>
        <div className="opacity-70 text-xs sm:text-sm">
          {interp} — Min: <span className="tabular-nums">{minV.toFixed(1)}{unit}</span>
          <span className="mx-2">•</span>
          Max: <span className="tabular-nums">{maxV.toFixed(1)}{unit}</span>
        </div>
      </div>
    </motion.section>
  )
}

/* ------------------- Multi-series NPK chart ------------------- */
function NpkChartCard({
  nSeries, pSeries, kSeries, times, kpi
}:{
  nSeries:number[]; pSeries:number[]; kSeries:number[]; times?:number[]; kpi: any
}){
  const COLORS = { n: '#22c55e', p: '#06b6d4', k: '#f59e0b' }
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-5 text-center sm:text-left overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
      <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
      <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-semibold">NPK (ppm)</h4>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full inline-block" style={{background:COLORS.n}} />N: <span className="font-semibold tabular-nums">{kpi.n.avg}</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full inline-block" style={{background:COLORS.p}} />P: <span className="font-semibold tabular-nums">{kpi.p.avg}</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full inline-block" style={{background:COLORS.k}} />K: <span className="font-semibold tabular-nums">{kpi.k.avg}</span></div>
        </div>
      </div>

      <AutoChartMulti
        series={[{data:nSeries,color:COLORS.n,name:'N'},{data:pSeries,color:COLORS.p,name:'P'},{data:kSeries,color:COLORS.k,name:'K'}]}
        times={times}
        unit="ppm"
      />

      <div className="mt-3 text-sm opacity-75">Interpretation: check individual nutrient trends; avoid relying on a single mean value.</div>
    </motion.section>
  )
}

function AutoChartMulti({ series, times, unit }:{ series:{data:number[]; color:string; name?:string}[]; times?:number[]; unit?:string }){
  const ref = React.useRef<HTMLDivElement|null>(null)
  const [size, setSize] = React.useState({ w: 900, h: 220 })
  const [hoverIndex, setHoverIndex] = React.useState<number|null>(null)

  React.useEffect(() => {
    const update = () => {
      const w = ref.current?.clientWidth ?? 900
      const h = clamp(Math.round(w * 0.24), 150, 280)
      setSize({ w, h })
    }
    update()
    const ro = new ResizeObserver(update)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const PAD = 16
  const { w: W, h: H } = size
  const sliced = series.map(s=>s.data)
  const flat = sliced.flat()
  const minV = Math.min(...(flat.length?flat:[0]))
  const maxV = Math.max(...(flat.length?flat:[1]))
  const lo = minV - (maxV - minV) * 0.15
  const hi = maxV + (maxV - minV) * 0.15 || 1
  const norm = (v:number) => (1 - (v - lo) / (hi - lo)) * (H - PAD * 2) + PAD
  const step = (W - PAD * 2) / Math.max(1, (sliced[0]?.length || 1) - 1)

  const clampIndex = (i:number) => Math.max(0, Math.min((sliced[0]?.length||1) - 1, i))
  const handlePointer = (clientX:number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const scale = W / rect.width
    const svgX = (clientX - rect.left) * scale
    const idx = clampIndex(Math.round((svgX - PAD) / step))
    setHoverIndex(idx)
  }

  const onMouseMove = (e:React.MouseEvent) => handlePointer(e.clientX)
  const onMouseLeave = () => setHoverIndex(null)
  const onTouchMove = (e:React.TouchEvent) => { if (e.touches && e.touches[0]) handlePointer(e.touches[0].clientX) }
  const onTouchEnd = () => setHoverIndex(null)

  return (
    <div ref={ref} className="w-full mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <g opacity=".12" stroke="currentColor">
          <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} />
          <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} />
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} />
        </g>
        {sliced.map((arr, idx) => {
          if (!arr.length) return null
          const d = `M ${PAD},${norm(arr[0])} ` + arr.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${norm(v)}`).join(" ")
          return <path key={idx} d={d} fill="none" stroke={series[idx].color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />
        })}
        {sliced.map((arr, idx) => arr.length ? <circle key={'c'+idx} cx={PAD+(arr.length-1)*step} cy={norm(arr[arr.length-1])} r={3.2} fill={series[idx].color} /> : null)}

        {hoverIndex !== null && (
          <g>
            <line x1={PAD+hoverIndex*step} x2={PAD+hoverIndex*step} y1={PAD} y2={H-PAD} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
            {sliced.map((arr, idx) => arr.length ? <circle key={'hc'+idx} cx={PAD+hoverIndex*step} cy={norm(arr[hoverIndex])} r={4} fill={series[idx].color} /> : null)}
            {(() => {
              const ts = times && times[hoverIndex]
              const timeStr = ts ? new Date(ts).toLocaleString() : ''
              const vals = sliced.map((arr, idx) => ({ color: series[idx].color, v: arr[hoverIndex] }))
              const tx = Math.max(PAD + 4, Math.min(W - PAD - 160, PAD+hoverIndex*step - 80))
              const ty = PAD
              return (
                <g transform={`translate(${tx}, ${ty})`}>
                  <rect x={0} y={0} rx={8} ry={8} width={160} height={26 + vals.length*14} fill="#111827" opacity={0.95} />
                  <text x={8} y={14} fontSize={11} fill="#d1d5db">{timeStr}</text>
                  {vals.map((it, i) => <text key={i} x={8} y={30 + i*14} fontSize={12} fill={it.color}>{`${it.v !== undefined ? it.v : '--'} ${unit ?? ''}`}</text>)}
                </g>
              )
            })()}
          </g>
        )}
      </svg>
    </div>
  )
}

/* ------------------------------ Chart ------------------------------ */
function AutoChart({ data, stroke, times, unit }: { data: number[]; stroke: string; times?: number[]; unit?: string }) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [size, setSize] = React.useState({ w: 900, h: 220 })
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null)
  const [hoverX, setHoverX] = React.useState<number | null>(null)

  React.useEffect(() => {
    const update = () => {
      const w = ref.current?.clientWidth ?? 900
      const h = clamp(Math.round(w * 0.24), 150, 280)
      setSize({ w, h })
    }
    update()
    const ro = new ResizeObserver(update)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const PAD = 16
  const { w: W, h: H } = size
  const minV = Math.min(...(data.length ? data : [0]))
  const maxV = Math.max(...(data.length ? data : [1]))
  const lo = minV - (maxV - minV) * 0.15
  const hi = maxV + (maxV - minV) * 0.15 || 1
  const norm = (v: number) => (1 - (v - lo) / (hi - lo)) * (H - PAD * 2) + PAD
  const step = (W - PAD * 2) / Math.max(1, data.length - 1)

  const d = data.length
    ? `M ${PAD},${norm(data[0])} ` +
      data.slice(1).map((v, i) => `L ${PAD + (i + 1) * step},${norm(v)}`).join(" ")
    : ""
  const area = data.length
    ? `M ${PAD},${H - PAD} L ${PAD},${norm(data[0])} ` +
      data
        .slice(1)
        .map((v, i) => `L ${PAD + (i + 1) * step},${norm(v)}`)
        .join(" ") +
      ` L ${PAD + (data.length - 1) * step},${H - PAD} Z`
    : ""

  const clampIndex = (i:number) => Math.max(0, Math.min(data.length - 1, i))

  const handlePointer = (clientX:number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const scale = W / rect.width
    const svgX = (clientX - rect.left) * scale
    const idx = clampIndex(Math.round((svgX - PAD) / step))
    setHoverIndex(idx)
    setHoverX(PAD + idx * step)
  }

  const onMouseMove = (e: React.MouseEvent) => handlePointer(e.clientX)
  const onMouseLeave = () => { setHoverIndex(null); setHoverX(null) }
  const onTouchMove = (e: React.TouchEvent) => { if (e.touches && e.touches[0]) handlePointer(e.touches[0].clientX) }
  const onTouchEnd = () => { setHoverIndex(null); setHoverX(null) }

  return (
    <div ref={ref} className="w-full mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <defs>
          <linearGradient id="lineGradAuto" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.55" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <g opacity=".12" stroke="currentColor">
          <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} />
          <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} />
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} />
        </g>
        {data.length > 1 && <path d={area} fill="url(#lineGradAuto)" />}
        {data.length > 1 && (
          <path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {data.length > 0 && (
          <circle
            cx={PAD + (data.length - 1) * step}
            cy={norm(data[data.length - 1])}
            r="3.6"
            fill={stroke}
          />
        )}
        {hoverIndex !== null && hoverX !== null && data[hoverIndex] !== undefined && (
          <g>
            <line x1={hoverX} x2={hoverX} y1={PAD} y2={H - PAD} stroke={stroke} strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
            <circle cx={hoverX} cy={norm(data[hoverIndex])} r={4.5} fill={stroke} />
            {/* tooltip */}
            {(() => {
              const val = data[hoverIndex]
              const ts = times && times[hoverIndex]
              const txt = `${Number.isFinite(val) ? val.toFixed(2) : '--'}${unit ?? ''}`
              const timeStr = ts ? new Date(ts).toLocaleString() : ''
              const tx = Math.max(PAD + 8, Math.min(W - PAD - 110, (hoverX ?? PAD) - 50))
              const ty = Math.max(18, norm(val) - 36)
              return (
                <g transform={`translate(${tx}, ${ty})`}>
                  <rect x={0} y={-14} rx={6} ry={6} width={110} height={36} fill="#111827" opacity={0.9} />
                  <text x={8} y={2} fontSize={12} fill="#fff">{txt}</text>
                  {timeStr && <text x={8} y={16} fontSize={11} fill="#d1d5db">{timeStr}</text>}
                </g>
              )
            })()}
          </g>
        )}
      </svg>
    </div>
  )
}
