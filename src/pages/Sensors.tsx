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
  addDoc,
  serverTimestamp,
  doc,
  getDocs,
} from "firebase/firestore"
import { db } from "../lib/firebase"
import { motion, AnimatePresence, easeOut } from "framer-motion"
import { computeTrend, formatValue, movingAverage, stddev, detectAnomalies, pearsonCorrelation, rateOfChangePerHour, timeToTarget, stabilityScore, moistureDeficit, cumulativeDegreeHours, sensorHealthMetrics } from "../lib/trend"
import HelpTip from "../components/HelpTip"
import { getDummyDataEnabled, onDummyDataChange } from "../lib/dummyData"

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

type Thresholds = {
  temperature: { min: number; max: number }
  moisture: { min: number; max: number }
  npk: {
    n: { min: number; max: number }
    p: { min: number; max: number }
    k: { min: number; max: number }
  }
}

const THRESHOLDS_KEY = "tt_thresholds"
const DEFAULT_THRESHOLDS: Thresholds = {
  temperature: { min: 15, max: 65 },
  moisture: { min: 40, max: 80 },
  npk: { n: { min: 50, max: 900 }, p: { min: 50, max: 300 }, k: { min: 100, max: 800 } },
}

const parseThresholds = (raw: any): Thresholds => {
  try {
    const t = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {})
    return {
      temperature: { min: Number(t?.temperature?.min ?? 15), max: Number(t?.temperature?.max ?? 65) },
      moisture: { min: Number(t?.moisture?.min ?? 40), max: Number(t?.moisture?.max ?? 80) },
      npk: {
        n: { min: Number(t?.n?.min ?? t?.npk?.n?.min ?? 50), max: Number(t?.n?.max ?? t?.npk?.n?.max ?? 200) },
        p: { min: Number(t?.p?.min ?? t?.npk?.p?.min ?? 20), max: Number(t?.p?.max ?? t?.npk?.p?.max ?? 100) },
        k: { min: Number(t?.k?.min ?? t?.npk?.k?.min ?? 50), max: Number(t?.k?.max ?? t?.npk?.k?.max ?? 200) },
      },
    }
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

const seriesWindow = 96 // ~24h if every 15min

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

const formatLastSeen = (timestamp: number) => {
  const diffMs = Math.max(0, Date.now() - timestamp)
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return `${sec} sec${sec === 1 ? '' : 's'} ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.round(hr / 24)
  return `${day} day${day === 1 ? '' : 's'} ago`
}

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

// Smoothing window size by range to reduce chart noise
const SMOOTHING_WINDOWS: Record<RangeKey, number> = {
  live: 3,
  "1h": 5,
  "24h": 15,
  "7d": 45,
}

/* trend helpers live in src/lib/trend.ts */

/* ---------------------- Firestore hook ------------------------ */
function useSensorHistory(range: RangeKey, deviceId = DEVICE_ID, dummyEnabled: boolean) {
  const [samples, setSamples] = React.useState<Sample[]>([])
  const [mode, setMode] = React.useState<"firebase" | "sim">(dummyEnabled ? "sim" : "firebase")

  React.useEffect(() => {
    let simTimer: number | undefined
    const MAX = 5000
    const cutoffDate = new Date(Date.now() - WINDOWS[range])

    const startSim = () => {
      if (simTimer) return
      if (!dummyEnabled) return
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
        } else if (!sawValid && !simTimer && dummyEnabled) {
          startSim()
        }
      },
      () => {
        if (dummyEnabled && !simTimer) startSim()
        if (!dummyEnabled) setMode("firebase")
      }
    )

    if (dummyEnabled) startSim()
    if (!dummyEnabled) setMode("firebase")

    return () => {
      unsub()
      if (simTimer) window.clearInterval(simTimer)
    }
  }, [range, deviceId, dummyEnabled])

  return { samples, mode }
}

/* ------------------------------- Page ---------------------------------- */
export default function Sensors() {
  const [dummyEnabled, setDummyEnabled] = React.useState(getDummyDataEnabled())
  const [lastTransmissionTs, setLastTransmissionTs] = React.useState<number | null>(null)

  React.useEffect(() => onDummyDataChange(() => setDummyEnabled(getDummyDataEnabled())), [])

  const [range, setRange] = React.useState<RangeKey>("live")
  const { samples, mode } = useSensorHistory(range, DEVICE_ID, dummyEnabled)

  const [thresholds, setThresholds] = React.useState<Thresholds>(() => {
    const raw = localStorage.getItem(THRESHOLDS_KEY)
    return raw ? parseThresholds(raw) : DEFAULT_THRESHOLDS
  })

  React.useEffect(() => {
    let active = true
    // Try to load per-user thresholds from Firestore, fallback to localStorage
    const userEmail = localStorage.getItem("tt_user_email")
    if (!userEmail) {
      // Not logged in: use localStorage or defaults
      const saved = localStorage.getItem(THRESHOLDS_KEY)
      if (saved) setThresholds(parseThresholds(saved))
      return
    }

    const ref = doc(db, "user_accounts", userEmail, "thresholds", "config")
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!active) return
        if (snap.exists()) {
          const cloud = snap.data() as any
          setThresholds(parseThresholds(cloud))
          try {
            localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(cloud))
          } catch {}
        }
      },
      () => {}
    )

    return () => {
      active = false
      unsub()
    }
  }, [])

  React.useEffect(() => {
    if (dummyEnabled) {
      setLastTransmissionTs(null)
      return
    }

    const ref = doc(db, "sensor_readings", "latest")
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return
        const data = snap.data() as any
        const ts = data?.updatedAt?.toMillis?.() ?? data?.timestamp?.toMillis?.()
        if (ts) setLastTransmissionTs(ts)
      },
      () => {}
    )

    return () => {
      unsub()
    }
  }, [dummyEnabled])

  const weekly = useWeeklySeries(false) // Always use real Firestore data, never dummy data

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

  const sTemp = statusFor(kpi.temp.avg, thresholds.temperature.min, thresholds.temperature.max)
  const sMoist = statusFor(kpi.moist.avg, thresholds.moisture.min, thresholds.moisture.max)
  const sN = statusFor(kpi.n.avg, thresholds.npk.n.min, thresholds.npk.n.max)
  const sP = statusFor(kpi.p.avg, thresholds.npk.p.min, thresholds.npk.p.max)
  const sK = statusFor(kpi.k.avg, thresholds.npk.k.min, thresholds.npk.k.max)

  const insights = React.useMemo(() => {
    type Insight = { text: string; level: 'ok' | 'notice' | 'urgent' }
    const list: Insight[] = []
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

    // Moisture
    if (mt.trend.includes('Falling') || sMoist === 'low')
      list.push({ text: 'Moisture is declining. Add small amounts of water and mix to even the moisture.', level: 'notice' })
    else if (mt.trend.includes('Rising') || sMoist === 'high')
      list.push({ text: 'Moisture is high. Reduce watering and add dry bedding to restore balance.', level: 'notice' })

    // Temperature
    if (tt.trend.includes('Rising') || sTemp === 'high')
      list.push({ text: 'Temperature rising. Turn the pile or increase ventilation to reduce heat.', level: 'notice' })
    else if (tt.trend.includes('Falling') || sTemp === 'low')
      list.push({ text: 'Temperature falling. Check insulation and moisture; consider adding fresh food if activity is low.', level: 'notice' })

    // NPK
    const npkOkay = [sN, sP, sK].every((s) => s === "ok")
    if (!npkOkay) {
      const bad: string[] = []
      if (sN !== 'ok') bad.push(`N ${nT.trend.toLowerCase()}`)
      if (sP !== 'ok') bad.push(`P ${pT.trend.toLowerCase()}`)
      if (sK !== 'ok') bad.push(`K ${kT.trend.toLowerCase()}`)
      list.push({ text: `NPK out of range: ${bad.join(', ')}. Inspect recent feed and bedding; correct gradually.`, level: 'urgent' })
    }

    // If nothing notable
    if (list.length === 0) list.push({ text: 'All monitored parameters are within expected ranges. Continue regular checks.', level: 'ok' })

    // Conservative correlations: surface if moderate correlation found
    try {
      const R = Math.min(96, series.temp.length, series.moist.length)
      if (R >= 12) {
        const sTemp = series.temp.slice(-R)
        const sMoist = series.moist.slice(-R)
        const rTM = pearsonCorrelation(sTemp, sMoist)
        if (Number.isFinite(rTM) && Math.abs(rTM) >= 0.45)
          list.push({ text: `Temperature and moisture show ${rTM > 0 ? 'positive' : 'negative'} association. Check recent handling before changing routine.`, level: 'notice' })

        const nutrients = ['n','p','k'] as const
        for (const key of nutrients) {
          const sNut = (series as any)[key].slice(-R)
          const r = pearsonCorrelation(sMoist, sNut)
          if (Number.isFinite(r) && Math.abs(r) >= 0.45) {
            list.push({ text: `Moisture and ${key.toUpperCase()} move together. Moisture management may affect this nutrient reading.`, level: 'notice' })
          }
        }
      }
    } catch (e) {
      console.warn('correlation calc failed', e)
    }
    return list
  }, [sTemp, sMoist, sN, sP, sK])

  function helpTextForInsight(text: string){
    const t = text.toLowerCase()
    if (t.includes('moist') || t.includes('moisture')) return 'Moisture is the percent water content. Add small, incremental water and mix; avoid soaking.'
    if (t.includes('temperature') || t.includes('temp')) return 'Temperature reflects decomposition activity. To cool, turn the pile or increase airflow.'
    if (t.includes('npk') || t.includes('n ') || t.includes('p ') || t.includes('k ')) return 'NPK are ppm nutrient readings. If out of range, adjust feed or bedding gradually and retest.'
    if (t.includes('correlation') || t.includes('association')) return 'A statistical association - review recent changes (watering, feed, turning) before acting.'
    return 'Compare these tips with recent on-site actions (watering, turning, feeding) before making changes.'
  }

  const cardMotion = {
    initial: { opacity: 0, y: 20, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.4, ease: easeOut },
    whileHover: { scale: 1.02, y: -4, boxShadow: "0 10px 30px rgba(0,0,0,0.1)" },
  }

  return (
    <motion.div
      className="py-3 sm:py-4 md:py-6 text-gray-900 dark:text-gray-100 transition-colors duration-300"
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
          </div>
          <p className="text-xs opacity-70 italic">
            {range === "live" ? "Last 30 mins" : `Range: ${range}`}
          </p>
        </div>
        <p className="mt-2 text-sm opacity-80">
          {mode === "sim"
            ? "ESP32 not transmitting data, in simulation mode."
            : `ESP32 transmitted data last ${
                lastTransmissionTs
                  ? formatLastSeen(lastTransmissionTs)
                  : samples.length > 0
                    ? formatLastSeen(samples[samples.length - 1].ts)
                    : "N/A"
              }`}
        </p>
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
        <ChartCard title="Temperature" unit="°C" color="#10b981" data={movingAverage(series.temp, SMOOTHING_WINDOWS[range])} times={windowed.map(s=>s.ts)} bigValue={kpi.temp.avg} />
        <ChartCard title="Moisture" unit="%" color="#38bdf8" data={movingAverage(series.moist, SMOOTHING_WINDOWS[range])} times={windowed.map(s=>s.ts)} bigValue={kpi.moist.avg} />
        <NpkChartCard
          nSeries={movingAverage(series.n, SMOOTHING_WINDOWS[range])}
          pSeries={movingAverage(series.p, SMOOTHING_WINDOWS[range])}
          kSeries={movingAverage(series.k, SMOOTHING_WINDOWS[range])}
          times={windowed.map(s => s.ts)}
          kpi={{ n: kpi.n, p: kpi.p, k: kpi.k }}
        />
      </div>

      {/* Summary + Insights (bottom) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {/* Summary Card (left on desktop) */}
        <SummaryCard series={series} times={windowed.map(s=>s.ts)} kpi={kpi} range={range} />

        {/* Actionable Tips (right on desktop) */}
        <motion.section
          {...cardMotion}
          className="relative p-5 md:p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
          <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
          <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

          <div className="flex items-start justify-between mb-3">
            <h3 className="text-base font-semibold">Actionable Tips</h3>
          </div>

          <ul className="space-y-2 text-sm leading-relaxed">
            <AnimatePresence>
              {insights.map((it, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <span className={`mt-[6px] inline-block w-2 h-2 rounded-full ${it.level === 'urgent' ? 'bg-red-500' : it.level === 'notice' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <div className="text-sm leading-snug">{it.text}</div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${it.level === 'urgent' ? 'bg-red-100 text-red-700' : it.level === 'notice' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{it.level === 'urgent' ? 'Urgent' : it.level === 'notice' ? 'Notice' : 'OK'}</span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.section>
      </div>

      {/* Weekly Report Card */}
      <WeeklyReportCard
        tempSeries={weekly.temp}
        moistSeries={weekly.moist}
        nSeries={weekly.n}
        pSeries={weekly.p}
        kSeries={weekly.k}
        thresholds={thresholds}
        times={weekly.ts}
        source="firebase"
      />
    </motion.div>
  )
}

/* ----------------------------- Hooks ----------------------------- */
function useWeeklySeries(dummyEnabled: boolean, deviceId = DEVICE_ID) {
  const [temp, setTemp] = React.useState<number[]>([])
  const [moist, setMoist] = React.useState<number[]>([])
  const [n, setN] = React.useState<number[]>([])
  const [p, setP] = React.useState<number[]>([])
  const [k, setK] = React.useState<number[]>([])
  const [tsArr, setTsArr] = React.useState<number[]>([])

  React.useEffect(() => {
    // Always fetch from Firebase for weekly data - never use dummy data
    setTemp([])
    setMoist([])
    setN([])
    setP([])
    setK([])
    setTsArr([])

    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const ref = collection(db, "sensor_readings", deviceId, "readings")
    const q = query(
      ref,
      where("updatedAt", ">=", Timestamp.fromDate(cutoffDate)),
      orderBy("updatedAt", "asc"),
      qlimit(5000)
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const x = d.data() as any
            return {
              ts: x.updatedAt?.toMillis?.() ?? Date.now(),
              temp: Number(x.tempC ?? x.temperature),
              moist: Number(x.moisturePct ?? x.moisture),
              n: Number(x.npk?.n),
              p: Number(x.npk?.p),
              k: Number(x.npk?.k),
            }
          })
          .filter((r) => [r.temp, r.moist, r.n, r.p, r.k].every(Number.isFinite))

        if (!rows.length) {
          setTemp([])
          setMoist([])
          setN([])
          setP([])
          setK([])
          setTsArr([])
          return
        }

        setTemp(rows.map((r) => r.temp))
        setMoist(rows.map((r) => r.moist))
        setN(rows.map((r) => r.n))
        setP(rows.map((r) => r.p))
        setK(rows.map((r) => r.k))
        setTsArr(rows.map((r) => r.ts))
      },
      () => {
        setTemp([])
        setMoist([])
        setN([])
        setP([])
        setK([])
        setTsArr([])
      }
    )

    return () => {
      unsub()
    }
  }, [deviceId])

  return { temp, moist, n, p, k, ts: tsArr }
}

function WeeklyReportCard({ tempSeries, moistSeries, nSeries, pSeries, kSeries, thresholds, times, source }:{ tempSeries:number[]; moistSeries:number[]; nSeries:number[]; pSeries:number[]; kSeries:number[]; thresholds: Thresholds; times?: number[]; source: "dummy" | "firebase" }){
  const [isExporting, setIsExporting] = React.useState(false)

  // Desired points for a week (based on seriesWindow baseline)
  const weekPoints = seriesWindow * 7
  const pick = (arr:number[]) => arr.slice(-Math.min(arr.length, weekPoints))
  const tS = pick(tempSeries)
  const mS = pick(moistSeries)
  const nS = pick(nSeries)
  const pS = pick(pSeries)
  const kS = pick(kSeries)

  const hasData = tS.length > 0 || mS.length > 0 || nS.length > 0 || pS.length > 0 || kS.length > 0

  const coverageHours = Math.round((Math.max(tS.length, mS.length, nS.length) / seriesWindow) * 24)
  const coverageDays = Math.max(1, Math.round(coverageHours/24))

  const avg = (arr:number[]) => arr.length ? Number((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1)) : 0
  const tAvg = avg(tS), mAvg = avg(mS), nAvg = avg(nS), pAvg = avg(pS), kAvg = avg(kS)
  const tSd = stddev(tS), mSd = stddev(mS), nSd = stddev(nS), pSd = stddev(pS), kSd = stddev(kS)

  // alerts summary: count how many points were outside thresholds in the picked window
  const countOutOfRange = (arr:number[], lo:number, hi:number) => arr.filter(v => v < lo || v > hi).length
  const tAlerts = countOutOfRange(tS, thresholds.temperature.min, thresholds.temperature.max)
  const mAlerts = countOutOfRange(mS, thresholds.moisture.min, thresholds.moisture.max)
  const nAlerts = countOutOfRange(nS, thresholds.npk.n.min, thresholds.npk.n.max)
  const pAlerts = countOutOfRange(pS, thresholds.npk.p.min, thresholds.npk.p.max)
  const kAlerts = countOutOfRange(kS, thresholds.npk.k.min, thresholds.npk.k.max)
  const totalAlerts = tAlerts + mAlerts + nAlerts + pAlerts + kAlerts

  // stability: shared weighted score that favors temperature and moisture consistency
  const stabilityIndex = stabilityScore({
    temp: tS,
    moist: mS,
    n: nS,
    p: pS,
    k: kS,
  })
  const stabilityState =
    stabilityIndex >= 75
      ? { label: "Stable", detail: "Low variation", tone: "#10b981", bg: "#10b98122" }
      : stabilityIndex >= 50
        ? { label: "Moderate", detail: "Moderate variation", tone: "#f59e0b", bg: "#f59e0b22" }
        : { label: "Variable", detail: "High variation", tone: "#ef4444", bg: "#ef444422" }

  const weekEnd = new Date();
  const weekStart = new Date(Date.now() - 7*24*60*60*1000)

  const exportCsv = async () => {
    if (isExporting) return
    setIsExporting(true)

    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const ref = collection(db, "sensor_readings", DEVICE_ID, "readings")
      const q = query(
        ref,
        where("updatedAt", ">=", Timestamp.fromDate(cutoffDate)),
        orderBy("updatedAt", "asc"),
        qlimit(5000)
      )

      const snap = await getDocs(q)
      const escapeCsv = (value: unknown) => {
        if (value === null || value === undefined) return ""
        const raw =
          typeof value === "number" || typeof value === "boolean"
            ? String(value)
            : typeof value === "string"
              ? value
              : JSON.stringify(value)
        const escaped = raw.replace(/"/g, '""')
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
      }

      const rows: string[] = []
      rows.push(
        [
          "timestamp",
          "average_temperature",
          "average_moisture",
          "n",
          "p",
          "k",
        ].join(",")
      )

      snap.forEach((readingDoc) => {
        const data = readingDoc.data() as Record<string, any>
        const updatedAtMs = data.updatedAt?.toMillis?.() ?? ""
        const updatedAtIso = updatedAtMs ? new Date(updatedAtMs).toISOString() : ""

        const values = [
          updatedAtIso,
          data.tempC ?? data.temperature ?? "",
          data.moisturePct ?? data.moisture ?? "",
          data.npk?.n,
          data.npk?.p,
          data.npk?.k,
        ]

        rows.push(values.map(escapeCsv).join(","))
      })

      const csv = "\uFEFF" + rows.join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `firebase-raw-readings-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("CSV export failed", e)
    } finally {
      setIsExporting(false)
    }
  }

  // helper: counts below/above for plain sentences
  const countBelow = (arr:number[], v:number) => arr.filter(x=>x < v).length
  const countAbove = (arr:number[], v:number) => arr.filter(x=>x > v).length

  const interpretParam = (avg:number, arr:number[], lo:number, hi:number) => {
    const below = countBelow(arr, lo)
    const above = countAbove(arr, hi)
    if (below === 0 && above === 0) return { status: 'Perfect', icon: '✓', reason: 'Always in range', color: '#10b981' }
    if (below > above && below > 0) return { status: 'Too Low', icon: '↓', reason: `${below} readings below`, color: '#06b6d4' }
    if (above > below && above > 0) return { status: 'Too High', icon: '↑', reason: `${above} readings above`, color: '#ef4444' }
    return { status: 'Unstable', icon: '⚠', reason: `${below + above} out of range`, color: '#f59e0b' }
  }

  const tInfo = interpretParam(tAvg, tS, thresholds.temperature.min, thresholds.temperature.max)
  const mInfo = interpretParam(mAvg, mS, thresholds.moisture.min, thresholds.moisture.max)
  const nInfo = interpretParam(nAvg, nS, thresholds.npk.n.min, thresholds.npk.n.max)
  const pInfo = interpretParam(pAvg, pS, thresholds.npk.p.min, thresholds.npk.p.max)
  const kInfo = interpretParam(kAvg, kS, thresholds.npk.k.min, thresholds.npk.k.max)

  // Overall health summary - simple and clear
  const overallStatus = (() => {
    if (totalAlerts === 0) return { icon: '✓', text: 'Perfect Week', subtext: 'All conditions ideal', color: '#10b981' }
    if (totalAlerts <= 5) return { icon: '✓', text: 'Great', subtext: `${totalAlerts} minor issue${totalAlerts>1?'s':''}`, color: '#10b981' }
    if (totalAlerts <= 15) return { icon: '⚠', text: 'Watch', subtext: `${totalAlerts} readings off`, color: '#f59e0b' }
    return { icon: '⚠', text: 'Needs Attention', subtext: `${totalAlerts} issues detected`, color: '#ef4444' }
  })()

  // Action items - what user should do
  const actionItems: string[] = []
  if (tInfo.status.includes('Low')) actionItems.push('Add warmth or insulation')
  if (tInfo.status.includes('High')) actionItems.push('Improve ventilation or shade')
  if (mInfo.status.includes('Low')) actionItems.push('Add water or moisture')
  if (mInfo.status.includes('High')) actionItems.push('Reduce watering, improve drainage')
  if (nInfo.status.includes('Low')) actionItems.push('Add nitrogen-rich food scraps')
  if (pInfo.status.includes('Low')) actionItems.push('Add phosphorus-rich materials')
  if (kInfo.status.includes('Low')) actionItems.push('Add potassium-rich materials')
  if (nInfo.status.includes('High') || pInfo.status.includes('High') || kInfo.status.includes('High')) 
    actionItems.push('Balance nutrients, avoid overfeeding')
  
  if (actionItems.length === 0) actionItems.push('Keep doing what you\'re doing!')

  if (!hasData && source === "firebase") {
    return (
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36 }}
        className="relative mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md overflow-hidden text-gray-800 dark:text-gray-100"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
        <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">7-Day Summary</h3>
                <span className="text-xs px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200">
                  Firebase Data
                </span>
              </div>
              <div className="text-sm opacity-70 mt-2">No Firebase data found for the last 7 days.</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 p-4 text-sm text-gray-700 dark:text-gray-300">
            Check back when live sensor readings have accumulated (at least 24 hours of data).
          </div>
        </div>
      </motion.section>
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36 }}
      className="relative mt-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md overflow-hidden text-gray-800 dark:text-gray-100"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
      <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
      <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

      <div className="p-3 sm:p-4">
        {/* HEADER - Quick glance status */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">7-Day Summary</h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-200">
                {source === "dummy" ? "Demo" : "Live Data"}
              </span>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ background: overallStatus.color + '14', borderColor: `${overallStatus.color}55` }}>
                <span className="text-sm font-bold" style={{ color: overallStatus.color }}>{overallStatus.icon}</span>
                <div className="flex flex-col">
                  <span className="font-bold text-xs sm:text-sm leading-tight" style={{ color: overallStatus.color }}>{overallStatus.text}</span>
                  <span className="text-[11px] opacity-70 leading-tight">{overallStatus.subtext}</span>
                </div>
              </div>
            </div>
            <div className="text-xs sm:text-sm opacity-70 mt-1.5">{weekStart.toLocaleDateString()} - {weekEnd.toLocaleDateString()}</div>
          </div>

          <button 
            onClick={exportCsv} 
            disabled={isExporting}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
          >
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>

        {/* KEY METRICS - Visual cards that are easy to scan */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
          {/* Temperature Card */}
          <div className="rounded-xl border p-3 bg-white/60 dark:bg-gray-900/50" style={{ borderColor: tInfo.color + '44' }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <span className="font-semibold text-gray-900 dark:text-gray-100 block text-sm">Temperature</span>
                <span className="text-[11px] opacity-65">Target {thresholds.temperature.min}-{thresholds.temperature.max} °C</span>
              </div>
              <span className="text-base font-semibold" style={{ color: tInfo.color }}>{tInfo.icon}</span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="text-2xl font-bold tabular-nums">{tAvg.toFixed(1)}</span>
              <span className="text-xs opacity-70">°C</span>
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="px-2 py-0.5 rounded-md text-[11px] font-semibold w-fit border" style={{ background: tInfo.color + '18', color: tInfo.color, borderColor: tInfo.color + '55' }}>
                {tInfo.status}
              </div>
              <span className="opacity-70 text-[11px]">{tInfo.reason}</span>
            </div>
          </div>

          {/* Moisture Card */}
          <div className="rounded-xl border p-3 bg-white/60 dark:bg-gray-900/50" style={{ borderColor: mInfo.color + '44' }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <span className="font-semibold text-gray-900 dark:text-gray-100 block text-sm">Moisture</span>
                <span className="text-[11px] opacity-65">Target {thresholds.moisture.min}-{thresholds.moisture.max}%</span>
              </div>
              <span className="text-base font-semibold" style={{ color: mInfo.color }}>{mInfo.icon}</span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="text-2xl font-bold tabular-nums">{mAvg.toFixed(1)}</span>
              <span className="text-xs opacity-70">%</span>
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="px-2 py-0.5 rounded-md text-[11px] font-semibold w-fit border" style={{ background: mInfo.color + '18', color: mInfo.color, borderColor: mInfo.color + '55' }}>
                {mInfo.status}
              </div>
              <span className="opacity-70 text-[11px]">{mInfo.reason}</span>
            </div>
          </div>

          {/* NPK Card */}
          <div className="rounded-xl border p-3 bg-white/60 dark:bg-gray-900/50" style={{ borderColor: '#10b98144' }}>
            <div className="mb-2">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Nutrients (NPK)</span>
              <div className="text-[11px] opacity-65 mt-0.5">N {thresholds.npk.n.min}-{thresholds.npk.n.max} | P {thresholds.npk.p.min}-{thresholds.npk.p.max} | K {thresholds.npk.k.min}-{thresholds.npk.k.max}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-[11px] opacity-70 mb-0.5">N</div>
                <div className="text-xl font-bold tabular-nums">{Math.round(nAvg)}</div>
                <div className="text-[11px] mt-0.5" style={{ color: nInfo.color }}>{nInfo.status}</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] opacity-70 mb-0.5">P</div>
                <div className="text-xl font-bold tabular-nums">{Math.round(pAvg)}</div>
                <div className="text-[11px] mt-0.5" style={{ color: pInfo.color }}>{pInfo.status}</div>
              </div>
              <div className="text-center">
                <div className="text-[11px] opacity-70 mb-0.5">K</div>
                <div className="text-xl font-bold tabular-nums">{Math.round(kAvg)}</div>
                <div className="text-[11px] mt-0.5" style={{ color: kInfo.color }}>{kInfo.status}</div>
              </div>
            </div>
          </div>
        </div>

        {/* WHAT TO DO - Action items */}
        {actionItems.length > 0 && (
          <div className="mt-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 p-3">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Recommendations</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
              {actionItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STABILITY INDICATOR */}
        <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 gap-2">
          <div className="flex-1">
            <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Stability Index</div>
            <div className="text-xs opacity-70 mt-0.5">
              {stabilityState.detail}
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm w-fit" style={{ 
            background: stabilityState.bg,
            color: stabilityState.tone
          }}>
            {stabilityState.label} · {stabilityIndex}/100
          </div>
        </div>
      </div>
    </motion.section>
  )
}

/* ------------------------------ Subcomponents ------------------------------ */
function SummaryCard({ series, times, kpi, range }:{ series:{ temp:number[]; moist:number[]; n:number[]; p:number[]; k:number[] }, times?:number[]; kpi:any; range:RangeKey }){
  // Compute trends for the displayed data range
  const tempTrend = computeTrend(series.temp, times)
  const moistTrend = computeTrend(series.moist, times)
  const nTrend = computeTrend(series.n, times)
  const pTrend = computeTrend(series.p, times)
  const kTrend = computeTrend(series.k, times)

  // Simple status checks
  const tempStatus = statusFor(kpi.temp.avg, RANGES.temp.min, RANGES.temp.max)
  const moistStatus = statusFor(kpi.moist.avg, RANGES.moist.min, RANGES.moist.max)
  const nStatus = statusFor(kpi.n.avg, RANGES.n.min, RANGES.n.max)
  const pStatus = statusFor(kpi.p.avg, RANGES.p.min, RANGES.p.max)
  const kStatus = statusFor(kpi.k.avg, RANGES.k.min, RANGES.k.max)

  // Overall health
  const allOk = [tempStatus, moistStatus, nStatus, pStatus, kStatus].every(s => s === 'ok')
  const hasHigh = [tempStatus, moistStatus, nStatus, pStatus, kStatus].some(s => s === 'high')
  const hasLow = [tempStatus, moistStatus, nStatus, pStatus, kStatus].some(s => s === 'low')
  
  const overallStatus = allOk ? '✓ All Good' : hasHigh && hasLow ? '⚠ Mixed Issues' : hasHigh ? '↑ Too High' : '↓ Too Low'
  const overallColor = allOk ? '#10b981' : '#f59e0b'

  // Quick insights based on current data
  const insights: string[] = []
  
  // Temperature insights
  if (tempStatus === 'high') {
    insights.push('🌡️ Temperature is high - improve ventilation')
  } else if (tempStatus === 'low') {
    insights.push('🌡️ Temperature is low - check insulation or add warmth')
  } else if (tempTrend.trend.includes('Rising')) {
    insights.push('🌡️ Temperature rising steadily')
  } else if (tempTrend.trend.includes('Falling')) {
    insights.push('🌡️ Temperature declining')
  }

  // Moisture insights
  if (moistStatus === 'high') {
    insights.push('💧 Moisture is high - reduce watering')
  } else if (moistStatus === 'low') {
    insights.push('💧 Moisture is low - add water gradually')
  } else if (moistTrend.trend.includes('Rising')) {
    insights.push('💧 Moisture increasing')
  } else if (moistTrend.trend.includes('Falling')) {
    insights.push('💧 Moisture decreasing')
  }

  // NPK insights
  const npkIssues: string[] = []
  if (nStatus !== 'ok') npkIssues.push(`N ${nStatus}`)
  if (pStatus !== 'ok') npkIssues.push(`P ${pStatus}`)
  if (kStatus !== 'ok') npkIssues.push(`K ${kStatus}`)
  
  if (npkIssues.length > 0) {
    insights.push(`🌿 Nutrients: ${npkIssues.join(', ')} - adjust feeding`)
  }

  if (insights.length === 0) {
    insights.push('✅ All conditions looking good!')
  }

  // Time range label
  const timeLabel = range === 'live' ? 'Last 30 min' : range === '1h' ? 'Last hour' : range === '24h' ? 'Last 24 hours' : 'Last 7 days'

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-5 overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
      <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
      <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Quick Summary</h3>
        <div className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#111827' }}>{timeLabel}</div>
      </div>

      {/* Overall Status Badge */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: overallColor + '15', border: `2px solid ${overallColor}55` }}>
        <div className="text-2xl">{allOk ? '✓' : '⚠'}</div>
        <div className="flex-1">
          <div className="font-semibold" style={{ color: overallColor }}>{overallStatus}</div>
          <div className="text-xs opacity-70">For this {timeLabel.toLowerCase()}</div>
        </div>
      </div>

      {/* Current Values - Clean and simple */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌡️</span>
            <span className="text-sm font-medium">Temperature</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums">{kpi.temp.avg.toFixed(1)}°C</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: colorFor(tempStatus), color: '#fff' }}>
              {tempTrend.trend === 'Rising' ? '↑' : tempTrend.trend === 'Falling' ? '↓' : '→'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40">
          <div className="flex items-center gap-2">
            <span className="text-lg">💧</span>
            <span className="text-sm font-medium">Moisture</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums">{kpi.moist.avg.toFixed(1)}%</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: colorFor(moistStatus), color: '#fff' }}>
              {moistTrend.trend === 'Rising' ? '↑' : moistTrend.trend === 'Falling' ? '↓' : '→'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌿</span>
            <span className="text-sm font-medium">NPK</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold tabular-nums">
            <span>N: {kpi.n.avg}</span>
            <span className="opacity-50">•</span>
            <span>P: {kpi.p.avg}</span>
            <span className="opacity-50">•</span>
            <span>K: {kpi.k.avg}</span>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="text-xs font-semibold mb-2 opacity-70">Key Insights:</div>
        <div className="space-y-1.5">
          {insights.map((insight, i) => (
            <div key={i} className="text-sm leading-relaxed flex items-start gap-2">
              <span className="text-xs opacity-50">•</span>
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

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
  const statusLabel = (s: Status) => (s === 'ok' ? 'In range' : s === 'low' ? 'Low' : 'High')
  const statusHint = (s: Status) => (s === 'ok' ? 'Within target range' : s === 'low' ? 'Below target range' : 'Above target range')

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
              <div className="px-2 py-0.5 rounded-full text-xs font-semibold border" style={{ borderColor: colorFor(it.stat)+'55', background: colorFor(it.stat)+'10', color: colorFor(it.stat) }}>{statusLabel(it.stat)}</div>
            </div>
            <div className="text-2xl font-bold mt-2 tabular-nums" style={{ color: it.color }}>{it.val}</div>
            <div className="text-xs mt-1" style={{ color: colorFor(it.stat) }}>{statusHint(it.stat)}</div>
            <div className="text-xs opacity-70 mt-1">Recent average: {formatValue(it.ma,'ppm')}</div>
            <div className="text-xs opacity-60 mt-1">Outliers detected: {it.an}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs opacity-70">NPK values are shown in ppm. Use the status to see if each nutrient is in range, low, or high.</div>
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
          {interp} • Min: <span className="tabular-nums">{minV.toFixed(1)}{unit}</span>
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

