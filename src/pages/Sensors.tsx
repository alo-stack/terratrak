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

/* ----------------------------- Config --------------------------------- */

// hard-code for now; later pass via props/state/route (e.g. "?dev=esp32-001")
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

const clamp = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v))
const avg = (arr:number[]) => (arr.length ? Number((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1)) : 0)
const colorFor = (s:Status) => (s==="ok" ? "#10b981" : s==="low" ? "#38bdf8" : "#f59e0b")
const statusFor = (v:number, min:number, max:number):Status => (v<min ? "low" : v>max ? "high" : "ok")

/** Internal defaults (can be moved to Settings later) */
const RANGES = {
  temp:   { min: 15, max: 65 },
  moist:  { min: 40, max: 80 },
  n:      { min: 150, max: 900 },
  p:      { min: 50,  max: 300 },
  k:      { min: 100, max: 800 },
}

/** Time windows (ms) */
const WINDOWS: Record<RangeKey, number> = {
  live:  30 * 60 * 1000,
  "1h":  60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d":  7  * 24 * 60 * 60 * 1000,
}

/* ---------------------- Firestore history hook ------------------------ */
/** Streams historical samples from sensor_readings/{deviceId}/readings. Falls back to SIM until live arrives. */
function useSensorHistory(range: RangeKey, deviceId = DEVICE_ID) {
  const [samples, setSamples] = React.useState<Sample[]>([])
  const [mode, setMode] = React.useState<"firebase"|"sim">("sim")

  React.useEffect(() => {
    let simTimer: number | undefined
    const MAX = 5000
    const cutoffDate = new Date(Date.now() - WINDOWS[range])

    // seed & tick SIM until we see valid Firestore data
    const startSim = () => {
      if (simTimer) return
      const now = Date.now()
      let temp = 48, moist = 62, n = 420, p = 140, k = 380
      const seeded: Sample[] = []
      for (let i=300; i>0; i--) {
        temp = clamp(temp + (Math.random()-0.5)*1.0, 20, 70)
        moist = clamp(moist + (Math.random()-0.5)*1.2, 25, 90)
        n = clamp(n + (Math.random()-0.5)*18, RANGES.n.min/2, RANGES.n.max*1.2)
        p = clamp(p + (Math.random()-0.5)*6,  RANGES.p.min/2, RANGES.p.max*1.2)
        k = clamp(k + (Math.random()-0.5)*14, RANGES.k.min/2, RANGES.k.max*1.2)
        seeded.push({
          ts: now - i*12000,
          temp: +temp.toFixed(1),
          moist: +moist.toFixed(1),
          n: Math.round(n), p: Math.round(p), k: Math.round(k)
        })
      }
      setSamples(seeded)
      setMode("sim")
      simTimer = window.setInterval(() => {
        setSamples(s => {
          const last = s.at(-1) ?? { ts: Date.now(), temp:48, moist:62, n:420, p:140, k:380 }
          const next: Sample = {
            ts: Date.now(),
            temp:  +clamp(last.temp  + (Math.random()-0.5)*1.0, 20, 70).toFixed(1),
            moist: +clamp(last.moist + (Math.random()-0.5)*1.2, 25, 90).toFixed(1),
            n: Math.round(clamp(last.n + (Math.random()-0.5)*18, RANGES.n.min/2, RANGES.n.max*1.2)),
            p: Math.round(clamp(last.p + (Math.random()-0.5)*6,  RANGES.p.min/2, RANGES.p.max*1.2)),
            k: Math.round(clamp(last.k + (Math.random()-0.5)*14, RANGES.k.min/2, RANGES.k.max*1.2)),
          }
          return [...s.slice(-(MAX-1)), next]
        })
      }, 9000) as unknown as number
    }

    // 🔴 Query device subcollection: sensor_readings/{deviceId}/readings
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
        const rows: Sample[] = snap.docs.map(d => {
          const x = d.data() as any
          return {
            ts: x.updatedAt?.toMillis?.() ?? Date.now(),
            temp:  Number(x.tempC ?? x.temperature),
            moist: Number(x.moisturePct ?? x.moisture),
            n:     Number(x.npk?.n),
            p:     Number(x.npk?.p),
            k:     Number(x.npk?.k),
          }
        }).filter(r => [r.temp, r.moist, r.n, r.p, r.k].every(Number.isFinite))

        if (rows.length > 0) {
          sawValid = true
          setMode("firebase")
          setSamples(rows.slice(-MAX))
          if (simTimer) { window.clearInterval(simTimer); simTimer = undefined }
        } else if (!sawValid && !simTimer) {
          startSim()
        }
      },
      () => { if (!simTimer) startSim() }
    )

    // show SIM immediately until first live snapshot
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
  // range selector
  const [range, setRange] = React.useState<RangeKey>("live")
  const { samples, mode } = useSensorHistory(range, DEVICE_ID)

  const cutoff = Date.now() - WINDOWS[range]
  const windowed = React.useMemo(
    () => samples.filter(s => s.ts >= cutoff),
    [samples, cutoff]
  )

  // simple series for charts
  const series = React.useMemo(() => ({
    temp:  windowed.map(s => s.temp),
    moist: windowed.map(s => s.moist),
    n:     windowed.map(s => s.n),
    p:     windowed.map(s => s.p),
    k:     windowed.map(s => s.k),
  }), [windowed])

  // KPIs
  const kpi = React.useMemo(() => ({
    temp:  { avg: avg(series.temp) , min: Math.min(...series.temp,  Infinity) || 0, max: Math.max(...series.temp,  -Infinity) || 0 },
    moist: { avg: avg(series.moist), min: Math.min(...series.moist, Infinity) || 0, max: Math.max(...series.moist, -Infinity) || 0 },
    n:     { avg: Math.round(avg(series.n)), min: Math.min(...series.n, Infinity) || 0, max: Math.max(...series.n, -Infinity) || 0 },
    p:     { avg: Math.round(avg(series.p)), min: Math.min(...series.p, Infinity) || 0, max: Math.max(...series.p, -Infinity) || 0 },
    k:     { avg: Math.round(avg(series.k)), min: Math.min(...series.k, Infinity) || 0, max: Math.max(...series.k, -Infinity) || 0 },
  }), [series])

  const sTemp  = statusFor(kpi.temp.avg,  RANGES.temp.min,  RANGES.temp.max)
  const sMoist = statusFor(kpi.moist.avg, RANGES.moist.min, RANGES.moist.max)
  const sN     = statusFor(kpi.n.avg,     RANGES.n.min,     RANGES.n.max)
  const sP     = statusFor(kpi.p.avg,     RANGES.p.min,     RANGES.p.max)
  const sK     = statusFor(kpi.k.avg,     RANGES.k.min,     RANGES.k.max)

  // actionable insights
  const insights = React.useMemo(() => {
    const list: string[] = []
    if (sMoist === "low")  list.push("Moisture is trending low—consider watering lightly to reach 60–70%.")
    if (sMoist === "high") list.push("Moisture is high—add dry bedding and turn the bin to improve airflow.")
    if (sTemp === "high")  list.push("Temperature is elevated—mix the bedding and reduce feed volume.")
    if (sTemp === "low")   list.push("Temperature is low—insulate the bin and avoid over-watering.")
    const npkOkay = [sN,sP,sK].every(s => s === "ok")
    if (!npkOkay) list.push("NPK balance is off—add carbon for high N, or a light feed for low N/P/K.")
    if (list.length === 0) list.push("All parameters look healthy. Maintain current routine.")
    return list
  }, [sTemp, sMoist, sN, sP, sK])

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <section className="card card-live relative p-5 md:p-6 overflow-hidden">
        <div className="card-shimmer" />
        <div className="corner-glow top-[-3rem] right-[-3rem]" />
        <div className="flex items-center gap-2">
          <h2 className="text-base md:text-lg font-semibold">Sensors</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[hsl(var(--border))] dark:border-white/10 opacity-80">
            {mode === "firebase" ? "LIVE • Firebase" : "SIM"}
          </span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-200">
          Live + historical Temperature, Moisture, and NPK. Use the range switcher to view recent history.
        </p>
      </section>

      {/* Range switcher */}
      <section className="card card-live p-3 md:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <RangeButton label="Live" active={range==="live"} onClick={()=>setRange("live")} />
          <RangeButton label="1h"   active={range==="1h"}   onClick={()=>setRange("1h")} />
          <RangeButton label="24h"  active={range==="24h"}  onClick={()=>setRange("24h")} />
          <RangeButton label="7d"   active={range==="7d"}   onClick={()=>setRange("7d")} />
          <span className="ml-auto text-xs opacity-75">
            Window shows last {range==="live" ? "30 min" : range}.
          </span>
        </div>
      </section>

      {/* KPI cards */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <KpiCard title="Temperature" unit="°C" color={colorFor(sTemp)}  status={sTemp}  values={{ avg: kpi.temp.avg,  min: kpi.temp.min,  max: kpi.temp.max }} />
        <KpiCard title="Moisture"    unit="%"  color={colorFor(sMoist)} status={sMoist} values={{ avg: kpi.moist.avg, min: kpi.moist.min, max: kpi.moist.max }} />
        <NpkKpiCard n={kpi.n.avg} p={kpi.p.avg} k={kpi.k.avg} status={{ n: sN, p: sP, k: sK }} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4">
        <ChartCard title="Temperature" unit="°C" color="#10b981" data={series.temp}  bigValue={kpi.temp.avg} />
        <ChartCard title="Moisture"     unit="%"  color="#38bdf8" data={series.moist} bigValue={kpi.moist.avg} />
        <ChartCard
          title="NPK (mean)"
          unit=""
          color="#f59e0b"
          data={series.n.map((v,i) => Math.round((v + (series.p[i] ?? v) + (series.k[i] ?? v)) / 3))}
          bigValue={Math.round((kpi.n.avg + kpi.p.avg + kpi.k.avg)/3)}
        />
      </div>

      {/* Insights */}
      <section className="card card-live relative p-5 md:p-6 overflow-hidden">
        <div className="corner-glow bottom-[-3rem] left-[-3rem]" />
        <h3 className="text-sm md:text-base font-semibold">Actionable tips</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {insights.map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-[6px] inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/* ------------------------------ Bits & UI ------------------------------ */

function RangeButton({ label, active, onClick }:{ label:string; active:boolean; onClick:()=>void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-lg text-sm transition",
        active
          ? "border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--muted))] dark:bg-white/[0.06] font-medium"
          : "border border-transparent hover:border-[hsl(var(--border))] dark:hover:border-white/10"
      ].join(" ")}
    >
      {label}
    </button>
  )
}

function KpiCard({
  title, unit, color, status, values
}:{ title:string; unit:string; color:string; status: Status; values: { avg:number; min:number; max:number } }) {
  return (
    <section className="card card-live p-5 overflow-hidden">
      <div className="card-shimmer" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm md:text-base font-semibold">{title}</h4>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={{ color, borderColor: color+"55", background: color+"10" }}>
              {status === "ok" ? "OK" : status === "low" ? "Low" : "High"}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <KV label="Avg" value={`${values.avg.toFixed(1)}${unit}`} />
            <KV label="Min" value={`${values.min.toFixed(1)}${unit}`} />
            <KV label="Max" value={`${values.max.toFixed(1)}${unit}`} />
          </div>
        </div>
      </div>
    </section>
  )
}

function NpkKpiCard({ n, p, k, status }:{ n:number; p:number; k:number; status:{ n:Status; p:Status; k:Status } }) {
  const item = (label:string, v:number, s:Status) => (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: colorFor(s)+"55", background: colorFor(s)+"0F" }}>
      <div className="flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(s) }} />
        <span className="text-xs opacity-80">{label}</span>
      </div>
      <div className="font-semibold tabular-nums">{v}</div>
    </div>
  )
  return (
    <section className="card card-live p-5 overflow-hidden">
      <div className="card-shimmer" />
      <h4 className="text-sm md:text-base font-semibold">NPK</h4>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {item("N", n, status.n)}
        {item("P", p, status.p)}
        {item("K", k, status.k)}
      </div>
      <div className="mt-2 text-xs opacity-70">Units based on your NPK sensor (e.g., ppm / a.u.).</div>
    </section>
  )
}

function KV({ label, value }: { label:string; value:string }) {
  return (
    <div>
      <div className="text-xs opacity-70">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function ChartCard({ title, unit, color, data, bigValue }:{ title:string; unit:string; color:string; data:number[]; bigValue?:number }) {
  return (
    <section className="card card-live p-5 overflow-hidden animate-fade-in-up">
      <div className="card-shimmer" />
      <div className="corner-glow top-[-3rem] left-[-3rem]" />
      <div className="flex items-end justify-between">
        <h4 className="text-sm md:text-base font-semibold">{title}</h4>
        <div className="text-base md:text-lg font-semibold tabular-nums">
          {Number.isFinite(bigValue) ? `${bigValue!.toFixed(1)}${unit}` : "--"}
        </div>
      </div>
      <AutoChart data={data} stroke={color} />
    </section>
  )
}

/* tiny responsive line/area chart (no external libs) */
function AutoChart({ data, stroke }:{ data:number[]; stroke:string }) {
  const ref = React.useRef<HTMLDivElement|null>(null)
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
  const { w:W, h:H } = size
  const minV = Math.min(...(data.length ? data : [0]))
  const maxV = Math.max(...(data.length ? data : [1]))
  const lo = minV - (maxV-minV)*0.15
  const hi = maxV + (maxV-minV)*0.15 || 1
  const norm = (v:number) => (1 - (v - lo) / (hi - lo)) * (H - PAD*2) + PAD
  const step = (W - PAD*2) / Math.max(1, data.length - 1)

  const d = data.length
    ? `M ${PAD},${norm(data[0])} ` + data.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${norm(v)}`).join(" ")
    : ""
  const area = data.length
    ? `M ${PAD},${H-PAD} L ${PAD},${norm(data[0])} ` +
      data.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${norm(v)}`).join(" ") +
      ` L ${PAD+(data.length-1)*step},${H-PAD} Z`
    : ""

  return (
    <div ref={ref} className="w-full chart-enter">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        <defs>
          <linearGradient id="lineGradAuto" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.55" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <g opacity=".16" stroke="currentColor">
          <line x1={PAD} y1={PAD} x2={W-PAD} y2={PAD} />
          <line x1={PAD} y1={H/2} x2={W-PAD} y2={H/2} />
          <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} />
        </g>
        {data.length > 1 && <path d={area} fill="url(#lineGradAuto)" />}
        {data.length > 1 && <path d={d} fill="none" stroke={stroke} strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />}
        {data.length > 0 && <circle cx={PAD+(data.length-1)*step} cy={norm(data[data.length-1])} r="3.8" fill={stroke} />}
      </svg>
    </div>
  )
}
