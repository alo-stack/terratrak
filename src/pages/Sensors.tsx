import React from "react"

/* ---------- Types ---------- */
type Readings = { temp: number; moist: number; ph: number }
type QuadKey = "A" | "B" | "C" | "D"

type Thresholds = {
  temperature: { min: number; max: number }
  moisture: { min: number; max: number }
  ph: { min: number; max: number }
}

const THRESHOLDS_KEY = "tt_thresholds"
const clamp = (v:number, lo:number, hi:number) => Math.max(lo, Math.min(hi, v))
const toNum = (v:any, d:number) => (Number.isFinite(Number(v)) ? Number(v) : d)

/* status helpers */
const statusFor = (v:number, min:number, max:number) =>
  (v<min ? "low" : v>max ? "high" : "ok") as "ok"|"low"|"high"
const colorFor = (k:"ok"|"low"|"high") => k==="ok" ? "#10b981" : k==="low" ? "#38bdf8" : "#f59e0b"

/* ---------- Page ---------- */
export default function Sensors() {
  /* thresholds from localStorage (fallback to defaults) */
  const thresholds: Thresholds = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(THRESHOLDS_KEY)
      if (raw) {
        const t = JSON.parse(raw)
        return {
          temperature: { min: toNum(t?.temperature?.min, 15), max: toNum(t?.temperature?.max, 65) },
          moisture:     { min: toNum(t?.moisture?.min, 40),     max: toNum(t?.moisture?.max, 80) },
          ph:           { min: toNum(t?.ph?.min, 6),            max: toNum(t?.ph?.max, 8)  },
        }
      }
    } catch {}
    return { temperature: { min: 15, max: 65 }, moisture: { min: 40, max: 80 }, ph: { min: 6, max: 8 } }
  }, [])

  /* live (sim) – swap with your feed later */
  const [readings, setReadings] = React.useState<Record<QuadKey, Readings>>({
    A: { temp: 48, moist: 62, ph: 7.2 },
    B: { temp: 52, moist: 58, ph: 7.0 },
    C: { temp: 45, moist: 65, ph: 6.7 },
    D: { temp: 50, moist: 60, ph: 7.5 },
  })

  /* streaming series for averages */
  const [series, setSeries] = React.useState<{ temp:number[]; moist:number[]; ph:number[] }>({ temp:[], moist:[], ph:[] })
  const MAX_POINTS = 90

  React.useEffect(() => {
    let alive = true
    const jitter = (v:number, a=1) => Number((v + (Math.random()-0.5)*a).toFixed(1))
    const append = (arr:number[], v:number) => [...arr.slice(-(MAX_POINTS-1)), v]
    const id = setInterval(() => {
      if (!alive) return
      setReadings(prev => {
        const step = (r: Readings): Readings => ({
          temp: clamp(jitter(r.temp, 0.9), 20, 70),
          moist: clamp(jitter(r.moist, 1.2), 25, 90),
          ph:   clamp(jitter(r.ph,   0.06), 5,  9),
        })
        const next = {
          A: step(prev.A ?? { temp: 48, moist: 62, ph: 7.2 }),
          B: step(prev.B ?? { temp: 52, moist: 58, ph: 7.0 }),
          C: step(prev.C ?? { temp: 45, moist: 65, ph: 6.7 }),
          D: step(prev.D ?? { temp: 50, moist: 60, ph: 7.5 }),
        }
        const avg = (sel:(r:Readings)=>number) =>
          Number(((sel(next.A)+sel(next.B)+sel(next.C)+sel(next.D))/4).toFixed(1))
        setSeries(s => ({ temp: append(s.temp, avg(r=>r.temp)),
                          moist:append(s.moist,avg(r=>r.moist)),
                          ph:   append(s.ph,   avg(r=>r.ph)) }))
        return next
      })
    }, 1700)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const avg = React.useMemo(() => {
    const list = (["A","B","C","D"] as QuadKey[]).map(k => readings[k])
    const f = (sel:(r:Readings)=>number) => Number((list.reduce((s,r)=>s+sel(r),0)/list.length).toFixed(1))
    return { temp: f(r=>r.temp), moist: f(r=>r.moist), ph: f(r=>r.ph) }
  }, [readings])

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header card with shimmer + corner glow (same aesthetic as About/Settings) */}
      <section className="card card-live relative p-5 md:p-6 overflow-hidden">
        <div className="card-shimmer" />
        <div className="corner-glow top-[-3rem] right-[-3rem]" />
        <h2 className="text-base md:text-lg font-semibold">Sensors</h2>
        <p className="text-sm text-gray-700 dark:text-gray-200">
          Four-quadrant view of the vermicompost bin. Each quadrant shows live Temperature, Moisture, and pH.
        </p>
      </section>

      {/* Quadrants */}
      <section className="card card-live relative p-3 md:p-4 overflow-hidden">
        <div className="corner-glow bottom-[-3rem] left-[-3rem]" />
        <QuadBox readings={readings} thresholds={thresholds} />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-700 dark:text-gray-200 px-1">
          <LegendDot className="bg-sky-500" /> Low
          <LegendDot className="bg-emerald-500" /> OK
          <LegendDot className="bg-amber-500" /> High
          <span className="ml-auto opacity-75">Thresholds from Settings</span>
        </div>
      </section>

      {/* Averages – bigger, easy to read, animated in */}
      <div className="grid grid-cols-1 gap-4">
        <ChartCard title="Average Temperature" unit="°C" color="#10b981" data={series.temp}  bigValue={avg.temp} />
        <ChartCard title="Average Moisture"     unit="%"  color="#38bdf8" data={series.moist} bigValue={avg.moist} />
        <ChartCard title="Average pH"            unit=""   color="#f59e0b" data={series.ph}   bigValue={avg.ph} />
      </div>
    </div>
  )
}

/* ---------- Quadrant box (simple, readable) ---------- */
function QuadBox({
  readings, thresholds
}:{
  readings: Record<QuadKey, Readings>
  thresholds: Thresholds
}) {
  const containerRef = React.useRef<HTMLDivElement|null>(null)
  const [w, setW] = React.useState(900)
  React.useEffect(() => {
    const update = () => setW(containerRef.current?.clientWidth ?? 900)
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // smooth typographic scaling across widths
  const s = clamp(w / 900, 0.75, 1.0)
  const titleSize = Math.max(12, Math.round(14 * s))
  const valueSize = Math.max(14, Math.round(16 * s))
  const labelSize = Math.max(11, Math.round(12 * s))

  const blocks: { k:QuadKey; title:string; r:Readings }[] = [
    { k:"A", title:"North-West", r:readings.A },
    { k:"B", title:"North-East", r:readings.B },
    { k:"C", title:"South-West", r:readings.C },
    { k:"D", title:"South-East", r:readings.D },
  ]

  return (
    <div ref={containerRef} className="tt-qgrid animate-fade-in-up">
      {blocks.map(b => {
        const t = statusFor(b.r.temp, thresholds.temperature.min, thresholds.temperature.max)
        const m = statusFor(b.r.moist, thresholds.moisture.min, thresholds.moisture.max)
        const p = statusFor(b.r.ph,   thresholds.ph.min,        thresholds.ph.max)
        return (
          <div key={b.k} className="tt-qcell">
            <div className="flex items-center gap-2">
              <span className="tt-qbadge">{b.k}</span>
              <div className="font-semibold" style={{ fontSize: titleSize }}>{b.title}</div>
            </div>

            <div className="mt-2 space-y-1.5">
              <Row label="Temp"  value={`${b.r.temp.toFixed(1)}°C`} dot={colorFor(t)}  valueSize={valueSize} labelSize={labelSize} />
              <Row label="Moist" value={`${b.r.moist.toFixed(1)}%`} dot={colorFor(m)} valueSize={valueSize} labelSize={labelSize} />
              <Row label="pH"    value={b.r.ph.toFixed(1)}         dot={colorFor(p)}  valueSize={valueSize} labelSize={labelSize} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Row({
  label, value, dot, valueSize, labelSize
}:{
  label:string; value:string; dot:string; valueSize:number; labelSize:number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dot }} />
        <span className="text-gray-700 dark:text-gray-200" style={{ fontSize: labelSize }}>{label}</span>
      </div>
      <div className="font-semibold tabular-nums" style={{ fontSize: valueSize }}>{value}</div>
    </div>
  )
}

function LegendDot({ className }: { className: string }) {
  return <span className={["inline-block w-2 h-2 rounded-full", className].join(" ")} />
}

/* ---------- Responsive chart card ---------- */
function ChartCard({
  title, unit, color, data, bigValue
}:{
  title:string; unit:string; color:string; data:number[]; bigValue?:number
}) {
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
  const min = Math.min(...(data.length ? data : [0]))
  const max = Math.max(...(data.length ? data : [1]))
  const lo = min - (max-min)*0.15
  const hi = max + (max-min)*0.15 || 1
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

        {/* grid */}
        <g opacity=".16" stroke="currentColor">
          <line x1={PAD} y1={PAD} x2={W-PAD} y2={PAD} />
          <line x1={PAD} y1={H/2} x2={W-PAD} y2={H/2} />
          <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} />
        </g>

        {/* area + line */}
        {data.length > 1 && <path d={area} fill="url(#lineGradAuto)" />}
        {data.length > 1 && <path d={d} fill="none" stroke={stroke} strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />}

        {/* last dot */}
        {data.length > 0 && (
          <circle cx={PAD+(data.length-1)*step} cy={norm(data[data.length-1])} r="3.8" fill={stroke} />
        )}
      </svg>
    </div>
  )
}
