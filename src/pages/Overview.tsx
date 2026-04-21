// Overview.tsx
import React from "react"
import { Link } from "react-router-dom"
import { collection, doc, onSnapshot, orderBy, query, limit as qlimit } from "firebase/firestore"
import { db } from "../lib/firebase"   // your firebase config
import { motion, AnimatePresence } from "framer-motion"
import { computeTrend, formatValue, movingAverage, stddev, detectAnomalies, pearsonCorrelation } from "../lib/trend"
import { getDummyDataEnabled, onDummyDataChange } from "../lib/dummyData"
import HelpTip from "../components/HelpTip"

/* --------------------------- Types & helpers --------------------------- */

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
const DEVICE_ID = "esp32-001"
const DEFAULT_THRESHOLDS: Thresholds = {
  temperature: { min: 15, max: 65 },
  moisture: { min: 40, max: 80 },
  npk: { n: { min: 50, max: 200 }, p: { min: 20, max: 100 }, k: { min: 50, max: 200 } },
}

const parseThresholds = (raw: any): Thresholds => {
  try {
    const t = typeof raw === "string" ? JSON.parse(raw) : (raw ?? {})
    return {
      temperature: { min: Number(t?.temperature?.min ?? 15), max: Number(t?.temperature?.max ?? 65) },
      moisture:    { min: Number(t?.moisture?.min ?? 40),     max: Number(t?.moisture?.max ?? 80) },
      npk: {
        n: { min: Number(t?.n?.min ?? t?.npk?.n?.min ?? 50),  max: Number(t?.n?.max ?? t?.npk?.n?.max ?? 200) },
        p: { min: Number(t?.p?.min ?? t?.npk?.p?.min ?? 20),  max: Number(t?.p?.max ?? t?.npk?.p?.max ?? 100) },
        k: { min: Number(t?.k?.min ?? t?.npk?.k?.min ?? 50),  max: Number(t?.k?.max ?? t?.npk?.k?.max ?? 200) },
      },
    }
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

type StatusKey = "ok" | "warn" | "alert"
const statusColor: Record<StatusKey, string> = {
  ok: "#10b981",
  warn: "#f59e0b",
  alert: "#ef4444",
}
const statusDotClass: Record<StatusKey, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  alert: "bg-rose-500",
}

const statusPhrase = (status: StatusKey) => {
  if (status === "ok") return "In range"
  if (status === "warn") return "Near limit"
  return "Needs action"
}

const trendPhrase = (trend: string) => {
  const t = trend.toLowerCase()
  if (t.includes("rise")) return "Rising steadily"
  if (t.includes("fall")) return "Falling steadily"
  if (t.includes("stable")) return "Holding steady"
  return "Not enough data"
}

const clamp = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v))
const avg = (arr:number[]) => (arr.length ? Number((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1)) : 0)
const min = (arr:number[]) => (arr.length ? Math.min(...arr) : 0)
const max = (arr:number[]) => (arr.length ? Math.max(...arr) : 0)

const seriesWindow = 96 // ~24h if every 15min
const append = (arr:number[], v:number) => [...arr.slice(-(seriesWindow-1)), v]

const sFor = (v:number, lo:number, hi:number): StatusKey => {
  if (v < lo*0.95 || v > hi*1.05) return "alert"
  if (v < lo || v > hi) return "warn"
  return "ok"
}

const formatLastUpdate = (timestamp: number) => {
  const now = Date.now()
  const diffMs = Math.max(0, now - timestamp)
  const seconds = Math.round(diffMs / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)

  const relative =
    seconds < 60 ? `${seconds} second${seconds === 1 ? "" : "s"}` :
    minutes < 60 ? `${minutes} minute${minutes === 1 ? "" : "s"}` :
    hours < 24 ? `${hours} hour${hours === 1 ? "" : "s"}` :
    `${days} day${days === 1 ? "" : "s"}`

  return `${relative} ago (${new Date(timestamp).toLocaleString()})`
}

/* --------------------------------------------------------------------- */
/*            Live series hook – Firestore first, SIM as fallback        */
/* --------------------------------------------------------------------- */

function useLiveSeries(dummyEnabled: boolean) {
  const [temp, setTemp]   = React.useState<number[]>([])
  const [moist, setMoist] = React.useState<number[]>([])
  const [n, setN]         = React.useState<number[]>([])
  const [p, setP]         = React.useState<number[]>([])
  const [k, setK]         = React.useState<number[]>([])
  const [latestTemp, setLatestTemp] = React.useState<number | null>(null)
  const [latestMoist, setLatestMoist] = React.useState<number | null>(null)
  const [latestN, setLatestN] = React.useState<number | null>(null)
  const [latestP, setLatestP] = React.useState<number | null>(null)
  const [latestK, setLatestK] = React.useState<number | null>(null)
  const [tsArr, setTsArr] = React.useState<number[]>([])
  const [mode, setMode]   = React.useState<"firebase"|"sim">(dummyEnabled ? "sim" : "firebase")
  const [lastUpdate, setLastUpdate] = React.useState<number|null>(null)

  // seed with simulated history so cards aren’t empty
  React.useEffect(() => {
    if (!dummyEnabled) return
    if (temp.length) return
    const t:number[] = [], m:number[] = []
    const ns:number[] = [], ps:number[] = [], ks:number[] = []
      const ts:number[] = []
    let tv=48, mv=62, nv=120, pv=55, kv=130
    for (let i=0;i<seriesWindow;i++){
      tv = clamp(tv + (Math.random()-0.5)*1.1, 25, 70)
      mv = clamp(mv + (Math.random()-0.5)*1.3, 30, 90)
      nv = clamp(nv + (Math.random()-0.5)*6,  30, 260)
      pv = clamp(pv + (Math.random()-0.5)*4,  10, 150)
      kv = clamp(kv + (Math.random()-0.5)*6,  30, 260)
      t.push(Number(tv.toFixed(1)))
      m.push(Number(mv.toFixed(1)))
      ns.push(Math.round(nv)); ps.push(Math.round(pv)); ks.push(Math.round(kv))
    }
    // seed timestamps spaced like the sim interval (~9s)
    const now = Date.now()
    for (let i=0;i<seriesWindow;i++) ts.push(now - (seriesWindow - i) * 9000)
    setTemp(t); setMoist(m); setN(ns); setP(ps); setK(ks); setTsArr(ts)
    setLatestTemp(t.at(-1) ?? null)
    setLatestMoist(m.at(-1) ?? null)
    setLatestN(ns.at(-1) ?? null)
    setLatestP(ps.at(-1) ?? null)
    setLatestK(ks.at(-1) ?? null)
  }, [dummyEnabled, temp.length])

  // attach to Firestore `/sensor_readings/latest`; if it never yields valid data, keep SIM ticking
  React.useEffect(() => {
    let simTimer: number | undefined

    const startSim = () => {
      if (simTimer) return
      simTimer = window.setInterval(() => {
        const t = clamp((temp.at(-1) ?? 48) + (Math.random()-0.5)*1.0, 25, 70)
        const m = clamp((moist.at(-1) ?? 62) + (Math.random()-0.5)*1.2, 30, 90)
        const nv = clamp((n.at(-1) ?? 120) + (Math.random()-0.5)*6, 30, 260)
        const pv = clamp((p.at(-1) ?? 55)  + (Math.random()-0.5)*4, 10, 150)
        const kv = clamp((k.at(-1) ?? 130) + (Math.random()-0.5)*6, 30, 260)
        const ts = Date.now()
        setTemp(prev => append(prev, Number(t.toFixed(1))))
        setMoist(prev => append(prev, Number(m.toFixed(1))))
        setN(prev => append(prev, Math.round(nv)))
        setP(prev => append(prev, Math.round(pv)))
        setK(prev => append(prev, Math.round(kv)))
        setTsArr(prev => append(prev, ts))
        setLatestTemp(Number(t.toFixed(1)))
        setLatestMoist(Number(m.toFixed(1)))
        setLatestN(Math.round(nv))
        setLatestP(Math.round(pv))
        setLatestK(Math.round(kv))
      }, 9000) as unknown as number
    }

    if (dummyEnabled) {
      setMode("sim")
      startSim()
      return () => {
        if (simTimer) window.clearInterval(simTimer)
      }
    }

    setMode("firebase")
    setTemp([])
    setMoist([])
    setN([])
    setP([])
    setK([])
    setLatestTemp(null)
    setLatestMoist(null)
    setLatestN(null)
    setLatestP(null)
    setLatestK(null)
    setTsArr([])

    const ref = collection(db, "sensor_readings", DEVICE_ID, "readings")
    const q = query(
      ref,
      orderBy("updatedAt", "desc"),
      qlimit(1)
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
              tempArray: Array.isArray(x.tempArray)
                ? x.tempArray
                    .map((v: any) => Number(v))
                    .filter((v: number) => Number.isFinite(v) && v > -127)
                : [],
              moistureArray: Array.isArray(x.moistureArray)
                ? x.moistureArray
                    .map((v: any) => Number(v))
                    .filter((v: number) => Number.isFinite(v) && v >= 0 && v <= 100)
                : [],
            }
          })
          .filter((r) => [r.temp, r.moist, r.n, r.p, r.k].every(Number.isFinite))

        if (!rows.length) {
          setTemp([])
          setMoist([])
          setN([])
          setP([])
          setK([])
          setLatestTemp(null)
          setLatestMoist(null)
          setLatestN(null)
          setLatestP(null)
          setLatestK(null)
          setTsArr([])
          return
        }

        const latest = rows[rows.length - 1]
        setTemp(latest.tempArray.length ? latest.tempArray : [latest.temp])
        setMoist(latest.moistureArray.length ? latest.moistureArray : [latest.moist])
        setN([latest.n])
        setP([latest.p])
        setK([latest.k])
        setLatestTemp(latest.temp)
        setLatestMoist(latest.moist)
        setLatestN(latest.n)
        setLatestP(latest.p)
        setLatestK(latest.k)
        setTsArr([latest.ts])
      },
      () => {
        setMode("firebase")
      }
    )

    return () => {
      unsub()
      if (simTimer) window.clearInterval(simTimer)
    }
  }, [dummyEnabled])

  React.useEffect(() => {
    if (dummyEnabled) return
    const ref = doc(db, "sensor_readings", "latest")
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return
        const timestamp = snap.data()?.updatedAt?.toMillis() ||
                         snap.data()?.timestamp?.toMillis()
        if (timestamp) setLastUpdate(timestamp)
      },
      () => {}
    )
    return () => {
      unsub()
    }
  }, [dummyEnabled])

  return { temp, moist, n, p, k, latestTemp, latestMoist, latestN, latestP, latestK, ts: tsArr, mode, lastUpdate }
}


/* ------------------------------ Component ------------------------------ */

export default function Overview() {
  const [dummyEnabled, setDummyEnabled] = React.useState(getDummyDataEnabled())
  const [userEmail, setUserEmail] = React.useState<string | null>(null)

  React.useEffect(() => onDummyDataChange(() => setDummyEnabled(getDummyDataEnabled())), [])

  // Restore session from localStorage.
  React.useEffect(() => {
    const saved = localStorage.getItem("tt_user_email")
    setUserEmail(saved)
  }, [])

  const [thresholds, setThresholds] = React.useState<Thresholds>(() => {
    const raw = localStorage.getItem(THRESHOLDS_KEY)
    return raw ? parseThresholds(raw) : DEFAULT_THRESHOLDS
  })

  // Load thresholds from global config (logged out) or personal account (logged in)
  React.useEffect(() => {
    if (!userEmail) {
      // No user logged in - load from global config or defaults
      let active = true
      const ref = doc(db, "alert_configs", "default")
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!active || !snap.exists()) return
          const cloud = snap.data() as any
          if (!cloud?.thresholds) return
          const next = parseThresholds(cloud.thresholds)
          setThresholds(next)
          try {
            localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(cloud.thresholds))
          } catch {}
        },
        () => {}
      )

      return () => {
        active = false
        unsub()
      }
    }

    // User is logged in - load from user's personal thresholds
    let active = true
    const userThresholdRef = doc(db, "user_accounts", userEmail, "thresholds", "config")
    const unsub = onSnapshot(
      userThresholdRef,
      (snap) => {
        if (!active) return
        if (snap.exists()) {
          const cloud = snap.data() as any
          const next = parseThresholds(cloud)
          setThresholds(next)
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
  }, [userEmail])

  const { temp, moist, n, p, k, latestTemp, latestMoist, latestN, latestP, latestK, ts, mode, lastUpdate } = useLiveSeries(dummyEnabled)

  const hasOverviewData = temp.length > 0 || moist.length > 0 || n.length > 0 || p.length > 0 || k.length > 0

  const safeMin = (arr: number[]) => (arr.length ? Math.min(...arr) : null)
  const safeMax = (arr: number[]) => (arr.length ? Math.max(...arr) : null)

  const summary = {
    temp:  { avg: latestTemp, min: safeMin(temp), max: safeMax(temp) },
    moist: { avg: latestMoist, min: safeMin(moist), max: safeMax(moist) },
    npk: {
      n: { avg: latestN },
      p: { avg: latestP },
      k: { avg: latestK },
    },
  }

  const sTemp  = summary.temp.avg === null ? "ok" : sFor(summary.temp.avg,  thresholds.temperature.min, thresholds.temperature.max)
  const sMoist = summary.moist.avg === null ? "ok" : sFor(summary.moist.avg, thresholds.moisture.min,     thresholds.moisture.max)
  const sN     = summary.npk.n.avg === null ? "ok" : sFor(summary.npk.n.avg, thresholds.npk.n.min,        thresholds.npk.n.max)
  const sP     = summary.npk.p.avg === null ? "ok" : sFor(summary.npk.p.avg, thresholds.npk.p.min,        thresholds.npk.p.max)
  const sK     = summary.npk.k.avg === null ? "ok" : sFor(summary.npk.k.avg, thresholds.npk.k.min,        thresholds.npk.k.max)

  const npkWorst: StatusKey = (["alert","warn","ok"] as StatusKey[]).find(k => [sN,sP,sK].includes(k)) || "ok"
  const healthRank: StatusKey = (["alert","warn","ok"] as StatusKey[]).find(k => [sTemp, sMoist, npkWorst].includes(k)) || "ok"

  const alerts: Array<{ id:string; level:StatusKey; msg:string }> = []
  if (hasOverviewData) {
    if (sTemp  !== "ok") alerts.push({ id:"t", level:sTemp,  msg: sTemp==="warn" ? "Temperature close to limit" : "Temperature outside safe range" })
    if (sMoist !== "ok") alerts.push({ id:"m", level:sMoist, msg: sMoist==="warn" ? "Moisture close to limit" : "Moisture outside safe range" })
    if (sN     !== "ok") alerts.push({ id:"n", level:sN, msg: sN==="warn" ? "Nitrogen close to limit" : "Nitrogen outside safe range" })
    if (sP     !== "ok") alerts.push({ id:"p", level:sP, msg: sP==="warn" ? "Phosphorus close to limit" : "Phosphorus outside safe range" })
    if (sK     !== "ok") alerts.push({ id:"k", level:sK, msg: sK==="warn" ? "Potassium close to limit" : "Potassium outside safe range" })
  }

  const tips = [
    "Keep moisture like a wrung sponge, not dripping.",
    "Add dry cardboard to balance fresh scraps.",
    "Turn bedding weekly to keep airflow steady.",
    "Balance NPK slowly to avoid sudden stress.",
    "Feed in small batches to reduce odor spikes.",
  ]
  const [tipIdx, setTipIdx] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(()=> setTipIdx(i => (i+1) % tips.length), 8000)
    return () => clearInterval(id)
  }, [])

  const containerVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } } }
  const cardVariant = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.45 } }, hover: { scale: 1.02 } }
  const alertVariant = { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 8 } }

  return (
    <motion.div
      className="space-y-3 md:space-y-4 overview-root text-gray-800 dark:text-gray-100"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header / Health */}
      <motion.section className="card card-live relative p-3 sm:p-4 md:p-6 overflow-hidden text-gray-800 dark:text-gray-100"
        variants={cardVariant} whileHover="hover"
        style={{ willChange: 'transform,opacity' }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] card-shimmer" />
        <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
        <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Overview
              </h1>
              <motion.span className="live-badge px-2 py-0.5 rounded-full text-xs font-semibold border opacity-95 whitespace-nowrap">
                {mode === "firebase" ? "LIVE • Firebase" : "SIM"}
              </motion.span>
            </div>
            {mode === "sim" ? (
              <p className="mt-1 text-sm sm:text-sm text-amber-700 dark:text-amber-300">
                ESP32 not transmitting data, in simulation mode
              </p>
            ) : lastUpdate ? (
              <p className="mt-1 text-sm sm:text-sm text-emerald-700 dark:text-emerald-300">
                ESP32 last transmitted data {formatLastUpdate(lastUpdate)}
              </p>
            ) : (
              <p className="mt-1 text-sm sm:text-sm text-gray-500 dark:text-gray-300">
                No Firebase data in the last 3 hours
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <span className="text-sm sm:text-sm opacity-80 whitespace-nowrap">Overall health</span>
            <motion.span
              className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs sm:text-xs font-semibold health-pill whitespace-nowrap"
              animate={{ backgroundColor: statusColor[healthRank] + '22', color: statusColor[healthRank] }}
              style={{ border: `1px solid ${statusColor[healthRank]}44` }}
            >
              {healthRank === "ok" ? "All clear" : healthRank === "warn" ? "Needs review" : "Take action"}
            </motion.span>
          </div>
        </div>
      </motion.section>

      {/* Harvest Readiness card removed — placeholder deleted. */}

      {/* Weekly report (moved to bottom for layout/animation parity) */}

      {/* Mobile-only Active Alerts - appears right after Overview */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36 }}
        className="lg:hidden relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-4 sm:p-5 overflow-hidden text-gray-800 dark:text-gray-100"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
        <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <h3 className="text-base sm:text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100">Active alerts</h3>
        <div className="mt-3 space-y-2">
          {alerts.length === 0 && (
            <div className="rounded-lg border border-[hsl(var(--border))] dark:border-white/10 px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-sm text-gray-700 dark:text-gray-300 opacity-80">No active alerts. Readings are in range.</div>
          )}
          <AnimatePresence>
            {alerts.map(a => (
              <motion.div
                key={a.id}
                className="rounded-lg border px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-sm flex items-center gap-2 alert-row"
                style={{ borderColor: statusColor[a.level]+"55", background: statusColor[a.level]+"10", color: statusColor[a.level] }}
                variants={alertVariant}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                <span className={"w-2 h-2 rounded-full flex-shrink-0 "+statusDotClass[a.level]} />
                <span className="font-medium">{a.msg}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-4 sm:mt-5 border-t border-[hsl(var(--border))] dark:border-white/10 pt-3 sm:pt-4">
          <h4 className="text-sm sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Quick tip</h4>
          <div className="mt-1 tip-wrap">
            <AnimatePresence mode="wait">
              <motion.p key={tipIdx} className="text-sm sm:text-sm text-gray-700 dark:text-gray-200 mt-1 tip-text" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{tips[tipIdx]}</motion.p>
            </AnimatePresence>
          </div>
          <div className="mt-3 text-xs sm:text-xs flex flex-wrap gap-3 sm:gap-4 opacity-80 text-gray-600 dark:text-gray-400">
            <Link to="/about" className="hover:underline">Detailed guides</Link>
            <Link to="/sensors" className="hover:underline text-emerald-600 dark:text-emerald-400">
              7-Day Summary
            </Link>
          </div>
        </div>
      </motion.section>

        {/* Summaries + Right column (Harvest + Alerts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 text-gray-800 dark:text-gray-100">
        <section className="lg:col-span-8 space-y-3 md:space-y-4">
          {/* Temperature & Moisture side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <SummaryRow
              title="Temperature"
              unit="°C"
              data={summary.temp}
              status={sTemp}
              gradient="from-emerald-400/35 via-emerald-400/10 to-emerald-400/0"
              sparkColor="#10b981"
              series={temp}
              times={ts}
              thresholds={thresholds.temperature}
            />
            <SummaryRow
              title="Moisture"
              unit="%"
              data={summary.moist}
              status={sMoist}
              gradient="from-sky-400/35 via-sky-400/10 to-sky-400/0"
              sparkColor="#38bdf8"
              series={moist}
              times={ts}
              thresholds={thresholds.moisture}
            />
          </div>
          <NPKRow
            data={summary.npk}
            status={npkWorst}
            statuses={{ n:sN, p:sP, k:sK }}
            thresholds={thresholds.npk}
            series={{ n, p, k }}
            times={ts}
          />
        </section>

        {/* Right column: Harvest card (glassy) + Active Alerts (separate card) - Desktop only */}
        <div className="hidden lg:flex lg:col-span-4 flex-col gap-3">
          {/* Harvest card removed per request */}

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36 }}
            className="flex-1 relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur-md p-4 sm:p-5 overflow-hidden text-gray-800 dark:text-gray-100"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
            <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
            <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

            <h3 className="text-base sm:text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100">Active alerts</h3>
            <div className="mt-3 space-y-2">
              {alerts.length === 0 && (
                <div className="rounded-lg border border-[hsl(var(--border))] dark:border-white/10 px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-sm text-gray-700 dark:text-gray-300 opacity-80">No active alerts. Readings are in range.</div>
              )}
              <AnimatePresence>
                {alerts.map(a => (
                  <motion.div
                    key={a.id}
                    className="rounded-lg border px-2 sm:px-3 py-1.5 sm:py-2 text-sm sm:text-sm flex items-center gap-2 alert-row"
                    style={{ borderColor: statusColor[a.level]+"55", background: statusColor[a.level]+"10", color: statusColor[a.level] }}
                    variants={alertVariant}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                  >
                    <span className={"w-2 h-2 rounded-full flex-shrink-0 "+statusDotClass[a.level]} />
                    <span className="font-medium">{a.msg}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-4 sm:mt-5 border-t border-[hsl(var(--border))] dark:border-white/10 pt-3 sm:pt-4">
              <h4 className="text-sm sm:text-sm font-semibold text-gray-900 dark:text-gray-100">Quick tip</h4>
              <div className="mt-1 tip-wrap">
                <AnimatePresence mode="wait">
                  <motion.p key={tipIdx} className="text-sm sm:text-sm text-gray-700 dark:text-gray-200 mt-1 tip-text" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>{tips[tipIdx]}</motion.p>
                </AnimatePresence>
              </div>
              <div className="mt-3 text-xs sm:text-xs flex flex-wrap gap-3 sm:gap-4 opacity-80 text-gray-600 dark:text-gray-400">
                <Link to="/about" className="hover:underline">Detailed guides</Link>
                <Link to="/sensors" className="hover:underline text-emerald-600 dark:text-emerald-400">
                  7-Day Summary
                </Link>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {/* Styles unchanged except for dark-friendly colors */}
      <style>{`
        .live-badge {
          display:inline-flex; align-items:center; justify-content:center;
          border-radius:9999px;
          border:1px solid rgba(15,23,42,0.06);
          background:#ecfdf5;
          color:#065f46;
        }
        .dark .live-badge {
          background: linear-gradient(90deg, rgba(16,185,129,0.10), rgba(6,182,212,0.05));
          color:#d1fae5; border-color:rgba(255,255,255,0.04);
        }
        .card-shimmer {
          position:absolute; left:0; right:0; top:0; height:6px;
          border-top-left-radius:12px; border-top-right-radius:12px;
          background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.06) 40%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.06) 60%,rgba(255,255,255,0) 100%);
          background-size:200% 100%; animation: shimmerMove 2200ms linear infinite;
        }
        @keyframes shimmerMove {
          0% { background-position:-100% 0; }
          100% { background-position:200% 0; }
        }
      `}</style>
    </motion.div>
  )
}

/* ------------------------------ Bits & UI ------------------------------ */

function SummaryRow({
  title, unit, data, status, gradient, sparkColor, series, times, thresholds
}:{
  title: string
  unit: string
  data: { avg:number | null; min:number | null; max:number | null }
  status: StatusKey
  gradient: string
  sparkColor: string
  series: number[]
  times?: number[]
  thresholds: { min:number; max:number }
}) {
  const cardVariantLocal = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45 } }
  }

  // Compute trend
  const s = series.slice(-48)
  const t = computeTrend(s, times ? times.slice(-48) : undefined)
  const trend = s.length < 2 ? 'N/A' : t.trend
  const trendLabel = trendPhrase(trend)
  const pctStr = s.length < 2 || !Number.isFinite(t.pct) ? '--' : `${t.pct >= 0 ? '+' : ''}${t.pct.toFixed(1)}%`
  const avgVal = Number.isFinite(data.avg) ? (data.avg as number) : null
  const deltaToBoundary = avgVal === null
    ? null
    : Math.min(Math.abs(avgVal - thresholds.min), Math.abs(thresholds.max - avgVal))
  const deltaLabel = avgVal === null ? '--' : `Δ ${deltaToBoundary!.toFixed(1)}${unit}`
  const deltaColor = avgVal === null
    ? '#94a3b8'
    : deltaToBoundary! <= 0.25
      ? '#ef4444'
      : deltaToBoundary! <= 1
        ? '#f59e0b'
        : '#10b981'

  return (
    <motion.section className="card card-live relative overflow-hidden"
      variants={cardVariantLocal}
      initial="hidden"
      animate="show"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] card-shimmer" />
      <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
      <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />
      <div className="p-3 sm:p-5 md:p-6">
        {/* Header with title and status */}
        <div className="flex items-center justify-between gap-3 mb-3 sm:mb-5">
          <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wide opacity-85 text-gray-900 dark:text-gray-100">{title}</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap"
                style={{ color: statusColor[status], borderColor: statusColor[status]+"55", background: statusColor[status]+"10" }}>
            {statusPhrase(status)}
          </span>
        </div>
        
        {/* Primary metric display */}
        <div className="mb-3 sm:mb-5">
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold tabular-nums text-gray-900 dark:text-white mb-2 sm:mb-3">
            {formatValue(Number.isFinite(data.avg) ? (data.avg as number) : NaN, unit)}
          </div>
          
          {/* Secondary metrics: Min/Max on one line */}
          <div className="flex items-baseline gap-4 sm:gap-6 text-xs sm:text-sm mb-3 sm:mb-4 text-gray-700 dark:text-gray-300">
            <div>
              <span className="opacity-60 mr-0.5 sm:mr-1">Min</span>
              <span className="font-medium">{formatValue(Number.isFinite(data.min) ? (data.min as number) : NaN, unit)}</span>
            </div>
            <div className="w-px h-3 sm:h-4 bg-gray-300 dark:bg-white/10" />
            <div>
              <span className="opacity-60 mr-0.5 sm:mr-1">Max</span>
              <span className="font-medium">{formatValue(Number.isFinite(data.max) ? (data.max as number) : NaN, unit)}</span>
            </div>
          </div>

          {/* Trend indicator */}
          <div className="border-t border-gray-300 dark:border-white/5 pt-2 sm:pt-3">
            <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="opacity-70">Trend:</span>
                <span className="font-medium">{trendLabel}</span>
                <span className="opacity-60">•</span>
                <span className="tabular-nums font-medium">{pctStr}</span>
              </div>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-semibold tabular-nums border"
                style={{ color: deltaColor, borderColor: deltaColor + "55", background: deltaColor + "10" }}
              >
                {deltaLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className={`absolute inset-x-0 bottom-0 h-12 sm:h-16 bg-gradient-to-t ${gradient} pointer-events-none`} />
    </motion.section>
  )
}

function KV({ label, value }: { label:string; value:string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs sm:text-xs opacity-70 truncate">{label}</div>
      <div className="font-semibold tabular-nums text-sm sm:text-sm truncate">{value}</div>
    </div>
  )
}

/* NPK card (three metrics, colored + mobile friendly) */
function NPKRow({
  data,
  status,
  statuses,
  thresholds,
  series,
  times
}:{
  data: { n:{avg:number | null}; p:{avg:number | null}; k:{avg:number | null} }
  status: StatusKey
  statuses: { n:StatusKey; p:StatusKey; k:StatusKey }
  thresholds: { n:{min:number;max:number}; p:{min:number;max:number}; k:{min:number;max:number} }
  series: { n:number[]; p:number[]; k:number[] }
  times?: number[]
}) {
  const COLOR_N = "#22c55e" // green
  const COLOR_P = "#06b6d4" // cyan
  const COLOR_K = "#f59e0b" // amber

  const cardVariantLocal = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45 } }
  }

  // Compute trends for each nutrient
  const sN = series.n.slice(-48), sP = series.p.slice(-48), sK = series.k.slice(-48)
  const nT = computeTrend(sN, times ? times.slice(-48) : undefined)
  const pT = computeTrend(sP, times ? times.slice(-48) : undefined)
  const kT = computeTrend(sK, times ? times.slice(-48) : undefined)
  const arrow = (t:any) => t.trend && t.trend.toLowerCase().includes('rise') ? '↑' : t.trend && t.trend.toLowerCase().includes('fall') ? '↓' : '–'
  const pct = (s:number[], t:any) => s.length < 2 || !Number.isFinite(t.pct) ? '--' : `${t.pct >= 0 ? '+' : ''}${t.pct.toFixed(1)}%`

  return (
    <motion.section className="card card-live relative overflow-hidden"
      variants={cardVariantLocal}
      initial="hidden"
      animate="show"
    >
      <div className="card-shimmer" />
      <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
      <div className="absolute -bottom-14 -right-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />
      <div className="p-4 sm:p-5 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide opacity-85 text-gray-900 dark:text-gray-100">NPK (ppm)</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap"
                style={{ color: statusColor[status], borderColor: statusColor[status]+"55", background: statusColor[status]+"10" }}>
            {statusPhrase(status)}
          </span>
        </div>

        {/* Three metric chips in a clean row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <NPKChip label="N" color={COLOR_N} status={statuses.n}
                   val={data.n.avg}
                   th={thresholds.n}
                   trend={nT}
                   series={sN} />
          <NPKChip label="P" color={COLOR_P} status={statuses.p}
                   val={data.p.avg}
                   th={thresholds.p}
                   trend={pT}
                   series={sP} />
          <NPKChip label="K" color={COLOR_K} status={statuses.k}
                   val={data.k.avg}
                   th={thresholds.k}
                   trend={kT}
                   series={sK} />
        </div>

        {/* Trend summary - professional layout */}
        {/* Removed bottom NPK summary line per request */}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-12 sm:h-16 bg-gradient-to-t from-green-400/30 via-cyan-400/20 to-amber-400/0 pointer-events-none" />
    </motion.section>
  )
}

function NPKChip({
  label, color, status, val, th, trend, series
}:{
  label:"N"|"P"|"K"; color:string; status: StatusKey;
  val:number | null; th:{min:number;max:number}; trend?:any; series?:number[]
}) {
  const trendIndicator = trend && series && series.length > 1 
    ? trend.trend?.toLowerCase().includes('rise') ? '↑' : trend.trend?.toLowerCase().includes('fall') ? '↓' : '–'
    : '–'
  
  return (
    <motion.div className="rounded-lg border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] backdrop-blur-sm p-3 text-center transition-all">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0"
              style={{background: color+"33", color}}>
          {label}
        </span>
        <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap"
              style={{ color: statusColor[status], borderColor: statusColor[status]+"55", background: statusColor[status]+"10" }}>
          {statusPhrase(status)}
        </span>
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color }}>
        {Number.isFinite(val) ? Math.round(val as number) : '--'}
      </div>
      <div className="text-xs opacity-60 mt-1 text-gray-700 dark:text-gray-300">ppm</div>
      <div className="text-xs opacity-50 mt-2 text-center mb-2 text-gray-600 dark:text-gray-400">Range: {th.min}–{th.max}</div>
      <div className="text-xs font-medium text-center" style={{color}}>
        {trendIndicator} {trendIndicator === '↑' ? 'Going up' : trendIndicator === '↓' ? 'Going down' : 'Holding steady'}
      </div>
    </motion.div>
  )
}

/* --------------------- Auto-sizing sparklines (mobile) --------------------- */

function AutoSparkline({ data, color, times, unit }:{ data:number[]; color:string; times?: number[]; unit?: string }) {
  const ref = React.useRef<HTMLDivElement|null>(null)
  const [size, setSize] = React.useState({ w: 360, h: 64 })
  const [hoverIndex, setHoverIndex] = React.useState<number|null>(null)
  const [hoverX, setHoverX] = React.useState<number|null>(null)
  React.useEffect(() => {
    const update = () => {
      const w = Math.max(200, Math.min(520, ref.current?.clientWidth || 360))
      const h = w < 280 ? 56 : w < 400 ? 64 : 72
      setSize({ w, h })
    }
    update()
    const ro = new ResizeObserver(update)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const PAD = 6
  const { w:W, h:H } = size
  if (!data.length) return <div ref={ref} className="h-14 sm:h-16 md:h-[72px]" />

  const last = data.slice(-48)
  const lo = min(last), hi = max(last)
  const y = (v:number) => H - PAD - ((v-lo)/(hi-lo||1))*(H - PAD*2)
  const step = (W - PAD*2) / Math.max(1, last.length-1)
  const d = `M ${PAD},${y(last[0])} ` + last.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${y(v)}`).join(" ")
  const area = `M ${PAD},${H-PAD} L ${PAD},${y(last[0])} ` + last.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${y(v)}`).join(" ") + ` L ${PAD+(last.length-1)*step},${H-PAD} Z`

  // unique gradient id per color string (safe enough)
  const gradId = `sg1-${color.replace('#','')}`

  const clampIndex = (i:number) => Math.max(0, Math.min(last.length - 1, i))
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
    <div ref={ref} className="w-full min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="mini trend" className="max-w-full"
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <g opacity=".16" stroke="currentColor">
          <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} />
          <line x1={PAD} y1={H/2} x2={W-PAD} y2={H/2} />
        </g>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <g>
          <circle cx={PAD+(last.length-1)*step} cy={y(last.at(-1) as number)} r="3" fill={color} />
          <circle cx={PAD+(last.length-1)*step} cy={y(last.at(-1) as number)} r="3" fill={color} className="animate-pulse-slow" style={{ opacity: 0.28 }} />
        </g>
        {hoverIndex !== null && hoverX !== null && last[hoverIndex] !== undefined && (
          <g>
            <line x1={hoverX} x2={hoverX} y1={PAD} y2={H-PAD} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            <circle cx={hoverX} cy={y(last[hoverIndex])} r={3.6} fill={color} />
            {/* tooltip small */}
            {(() => {
              const val = last[hoverIndex]
              const ts = times && times.slice(-48)[hoverIndex]
              const txt = `${formatValue(val, unit)}`
              const timeStr = ts ? new Date(ts).toLocaleTimeString() : ''
              const tx = Math.max(PAD + 4, Math.min(W - PAD - 90, (hoverX ?? PAD) - 45))
              const ty = Math.max(12, y(val) - 30)
              return (
                <g transform={`translate(${tx}, ${ty})`}>
                  <rect x={0} y={-12} rx={6} ry={6} width={92} height={28} fill="#111827" opacity={0.9} />
                  <text x={6} y={2} fontSize={11} fill="#fff">{txt}</text>
                  {timeStr && <text x={6} y={16} fontSize={10} fill="#d1d5db">{timeStr}</text>}
                </g>
              )
            })()}
          </g>
        )}
      </svg>
    </div>
  )
}

function AutoSparklineMulti({ series, times, unit }:{ series:{data:number[]; color:string}[]; times?: number[]; unit?: string }) {
  const ref = React.useRef<HTMLDivElement|null>(null)
  const [size, setSize] = React.useState({ w: 360, h: 64 })
  const [hoverIndex, setHoverIndex] = React.useState<number|null>(null)
  const [hoverX, setHoverX] = React.useState<number|null>(null)
  React.useEffect(() => {
    const update = () => {
      const w = Math.max(200, Math.min(520, ref.current?.clientWidth || 360))
      const h = w < 280 ? 56 : w < 400 ? 64 : 72
      setSize({ w, h })
    }
    update()
    const ro = new ResizeObserver(update)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const PAD = 6
  const { w:W, h:H } = size
  const any = series.find(s=>s.data.length)
  if (!any) return <div ref={ref} className="h-14 sm:h-16 md:h-[72px]" />

  const sliced = series.map(s => s.data.slice(-48))
  const flat = sliced.flat()
  const lo = min(flat), hi = max(flat)
  const y = (v:number) => H - PAD - ((v-lo)/(hi-lo||1))*(H - PAD*2)
  const step = (W - PAD*2) / Math.max(1, (sliced[0]?.length || 1)-1)

  const clampIndex = (i:number) => Math.max(0, Math.min(sliced[0].length - 1, i))
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
    <div ref={ref} className="w-full min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="NPK trends" className="max-w-full"
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <g opacity=".12" stroke="currentColor">
          <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} />
          <line x1={PAD} y1={H/2} x2={W-PAD} y2={H/2} />
        </g>
        {sliced.map((arr, idx) => {
          if (!arr.length) return null
          const d = `M ${PAD},${y(arr[0])} ` + arr.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${y(v)}`).join(" ")
          return (
            <path key={idx} d={d} fill="none" stroke={series[idx].color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.95" />
          )
        })}
        {sliced.map((arr, idx) =>
          arr.length ? <circle key={"c"+idx} cx={PAD+(arr.length-1)*step} cy={y(arr.at(-1) as number)} r="2.8" fill={series[idx].color} /> : null
        )}
        {hoverIndex !== null && hoverX !== null && (
          <g>
            <line x1={hoverX} x2={hoverX} y1={PAD} y2={H-PAD} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
            {sliced.map((arr, idx) => arr.length ? <circle key={'hc'+idx} cx={PAD+hoverIndex*step} cy={y(arr[hoverIndex])} r={3.6} fill={series[idx].color} /> : null)}
            {/* tooltip with values */}
            {(() => {
              const ts = times && times.slice(-48)[hoverIndex]
              const timeStr = ts ? new Date(ts).toLocaleString() : ''
              const vals = sliced.map((arr, idx) => ({ color: series[idx].color, v: arr[hoverIndex] }))
              const tx = Math.max(PAD + 4, Math.min(W - PAD - 140, (hoverX ?? PAD) - 70))
              const ty = Math.max(12, PAD)
              return (
                <g transform={`translate(${tx}, ${ty})`}>
                  <rect x={0} y={0} rx={8} ry={8} width={140} height={28 + vals.length*14} fill="#111827" opacity={0.95} />
                  <text x={8} y={14} fontSize={11} fill="#d1d5db">{timeStr}</text>
                  {vals.map((it, i) => <text key={i} x={8} y={30 + i*14} fontSize={12} fill={it.color}>{`${it.v !== undefined ? it.v : '--'}`}</text>)}
                </g>
              )
            })()}
          </g>
        )}
      </svg>
    </div>
  )
}
