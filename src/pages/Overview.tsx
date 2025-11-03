import React from "react"
import { Link } from "react-router-dom"

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

type StatusKey = "ok" | "warn" | "alert"
const statusColor: Record<StatusKey, string> = {
  ok: "#10b981",   // emerald
  warn: "#f59e0b", // amber
  alert: "#ef4444" // red
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

const seriesWindow = 96 // ~24h if every 15min
const append = (arr:number[], v:number) => [...arr.slice(-(seriesWindow-1)), v]

const sFor = (v:number, lo:number, hi:number): StatusKey => {
  if (v < lo*0.95 || v > hi*1.05) return "alert"
  if (v < lo || v > hi) return "warn"
  return "ok"
}

/* ------------------------ Simulated live store ------------------------ */
function useLiveSeries() {
  const [temp, setTemp]   = React.useState<number[]>([])
  const [moist, setMoist] = React.useState<number[]>([])
  const [n, setN]         = React.useState<number[]>([])
  const [p, setP]         = React.useState<number[]>([])
  const [k, setK]         = React.useState<number[]>([])

  React.useEffect(() => {
    let alive = true
    const seedOnce = () => {
      if (temp.length) return
      const t:number[] = [], m:number[] = []
      const ns:number[] = [], ps:number[] = [], ks:number[] = []
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
      setTemp(t); setMoist(m); setN(ns); setP(ps); setK(ks)
    }
    seedOnce()
    const id = setInterval(() => {
      if (!alive) return
      const t = clamp((temp.at(-1) ?? 48) + (Math.random()-0.5)*1.0, 25, 70)
      const m = clamp((moist.at(-1) ?? 62) + (Math.random()-0.5)*1.2, 30, 90)
      const nv = clamp((n.at(-1) ?? 120) + (Math.random()-0.5)*6, 30, 260)
      const pv = clamp((p.at(-1) ?? 55)  + (Math.random()-0.5)*4, 10, 150)
      const kv = clamp((k.at(-1) ?? 130) + (Math.random()-0.5)*6, 30, 260)
      setTemp(prev => append(prev, Number(t.toFixed(1))))
      setMoist(prev => append(prev, Number(m.toFixed(1))))
      setN(prev => append(prev, Math.round(nv)))
      setP(prev => append(prev, Math.round(pv)))
      setK(prev => append(prev, Math.round(kv)))
    }, 9000)
    return () => { alive=false; clearInterval(id) }
  }, []) // eslint-disable-line

  return { temp, moist, n, p, k }
}

/* ------------------------------ Component ------------------------------ */

export default function Overview() {
  // thresholds (from Settings, with NPK-safe fallback)
  const thresholds: Thresholds = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(THRESHOLDS_KEY)
      if (raw) {
        const t = JSON.parse(raw)
        return {
          temperature: { min: Number(t?.temperature?.min ?? 15), max: Number(t?.temperature?.max ?? 65) },
          moisture:    { min: Number(t?.moisture?.min ?? 40),     max: Number(t?.moisture?.max ?? 80) },
          npk: {
            n: { min: Number(t?.npk?.n?.min ?? 50),  max: Number(t?.npk?.n?.max ?? 200) },
            p: { min: Number(t?.npk?.p?.min ?? 20),  max: Number(t?.npk?.p?.max ?? 100) },
            k: { min: Number(t?.npk?.k?.min ?? 50),  max: Number(t?.npk?.k?.max ?? 200) },
          },
        }
      }
    } catch {}
    return {
      temperature: { min: 15, max: 65 },
      moisture:    { min: 40, max: 80 },
      npk: { n:{min:50,max:200}, p:{min:20,max:100}, k:{min:50,max:200} }
    }
  }, [])

  // live series (mock for now)
  const { temp, moist, n, p, k } = useLiveSeries()

  // summary
  const summary = {
    temp:  { avg: avg(temp),  min: min(temp),  max: max(temp)  },
    moist: { avg: avg(moist), min: min(moist), max: max(moist) },
    npk: {
      n: { avg: avg(n), min: min(n), max: max(n) },
      p: { avg: avg(p), min: min(p), max: max(p) },
      k: { avg: avg(k), min: min(k), max: max(k) },
    },
  }

  // status
  const sTemp  = sFor(summary.temp.avg,  thresholds.temperature.min, thresholds.temperature.max)
  const sMoist = sFor(summary.moist.avg, thresholds.moisture.min,     thresholds.moisture.max)
  const sN     = sFor(summary.npk.n.avg, thresholds.npk.n.min,        thresholds.npk.n.max)
  const sP     = sFor(summary.npk.p.avg, thresholds.npk.p.min,        thresholds.npk.p.max)
  const sK     = sFor(summary.npk.k.avg, thresholds.npk.k.min,        thresholds.npk.k.max)

  const npkWorst: StatusKey =
    (["alert","warn","ok"] as StatusKey[]).find(k => [sN,sP,sK].includes(k)) || "ok"

  const healthRank: StatusKey =
    (["alert","warn","ok"] as StatusKey[]).find(k => [sTemp, sMoist, npkWorst].includes(k)) || "ok"

  // alerts
  const alerts: Array<{ id:string; level:StatusKey; msg:string }> = []
  if (sTemp  !== "ok") alerts.push({ id:"t", level:sTemp,  msg: sTemp==="warn" ? "Temperature nearing threshold" : "Temperature out of range" })
  if (sMoist !== "ok") alerts.push({ id:"m", level:sMoist, msg: sMoist==="warn" ? "Moisture nearing threshold"     : "Moisture out of range" })
  if (sN     !== "ok") alerts.push({ id:"n", level:sN,     msg: sN==="warn" ? "Nitrogen nearing threshold"          : "Nitrogen out of range" })
  if (sP     !== "ok") alerts.push({ id:"p", level:sP,     msg: sP==="warn" ? "Phosphorus nearing threshold"        : "Phosphorus out of range" })
  if (sK     !== "ok") alerts.push({ id:"k", level:sK,     msg: sK==="warn" ? "Potassium nearing threshold"         : "Potassium out of range" })

  // rotating tips
  const tips = [
    "Opt for a moist, wrung-out sponge feel—too wet limits air flow.",
    "Shred cardboard (carbon) to balance kitchen scraps (nitrogen).",
    "Turn or lift bedding weekly to prevent anaerobic pockets.",
    "Keep nutrients balanced; excess salts can stress the bin.",
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
      <section className="card card-live relative p-4 md:p-6 overflow-hidden">
        <div className="card-shimmer" />
        <div className="corner-glow top-[-3rem] right-[-3rem]" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base md:text-lg font-semibold">Overview</h1>
            <p className="text-sm text-gray-700 dark:text-gray-200">Real-time health, trends, and alerts.</p>
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

      {/* Summaries + Alerts (mobile-first grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Summaries */}
        <section className="lg:col-span-8 space-y-4">
          <SummaryRow
            title="Temperature"
            unit="°C"
            data={summary.temp}
            status={sTemp}
            gradient="from-emerald-400/35 via-emerald-400/10 to-emerald-400/0"
            sparkColor="#10b981"
            series={temp}
          />
          <SummaryRow
            title="Moisture"
            unit="%"
            data={summary.moist}
            status={sMoist}
            gradient="from-sky-400/35 via-sky-400/10 to-sky-400/0"
            sparkColor="#38bdf8"
            series={moist}
          />

          {/* NPK card: colored! */}
          <NPKRow
            data={summary.npk}
            status={npkWorst}
            statuses={{ n:sN, p:sP, k:sK }}
            thresholds={thresholds.npk}
            series={{ n, p, k }}
          />
        </section>

        {/* Alerts & Tips */}
        <section className="lg:col-span-4 card card-live relative p-4 md:p-6 overflow-hidden">
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
            <div className="mt-2 text-xs flex flex-wrap gap-4 opacity-80">
              <Link to="/about" className="hover:underline">Learn more</Link>
              <a href="https://youtu.be/08GQGQ8U-vI" target="_blank" rel="noreferrer" className="hover:underline">
                Quick video guide
              </a>
            </div>
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
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
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
          <div className="w-full md:max-w-[440px]">
            <AutoSparkline color={sparkColor} data={series} />
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

/* NPK card (three metrics, colored + mobile friendly) */
function NPKRow({
  data,
  status,
  statuses,
  thresholds,
  series
}:{
  data: { n:{avg:number;min:number;max:number}; p:{avg:number;min:number;max:number}; k:{avg:number;min:number;max:number} }
  status: StatusKey
  statuses: { n:StatusKey; p:StatusKey; k:StatusKey }
  thresholds: { n:{min:number;max:number}; p:{min:number;max:number}; k:{min:number;max:number} }
  series: { n:number[]; p:number[]; k:number[] }
}) {
  const COLOR_N = "#22c55e" // green
  const COLOR_P = "#06b6d4" // cyan
  const COLOR_K = "#f59e0b" // amber

  return (
    <section className="card card-live relative overflow-hidden">
      <div className="card-shimmer" />
      <div className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="w-full">
            <div className="flex items-center gap-2">
              <h3 className="text-sm md:text-base font-semibold">NPK (ppm)</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                    style={{ color: statusColor[status], borderColor: statusColor[status]+"55", background: statusColor[status]+"10" }}>
                {status === "ok" ? "OK" : status === "warn" ? "Watch" : "Alert"}
              </span>
            </div>

            {/* chips */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <NPKChip label="N" color={COLOR_N} status={statuses.n}
                       val={data.n.avg} minV={data.n.min} maxV={data.n.max}
                       th={thresholds.n} />
              <NPKChip label="P" color={COLOR_P} status={statuses.p}
                       val={data.p.avg} minV={data.p.min} maxV={data.p.max}
                       th={thresholds.p} />
              <NPKChip label="K" color={COLOR_K} status={statuses.k}
                       val={data.k.avg} minV={data.k.min} maxV={data.k.max}
                       th={thresholds.k} />
            </div>
          </div>

          {/* multi sparkline */}
          <div className="w-full md:max-w-[440px]">
            <AutoSparklineMulti
              series={[
                { data: series.n, color: COLOR_N },
                { data: series.p, color: COLOR_P },
                { data: series.k, color: COLOR_K },
              ]}
            />
          </div>
        </div>
      </div>

      {/* colored gradient band (so NPK “has color” like the others) */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-green-400/30 via-cyan-400/20 to-amber-400/0 pointer-events-none" />
    </section>
  )
}

function NPKChip({
  label, color, status, val, minV, maxV, th
}:{
  label:"N"|"P"|"K"; color:string; status: StatusKey;
  val:number; minV:number; maxV:number; th:{min:number;max:number}
}) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] dark:border-white/10 p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
              style={{background: color+"22", color}}>
          {label}
        </span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border"
              style={{ color: statusColor[status], borderColor: statusColor[status]+"55", background: statusColor[status]+"10" }}>
          {status === "ok" ? "OK" : status === "warn" ? "Watch" : "Alert"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
        <KV label="Avg" value={`${val.toFixed(0)}`} />
        <KV label="Min" value={`${minV.toFixed(0)}`} />
        <KV label="Max" value={`${maxV.toFixed(0)}`} />
      </div>
      <div className="mt-2 text-[11px] opacity-70">Range: {th.min}–{th.max} ppm</div>
    </div>
  )
}

/* --------------------- Auto-sizing sparklines (mobile) --------------------- */

function AutoSparkline({ data, color }:{ data:number[]; color:string }) {
  const ref = React.useRef<HTMLDivElement|null>(null)
  const [size, setSize] = React.useState({ w: 360, h: 72 })
  React.useEffect(() => {
    const update = () => {
      const w = Math.max(240, Math.min(520, ref.current?.clientWidth || 360))
      const h = w < 320 ? 64 : 72
      setSize({ w, h })
    }
    update()
    const ro = new ResizeObserver(update)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const PAD = 8
  const { w:W, h:H } = size
  if (!data.length) return <div ref={ref} className="h-[72px]" />

  const last = data.slice(-48)
  const lo = min(last), hi = max(last)
  const y = (v:number) => H - PAD - ((v-lo)/(hi-lo||1))*(H - PAD*2)
  const step = (W - PAD*2) / Math.max(1, last.length-1)
  const d = `M ${PAD},${y(last[0])} ` + last.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${y(v)}`).join(" ")
  const area = `M ${PAD},${H-PAD} L ${PAD},${y(last[0])} ` + last.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${y(v)}`).join(" ") + ` L ${PAD+(last.length-1)*step},${H-PAD} Z`

  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="mini trend">
        <defs>
          <linearGradient id="sg1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <g opacity=".16" stroke="currentColor">
          <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} />
          <line x1={PAD} y1={H/2} x2={W-PAD} y2={H/2} />
        </g>
        <path d={area} fill="url(#sg1)" />
        <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={PAD+(last.length-1)*step} cy={y(last.at(-1) as number)} r="3.4" fill={color} />
      </svg>
    </div>
  )
}

function AutoSparklineMulti({ series }:{ series:{data:number[]; color:string}[] }) {
  const ref = React.useRef<HTMLDivElement|null>(null)
  const [size, setSize] = React.useState({ w: 360, h: 72 })
  React.useEffect(() => {
    const update = () => {
      const w = Math.max(240, Math.min(520, ref.current?.clientWidth || 360))
      const h = w < 320 ? 64 : 72
      setSize({ w, h })
    }
    update()
    const ro = new ResizeObserver(update)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const PAD = 8
  const { w:W, h:H } = size
  const any = series.find(s=>s.data.length)
  if (!any) return <div ref={ref} className="h-[72px]" />

  const sliced = series.map(s => s.data.slice(-48))
  const flat = sliced.flat()
  const lo = min(flat), hi = max(flat)
  const y = (v:number) => H - PAD - ((v-lo)/(hi-lo||1))*(H - PAD*2)
  const step = (W - PAD*2) / Math.max(1, (sliced[0]?.length || 1)-1)

  return (
    <div ref={ref} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="NPK trends">
        <g opacity=".12" stroke="currentColor">
          <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} />
          <line x1={PAD} y1={H/2} x2={W-PAD} y2={H/2} />
        </g>
        {sliced.map((arr, idx) => {
          if (!arr.length) return null
          const d = `M ${PAD},${y(arr[0])} ` + arr.slice(1).map((v,i)=>`L ${PAD+(i+1)*step},${y(v)}`).join(" ")
          return (
            <path key={idx} d={d} fill="none" stroke={series[idx].color} strokeWidth="2.0" strokeLinejoin="round" strokeLinecap="round" opacity="0.95" />
          )
        })}
        {sliced.map((arr, idx) =>
          arr.length ? <circle key={"c"+idx} cx={PAD+(arr.length-1)*step} cy={y(arr.at(-1) as number)} r="3.0" fill={series[idx].color} /> : null
        )}
      </svg>
    </div>
  )
}
