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
import { motion, AnimatePresence } from "framer-motion"

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
    () => ({
      temp: {
        avg: avg(series.temp),
        min: Math.min(...series.temp, Infinity) || 0,
        max: Math.max(...series.temp, -Infinity) || 0,
      },
      moist: {
        avg: avg(series.moist),
        min: Math.min(...series.moist, Infinity) || 0,
        max: Math.max(...series.moist, -Infinity) || 0,
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
    }),
    [series]
  )

  const sTemp = statusFor(kpi.temp.avg, RANGES.temp.min, RANGES.temp.max)
  const sMoist = statusFor(kpi.moist.avg, RANGES.moist.min, RANGES.moist.max)
  const sN = statusFor(kpi.n.avg, RANGES.n.min, RANGES.n.max)
  const sP = statusFor(kpi.p.avg, RANGES.p.min, RANGES.p.max)
  const sK = statusFor(kpi.k.avg, RANGES.k.min, RANGES.k.max)

  const insights = React.useMemo(() => {
    const list: string[] = []
    if (sMoist === "low")
      list.push("Moisture is trending low—consider watering lightly to reach 60–70%.")
    if (sMoist === "high")
      list.push("Moisture is high—add dry bedding and turn the bin to improve airflow.")
    if (sTemp === "high")
      list.push("Temperature is elevated—mix the bedding and reduce feed volume.")
    if (sTemp === "low")
      list.push("Temperature is low—insulate the bin and avoid over-watering.")
    const npkOkay = [sN, sP, sK].every((s) => s === "ok")
    if (!npkOkay)
      list.push("NPK balance is off—add carbon for high N, or a light feed for low N/P/K.")
    if (list.length === 0)
      list.push("All parameters look healthy. Maintain current routine.")
    return list
  }, [sTemp, sMoist, sN, sP, sK])

  const cardMotion = {
    initial: { opacity: 0, y: 20, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.4, ease: "easeOut" },
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
        className="relative rounded-2xl p-5 md:p-6 border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md"
      >
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
                samples.length > 0
                  ? new Date(samples[samples.length - 1].ts).toLocaleString()
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
        <KpiCard title="Temperature" unit="°C" color={colorFor(sTemp)} status={sTemp} values={kpi.temp} />
        <KpiCard title="Moisture" unit="%" color={colorFor(sMoist)} status={sMoist} values={kpi.moist} />
        <NpkKpiCard n={kpi.n.avg} p={kpi.p.avg} k={kpi.k.avg} status={{ n: sN, p: sP, k: sK }} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 mt-5">
        <ChartCard title="Temperature" unit="°C" color="#10b981" data={series.temp} bigValue={kpi.temp.avg} />
        <ChartCard title="Moisture" unit="%" color="#38bdf8" data={series.moist} bigValue={kpi.moist.avg} />
        <ChartCard
          title="NPK (mean)"
          unit=""
          color="#f59e0b"
          data={series.n.map((v, i) =>
            Math.round((v + (series.p[i] ?? v) + (series.k[i] ?? v)) / 3)
          )}
          bigValue={Math.round((kpi.n.avg + kpi.p.avg + kpi.k.avg) / 3)}
        />
      </div>

      {/* Insights */}
      <motion.section
        {...cardMotion}
        className="relative mt-5 p-5 md:p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md"
      >
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
                <span>{t}</span>
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
}: {
  title: string
  unit: string
  color: string
  status: Status
  values: { avg: number; min: number; max: number }
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.03, y: -4 }}
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-5 text-center sm:text-left"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
        <h4 className="text-base font-semibold">{title}</h4>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold border```tsx
          "
          style={{
            color,
            borderColor: color + "55",
            background: color + "10",
          }}
        >
          {status.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm justify-items-center sm:justify-items-start">
        <div>
          <div className="text-xs opacity-70">Avg</div>
          <div className="font-semibold">{values.avg.toFixed(1)}{unit}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Min</div>
          <div className="font-semibold">{values.min.toFixed(1)}{unit}</div>
        </div>
        <div>
          <div className="text-xs opacity-70">Max</div>
          <div className="font-semibold">{values.max.toFixed(1)}{unit}</div>
        </div>
      </div>
    </motion.div>
  )
}

function NpkKpiCard({
  n,
  p,
  k,
  status,
}: {
  n: number
  p: number
  k: number
  status: { n: Status; p: Status; k: Status }
}) {
  const item = (label: string, v: number, s: Status) => (
    <div
      className="flex items-center justify-between rounded-lg border px-3 py-2 w-full sm:w-auto"
      style={{
        borderColor: colorFor(s) + "55",
        background: colorFor(s) + "0F",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: colorFor(s) }}
        />
        <span className="text-xs opacity-80">{label}</span>
      </div>
      <div className="font-semibold tabular-nums">{v}</div>
    </div>
  )
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.03, y: -4 }}
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-5 text-center sm:text-left"
    >
      <h4 className="text-base font-semibold mb-3">NPK</h4>
      <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 justify-items-center sm:justify-items-start">
        {item("N", n, status.n)}
        {item("P", p, status.p)}
        {item("K", k, status.k)}
      </div>
      <div className="mt-2 text-xs opacity-70">Units based on your NPK sensor (e.g., ppm / a.u.).</div>
    </motion.div>
  )
}

function ChartCard({
  title,
  unit,
  color,
  data,
  bigValue,
}: {
  title: string
  unit: string
  color: string
  data: number[]
  bigValue?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-5 text-center sm:text-left"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between text-center sm:text-left">
        <h4 className="text-base font-semibold">{title}</h4>
        <div className="text-lg font-semibold tabular-nums mt-1 sm:mt-0">
          {Number.isFinite(bigValue) ? `${bigValue!.toFixed(1)}${unit}` : "--"}
        </div>
      </div>
      <AutoChart data={data} stroke={color} />
    </motion.section>
  )
}

/* ------------------------------ Chart ------------------------------ */
function AutoChart({ data, stroke }: { data: number[]; stroke: string }) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [size, setSize] = React.useState({ w: 900, h: 220 })

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

  return (
    <div ref={ref} className="w-full mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
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
      </svg>
    </div>
  )
}
