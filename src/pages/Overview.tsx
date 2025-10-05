import React from "react"
import { Link } from "react-router-dom"

/* --------------------------- Types & helpers --------------------------- */

type Thresholds = {
  temperature: { min: number; max: number }
  moisture: { min: number; max: number }
  ph: { min: number; max: number }
}

const THRESHOLDS_KEY = "tt_thresholds"

type StatusKey = "ok" | "warn" | "alert"
const statusColor: Record<StatusKey, string> = {
  ok: "#10b981",        // emerald
  warn: "#f59e0b",      // amber
  alert: "#ef4444",     // red
}
const statusDotClass: Record<StatusKey, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  alert: "bg-rose-500",
}

const clamp = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v))
const avg = (arr:number[]) => (arr.length ? Number((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1)) : 0)
const min = (arr:number[]) => (arr.length ? Math.min(...arr) : 0)
const max = (arr:number[]) => (arr.length ? Math.max(...arr) : 0)

const seriesWindow = 96; // ~24h if we sample every 15min
const append = (arr:number[], v:number) => [...arr.slice(-(seriesWindow-1)), v]

const sFor = (v:number, lo:number, hi:number): StatusKey => {
  if (v < lo*0.95 || v > hi*1.05) return "alert"   // hard breach + 5% buffer
  if (v < lo || v > hi)             return "warn"    // near breach
  return "ok"
}

/* ------------------------ Simulated live “store” ----------------------- */
/* Replace this block with your real reading source when ready. */
function useLiveSeries() {
  const [temp, setTemp]   = React.useState<number[]>([])
  const [moist, setMoist] = React.useState<number[]>([])
  const [ph, setPh]       = React.useState<number[]>([])

  React.useEffect(() => {
    let alive = true
    const seedOnce = () => {
      if (temp.length) return
      const t:number[] = [], m:number[] = [], p:number[] = []
      let tv=48, mv=62, pv=7.1
      for (let i=0;i<seriesWindow;i++){
        tv = clamp(tv + (Math.random()-0.5)*1.1, 25, 70)
        mv = clamp(mv + (Math.random()-0.5)*1.3, 30, 90)
        pv = clamp(Number((pv + (Math.random()-0.5)*0.05).toFixed(2)), 5.5, 8.8)
        t.push(Number(tv.toFixed(1))); m.push(Number(mv.toFixed(1))); p.push(Number(pv.toFixed(2)))
      }
      setTemp(t); setMoist(m); setPh(p)
    }
    seedOnce()
    const id = setInterval(() => {
      if (!alive) return
      const t = clamp((temp.at(-1) ?? 48) + (Math.random()-0.5)*1.0, 25, 70)
      const m = clamp((moist.at(-1) ?? 62) + (Math.random()-0.5)*1.2, 30, 90)
      const p = clamp(Number(((ph.at(-1) ?? 7.1) + (Math.random()-0.5)*0.05).toFixed(2)), 5.5, 8.8)
      setTemp(prev => append(prev, Number(t.toFixed(1))))
      setMoist(prev => append(prev, Number(m.toFixed(1))))
      setPh(prev => append(prev, Number(p.toFixed(2))))
    }, 9000)
    return () => { alive=false; clearInterval(id) }
  }, []) // eslint-disable-line

  return { temp, moist, ph }
}

/* ------------------------- Maintenance mini store ---------------------- */
const M_KEYS = {
  water: "tt_last_water",
  feed: "tt_last_feed",
  turn: "tt_last_turn",
}
const now = () => new Date().getTime()
const agoStr = (ts:number|null) => {
  if (!ts) return "—"
  const diff = Math.max(0, now() - ts)
  const d = Math.floor(diff / (24*3600e3))
  const h = Math.floor((diff % (24*3600e3)) / 3600e3)
  if (d > 0) return `${d}d ${h}h ago`
  const m = Math.floor((diff % 3600e3) / 60000)
  if (h > 0) return `${h}h ${m}m ago`
  const s = Math.floor((diff % 60000) / 1000)
  return `${m}m ${s}s ago`
}

/* ------------------------------ Component ------------------------------ */

export default function Overview() {
  // thresholds (from Settings)
  const thresholds: Thresholds = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(THRESHOLDS_KEY)
      if (raw) {
        const t = JSON.parse(raw)
        return {
          temperature: { min: Number(t?.temperature?.min ?? 15), max: Number(t?.temperature?.max ?? 65) },
          moisture:     { min: Number(t?.moisture?.min ?? 40),     max: Number(t?.moisture?.max ?? 80) },
          ph:           { min: Number(t?.ph?.min ?? 6),            max: Number(t?.ph?.max ?? 8)  },
        }
      }
    } catch{}
    return { temperature: { min: 15, max: 65 }, moisture: { min: 40, max: 80 }, ph: { min: 6, max: 8 } }
  }, [])

  // live series (mock for now)
  const { temp, moist, ph } = useLiveSeries()

  // summary
  const summary = {
    temp:  { avg: avg(temp),  min: min(temp),  max: max(temp)  },
    moist: { avg: avg(moist), min: min(moist), max: max(moist) },
    ph:    { avg: avg(ph),    min: min(ph),    max: max(ph)    },
  }

  // status
  const sTemp  = sFor(summary.temp.avg,  thresholds.temperature.min, thresholds.temperature.max)
  const sMoist = sFor(summary.moist.avg, thresholds.moisture.min,     thresholds.moisture.max)
  const sPh    = sFor(summary.ph.avg,    thresholds.ph.min,            thresholds.ph.max)

  // overall health (worst wins)
  const healthRank: StatusKey = (["alert","warn","ok"] as StatusKey[]).find(
    k => [sTemp, sMoist, sPh].includes(k)
  ) || "ok"

  // alerts
  const alerts: Array<{ id:string; level:StatusKey; msg:string }> = []
  if (sTemp  !== "ok")  alerts.push({ id:"t",  level:sTemp,  msg: sTemp==="warn" ? "Temperature nearing threshold" : "Temperature out of range" })
  if (sMoist !== "ok")  alerts.push({ id:"m",  level:sMoist, msg: sMoist==="warn" ? "Moisture nearing threshold"     : "Moisture out of range" })
  if (sPh    !== "ok")  alerts.push({ id:"p",  level:sPh,    msg: sPh==="warn" ? "pH nearing threshold"              : "pH out of range" })

  // maintenance timestamps
  const [lastWater, setLastWater] = React.useState<number|null>(() => Number(localStorage.getItem(M_KEYS.water)) || null)
  const [lastFeed,  setLastFeed ] = React.useState<number|null>(() => Number(localStorage.getItem(M_KEYS.feed )) || null)
  const [lastTurn,  setLastTurn ] = React.useState<number|null>(() => Number(localStorage.getItem(M_KEYS.turn )) || null)

  const logAction = (key: keyof typeof M_KEYS) => {
    const ts = now()
    localStorage.setItem(M_KEYS[key], String(ts))
    if (key==="water") setLastWater(ts)
    if (key==="feed")  setLastFeed(ts)
    if (key==="turn")  setLastTurn(ts)
  }

  // reminders (simple heuristics)
  const due = {
    water: (lastWater ? now()-lastWater : Infinity) > 2*24*3600e3, // > 2 days
    feed:  (lastFeed  ? now()-lastFeed  : Infinity) > 7*24*3600e3, // > 7 days
    turn:  (lastTurn  ? now()-lastTurn  : Infinity) > 3*24*3600e3, // > 3 days
  }

  // export (simple JSON)
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ temp, moist, ph, thresholds, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `terratak-readings-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  // rotating tips
  const tips = [
    "Opt for a moist, wrung-out sponge feel—too wet limits air flow.",
    "Shred cardboard or paper for carbon; balance with kitchen scraps (nitrogen).",
    "Turn or lift bedding weekly to prevent anaerobic pockets.",
    "Keep pH around 6.5–7.5; add crushed eggshells for buffering.",
    "Small, frequent feedings reduce odor and heating spikes.",
  ]
  const [tipIdx, setTipIdx] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(()=> setTipIdx(i => (i+1) % tips.length), 8000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header / Health */}
      <section className="card card-live relative p-5 md:p-6 overflow-hidden">
        <div className="card-shimmer" />
        <div className="corner-glow top-[-3rem] right-[-3rem]" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base md:text-lg font-semibold">Overview</h1>
            <p className="text-sm text-gray-700 dark:text-gray-200">Real-time health, trends, maintenance, and quick actions.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-80">Overall health</span>
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: statusColor[healthRank] + "22", color: statusColor[healthRank], border: `1px solid ${statusColor[healthRank]}44` }}
            >
              {healthRank === "ok" ? "Good" : healthRank === "warn" ? "Watch" : "Attention"}
            </span>
          </div>
        </div>
      </section>

      {/* Summaries + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Summaries */}
        <section className="xl:col-span-8 space-y-4">
          <SummaryRow
            title="Temperature"
            unit="°C"
            data={summary.temp}
            status={sTemp}
            gradient="from-emerald-400/35 to-emerald-400/0"
            sparkColor="#10b981"
            series={temp}
          />
          <SummaryRow
            title="Moisture"
            unit="%"
            data={summary.moist}
            status={sMoist}
            gradient="from-sky-400/35 to-sky-400/0"
            sparkColor="#38bdf8"
            series={moist}
          />
          <SummaryRow
            title="pH"
            unit=""
            data={summary.ph}
            status={sPh}
            gradient="from-amber-400/40 to-amber-400/0"
            sparkColor="#f59e0b"
            series={ph}
          />
        </section>

        {/* Alerts & Tips */}
        <section className="xl:col-span-4 card card-live relative p-5 md:p-6 overflow-hidden">
          <div className="card-shimmer" />
          <div className="corner-glow bottom-[-3rem] left-[-3rem]" />
          <h3 className="text-sm md:text-base font-semibold">Active alerts</h3>
          <div className="mt-3 space-y-2">
            {alerts.length === 0 && (
              <div className="rounded-lg border border-[hsl(var(--border))] dark:border-white/10 px-3 py-2 text-sm opacity-80">
                No active alerts. All parameters are within range.
              </div>
            )}
            {alerts.map(a => (
              <div key={a.id} className="rounded-lg border px-3 py-2 text-sm flex items-center gap-2"
                   style={{ borderColor: statusColor[a.level]+"55", background: statusColor[a.level]+"10", color: statusColor[a.level] }}>
                <span className={"w-2 h-2 rounded-full "+statusDotClass[a.level]} />
                <span className="font-medium">{a.msg}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-[hsl(var(--border))] dark:border-white/10 pt-4">
            <h4 className="text-sm font-semibold">Vermicomposting tip</h4>
            <p className="text-sm text-gray-700 dark:text-gray-200 mt-1 transition-opacity duration-300">
              {tips[tipIdx]}
            </p>
            <div className="mt-2 text-xs flex gap-4 opacity-80">
              <Link to="/about" className="hover:underline">Learn more</Link>
              <a href="https://youtu.be/08GQGQ8U-vI" target="_blank" rel="noreferrer" className="hover:underline">
                Quick video guide
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* Maintenance / Actions */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Maintenance */}
        <section className="xl:col-span-8 card card-live relative p-5 md:p-6 overflow-hidden">
          <div className="card-shimmer" />
          <div className="corner-glow top-[-3rem] left-[-3rem]" />
          <h3 className="text-sm md:text-base font-semibold">Bin maintenance status</h3>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <MaintItem label="Last watered" ago={agoStr(lastWater)} due={due.water} onLog={() => logAction("water")} />
            <MaintItem label="Last fed"      ago={agoStr(lastFeed)}  due={due.feed}  onLog={() => logAction("feed")} />
            <MaintItem label="Last turned"   ago={agoStr(lastTurn)}  due={due.turn}  onLog={() => logAction("turn")} />
          </div>

          <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] dark:border-white/15 px-3 py-2 text-xs opacity-80">
            Reminders are heuristics only. Adjust the cadence to match your bin’s volume, feedstock, and climate.
          </div>
        </section>

        {/* Actions */}
        <section className="xl:col-span-4 card card-live relative p-5 md:p-6 overflow-hidden">
          <div className="card-shimmer" />
          <div className="corner-glow bottom-[-3rem] right-[-3rem]" />
          <h3 className="text-sm md:text-base font-semibold">Quick actions</h3>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button onClick={()=>logAction("water")} className="action-btn">Log watering</button>
            <button onClick={()=>logAction("feed")}  className="action-btn">Log feeding</button>
            <button onClick={()=>logAction("turn")}  className="action-btn">Log remix/turn</button>
            <Link to="/settings" className="action-btn grid place-items-center">Sensor calibration</Link>
            <button onClick={exportData} className="col-span-2 action-btn">Export data (.json)</button>
          </div>
        </section>
      </div>
    </div>
  )
}

/* ------------------------------ Bits & UI ------------------------------ */

function SummaryRow({
  title, unit, data, status, gradient, sparkColor, series
}:{
  title: string
  unit: string
  data: { avg:number; min:number; max:number }
  status: StatusKey
  gradient: string
  sparkColor: string
  series: number[]
}) {
  return (
    <section className="card card-live relative overflow-hidden">
      <div className="card-shimmer" />
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm md:text-base font-semibold">{title}</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                    style={{ color: statusColor[status], borderColor: statusColor[status]+"55", background: statusColor[status]+"10" }}>
                {status === "ok" ? "OK" : status === "warn" ? "Watch" : "Alert"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <KV label="Avg" value={`${data.avg.toFixed(1)}${unit}`} />
              <KV label="Min" value={`${data.min.toFixed(1)}${unit}`} />
              <KV label="Max" value={`${data.max.toFixed(1)}${unit}`} />
            </div>
          </div>
          <div className="w-full max-w-[320px] md:max-w-[420px]">
            <SparklineMini color={sparkColor} data={series} />
          </div>
        </div>
      </div>
      <div className={`absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t ${gradient} pointer-events-none`} />
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

function MaintItem({ label, ago, due, onLog }:{ label:string; ago:string; due:boolean; onLog:()=>void }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] dark:border-white/10 p-3">
      <div className="text-xs opacity-70">{label}</div>
      <div className="mt-1 font-semibold">{ago}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className={"text-xs px-2 py-0.5 rounded-full border " + (due
          ? "border-amber-400/40 text-amber-500 bg-amber-400/10"
          : "border-emerald-400/40 text-emerald-500 bg-emerald-400/10"
        )}>
          {due ? "Due soon" : "Up to date"}
        </span>
        <button onClick={onLog} className="text-xs px-2.5 py-1 rounded-lg border border-[hsl(var(--border))] dark:border-white/15 hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.06] transition">
          Log now
        </button>
      </div>
    </div>
  )
}

/* tiny, responsive sparkline */
function SparklineMini({ data, color }:{ data:number[]; color:string }) {
  const PAD = 8
  const W = 420, H = 72
  if (!data.length) return <div className="h-[72px]" />

  const last = data.slice(-48) // most recent window
  const lo = min(last), hi = max(last)
  const y = (v:number) => H - PAD - ( (v-lo)/(hi-lo||1) )*(H - PAD*2)
  const step = (W - PAD*2) / Math.max(1, last.length-1)
  const d = `M ${PAD},${y(last[0])} ` + last.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${y(v)}`).join(" ")
  const area = `M ${PAD},${H-PAD} L ${PAD},${y(last[0])} ` + last.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${y(v)}`).join(" ") + ` L ${PAD+(last.length-1)*step},${H-PAD} Z`

  return (
    <svg className="w-full" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="mini trend">
      <defs>
        <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <g opacity=".16" stroke="currentColor">
        <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} />
        <line x1={PAD} y1={(H/2)} x2={W-PAD} y2={(H/2)} />
      </g>
      <path d={area} fill="url(#sg)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={PAD+(last.length-1)*step} cy={y(last.at(-1) as number)} r="3.6" fill={color} />
    </svg>
  )
}
