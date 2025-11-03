import React from "react"

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */
type Thresholds = {
  temperature: { min: number | ""; max: number | "" }
  moisture:    { min: number | ""; max: number | "" }
  n:           { min: number | ""; max: number | "" } // Nitrogen (ppm)
  p:           { min: number | ""; max: number | "" } // Phosphorus (ppm)
  k:           { min: number | ""; max: number | "" } // Potassium (ppm)
}

const THRESHOLDS_KEY   = "tt_thresholds"
const ALERT_EMAIL_KEY  = "tt_alert_email"

const DEFAULTS: Thresholds = {
  temperature: { min: 15, max: 65 }, // °C
  moisture:    { min: 40, max: 80 }, // % RH
  n:           { min: 150, max: 900 }, // ppm (tune to your sensor scale)
  p:           { min:  50, max: 300 }, // ppm
  k:           { min: 100, max: 800 }, // ppm
}

const asNum = (v: any, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d)

/** Merge any previously-saved structure (including legacy `ph`) into the new NPK structure. */
function migrateThresholds(saved: any): Thresholds {
  const t = typeof saved === "string" ? JSON.parse(saved) : (saved || {})
  return {
    temperature: {
      min: asNum(t?.temperature?.min, DEFAULTS.temperature.min),
      max: asNum(t?.temperature?.max, DEFAULTS.temperature.max),
    },
    moisture: {
      min: asNum(t?.moisture?.min, DEFAULTS.moisture.min),
      max: asNum(t?.moisture?.max, DEFAULTS.moisture.max),
    },
    n: { min: asNum(t?.n?.min, DEFAULTS.n.min), max: asNum(t?.n?.max, DEFAULTS.n.max) },
    p: { min: asNum(t?.p?.min, DEFAULTS.p.min), max: asNum(t?.p?.max, DEFAULTS.p.max) },
    k: { min: asNum(t?.k?.min, DEFAULTS.k.min), max: asNum(t?.k?.max, DEFAULTS.k.max) },
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Settings() {
  /** Load persisted values (or defaults, migrated from any old shape) */
  const [thresholds, setThresholds] = React.useState<Thresholds>(() => {
    const saved = localStorage.getItem(THRESHOLDS_KEY)
    return saved ? migrateThresholds(saved) : DEFAULTS
  })

  const [email, setEmail] = React.useState<string>(() => localStorage.getItem(ALERT_EMAIL_KEY) || "")
  const [saving, setSaving] = React.useState<"thresholds" | "email" | null>(null)
  const [banner, setBanner] = React.useState<{ kind: "ok" | "err"; msg: string } | null>(null)
  const [savedPulse, setSavedPulse] = React.useState<"t" | "e" | null>(null)

  /* --------------------------- Helpers --------------------------- */
  const setField = (group: keyof Thresholds, bound: "min" | "max", value: string) => {
    if (value === "" || /^-?\d+(\.\d+)?$/.test(value)) {
      setThresholds(prev => ({
        ...prev,
        [group]: { ...prev[group], [bound]: value === "" ? "" : Number(value) }
      }))
    }
  }

  const labelFor = (k: keyof Thresholds) => {
    if (k === "temperature") return "Temperature"
    if (k === "moisture")    return "Moisture"
    if (k === "n")           return "Nitrogen (N)"
    if (k === "p")           return "Phosphorus (P)"
    return "Potassium (K)"
  }

  const validateThresholds = (t: Thresholds): string | null => {
    for (const k of Object.keys(t) as (keyof Thresholds)[]) {
      const { min, max } = t[k]
      if (min === "" || max === "") return "All threshold fields must be filled."
      if (typeof min !== "number" || typeof max !== "number") return "Thresholds must be numbers."
      if (max < min) return `For ${labelFor(k)}, max must be greater than min.`
    }
    return null
  }

  const isDirty = React.useMemo(() => {
    const saved = localStorage.getItem(THRESHOLDS_KEY)
    const now   = JSON.stringify(thresholds)
    return saved ? saved !== now : true
  }, [thresholds])

  const saveThresholds = () => {
    const err = validateThresholds(thresholds)
    if (err) { setBanner({ kind: "err", msg: err }); return }
    setSaving("thresholds")
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds))
    setTimeout(() => {
      setSaving(null)
      setSavedPulse("t")
      setBanner({ kind: "ok", msg: "Thresholds saved. These values will be used by alerts and charts." })
      setTimeout(() => setSavedPulse(null), 900)
    }, 300)
  }

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
  const emailDirty = React.useMemo(() => (localStorage.getItem(ALERT_EMAIL_KEY) || "") !== email, [email])

  const saveEmail = () => {
    if (!validateEmail(email)) { setBanner({ kind: "err", msg: "Please enter a valid email address." }); return }
    setSaving("email")
    localStorage.setItem(ALERT_EMAIL_KEY, email)
    setTimeout(() => {
      setSaving(null)
      setSavedPulse("e")
      setBanner({ kind: "ok", msg: "Alert email saved. We’ll use this for notifications." })
      setTimeout(() => setSavedPulse(null), 900)
    }, 260)
  }

  /* ---------------------------- UI ---------------------------- */
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 animate-fade-in-up">
      {/* Banner */}
      {banner && (
        <div className="xl:col-span-12 banner-enter rounded-xl px-4 py-2 border text-sm
                        bg-white/80 dark:bg-[hsl(var(--card))]/85 backdrop-blur
                        border-[hsl(var(--border))] dark:border-white/10">
          <span className={banner.kind === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            {banner.msg}
          </span>
        </div>
      )}

      {/* LEFT: Thresholds */}
      <section
        className={[
          "xl:col-span-7 setting-card p-5 md:p-6 overflow-hidden",
          savedPulse === "t" ? "glow-on-save" : "",
          "animate-fade-in-up"
        ].join(" ")}
        style={{ animationDelay: "60ms" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60
                        bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
        <div className="pointer-events-none absolute -top-12 -right-16 w-56 h-56 rounded-full
                        bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <Header
          title="Threshold calibration"
          subtitle="Define safe ranges TerraTrak should maintain."
          icon={<ThermoIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          chip={isDirty ? "Unsaved changes" : "Saved"}
          chipVariant={isDirty ? "muted" : "success"}
        />

        <div className="mt-4 grid gap-4">
          <ThresholdRow
            label="Temperature"
            unit="°C"
            hint="Typical compost core: 40–70°C. Below 40°C usually means slow activity."
            tooltip="We monitor compost core temp. Too hot can harm worms; too low slows decomposition."
            min={thresholds.temperature.min}
            max={thresholds.temperature.max}
            onMin={(v) => setField("temperature", "min", v)}
            onMax={(v) => setField("temperature", "max", v)}
          />
          <Divider />
          <ThresholdRow
            label="Moisture"
            unit="%"
            hint="Ideal: 40–80% relative moisture (like a wrung-out sponge)."
            tooltip="Moisture keeps worms active and prevents overheating. Above ~80% can cause anaerobic zones."
            min={thresholds.moisture.min}
            max={thresholds.moisture.max}
            onMin={(v) => setField("moisture", "min", v)}
            onMax={(v) => setField("moisture", "max", v)}
          />
          <Divider />
          <ThresholdRow
            label="Nitrogen (N)"
            unit="ppm"
            hint="Higher N indicates fresh greens/manure; too high can heat the bin."
            tooltip="We read N from your NPK sensor. Tune bounds to your sensor’s scale and desired feedstock ratio."
            min={thresholds.n.min}
            max={thresholds.n.max}
            onMin={(v) => setField("n", "min", v)}
            onMax={(v) => setField("n", "max", v)}
          />
          <ThresholdRow
            label="Phosphorus (P)"
            unit="ppm"
            hint="Important for plant root development; compost P rises with balanced feedstock."
            tooltip="Use this to track nutrient maturity trends. Calibrate with your sensor’s docs."
            min={thresholds.p.min}
            max={thresholds.p.max}
            onMin={(v) => setField("p", "min", v)}
            onMax={(v) => setField("p", "max", v)}
          />
          <ThresholdRow
            label="Potassium (K)"
            unit="ppm"
            hint="Supports overall plant vigor. K typically ramps as compost stabilizes."
            tooltip="If K is low while N is high, consider more brown/carbon feedstock."
            min={thresholds.k.min}
            max={thresholds.k.max}
            onMin={(v) => setField("k", "min", v)}
            onMax={(v) => setField("k", "max", v)}
          />
        </div>

        {/* Save bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={saveThresholds}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
            disabled={saving === "thresholds" || !isDirty}
          >
            {saving === "thresholds" ? <Spinner /> : null}
            Save thresholds
          </button>
          <button
            onClick={() => { setThresholds(DEFAULTS); setBanner(null) }}
            className="rounded-xl px-4 py-2 border border-[hsl(var(--border))] dark:border-white/15 hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.06] transition-colors"
          >
            Reset
          </button>

          {/* live preview */}
          <div className="ml-auto flex gap-2 text-xs flex-wrap">
            <PreviewChip label="Temp"  value={`${thresholds.temperature.min || "–"}–${thresholds.temperature.max || "–"}°C`} />
            <PreviewChip label="Moist" value={`${thresholds.moisture.min    || "–"}–${thresholds.moisture.max    || "–"}%`} />
            <PreviewChip label="N"     value={`${thresholds.n.min           || "–"}–${thresholds.n.max           || "–"} ppm`} />
            <PreviewChip label="P"     value={`${thresholds.p.min           || "–"}–${thresholds.p.max           || "–"} ppm`} />
            <PreviewChip label="K"     value={`${thresholds.k.min           || "–"}–${thresholds.k.max           || "–"} ppm`} />
          </div>
        </div>
      </section>

      {/* RIGHT: Alerts */}
      <section
        className={[
          "xl:col-span-5 setting-card p-5 md:p-6 overflow-hidden",
          savedPulse === "e" ? "glow-on-save" : "",
          "animate-fade-in-up"
        ].join(" ")}
        style={{ animationDelay: "140ms" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60
                        bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 w-56 h-56 rounded-full
                        bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <Header
          title="Alert preferences"
          subtitle="Choose where TerraTrak should send notifications."
          icon={<BellIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          chip={emailDirty ? "Unsaved changes" : (email ? "Saved" : "Not set")}
          chipVariant={emailDirty ? "muted" : email ? "success" : "muted"}
        />

        <div className="mt-4 max-w-xl">
          <label className="block text-sm font-medium mb-1 flex items-center gap-2">
            Alert email
            <InfoTip text="We’ll email you when readings breach the thresholds above, and for system notices (e.g., sensor offline)." />
          </label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input flex-1"
            />
            <button
              onClick={saveEmail}
              className="rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
              disabled={saving === "email" || !emailDirty}
            >
              {saving === "email" ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            Use a shared team inbox if multiple people should receive alerts.
          </p>
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <MiniBadge>Daily summary</MiniBadge>
          <MiniBadge>Threshold breach</MiniBadge>
          <MiniBadge>Sensor offline</MiniBadge>
          <MiniBadge>Firmware update</MiniBadge>
        </div>
      </section>

      {/* Developer notes */}
      <section className="xl:col-span-12 rounded-xl border border-dashed border-[hsl(var(--border))] dark:border-white/15 p-4 text-xs text-gray-600 dark:text-gray-300 animate-fade-in-up" style={{ animationDelay: "220ms" }}>
        <strong>Developer notes:</strong> read the saved values later with:
        <code className="ml-1 px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] dark:bg-white/[0.08]">
          JSON.parse(localStorage.getItem("tt_thresholds") || "{}")
        </code>
        {" "}and{" "}
        <code className="px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] dark:bg-white/[0.08]">
          localStorage.getItem("tt_alert_email")
        </code>.
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bits & pieces                                                       */
/* ------------------------------------------------------------------ */

function Header({
  title, subtitle, icon, chip, chipVariant = "muted"
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  chip?: string
  chipVariant?: "muted" | "success"
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon ?? <AccentDot />}
        <h2 className="text-base md:text-lg font-semibold">{title}</h2>
        {chip && (
          <span className={[
            "ml-2 px-2 py-0.5 rounded-full text-[11px]",
            chipVariant === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/20"
              : "bg-[hsl(var(--muted))] text-gray-700 border border-[hsl(var(--border))] dark:bg-white/[0.06] dark:text-gray-200 dark:border-white/10"
          ].join(" ")}>
            {chip}
          </span>
        )}
      </div>
      {subtitle && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{subtitle}</p>}
    </div>
  )
}

function AccentDot() {
  return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
}

function Divider() { return <div className="h-px bg-[hsl(var(--border))] dark:bg-white/10" /> }

function ThresholdRow(props: {
  label: string; unit: string; min: number | ""; max: number | "";
  onMin: (v: string) => void; onMax: (v: string) => void; hint?: string; tooltip?: string
}) {
  const { label, unit, min, max, onMin, onMax, hint, tooltip } = props
  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
      <div className="sm:col-span-4">
        <div className="text-sm font-medium flex items-center gap-2">
          {label}
          {tooltip ? <InfoTip text={tooltip} /> : null}
        </div>
        {hint && <div className="text-xs text-gray-600 dark:text-gray-300">{hint}</div>}
      </div>
      <div className="sm:col-span-8 grid grid-cols-2 gap-3">
        <NumberInput label="Min" value={min} onChange={onMin} unit={unit} />
        <NumberInput label="Max" value={max} onChange={onMax} unit={unit} />
      </div>
    </div>
  )
}

function NumberInput({
  label, value, onChange, unit
}: { label: string; value: number | ""; onChange: (v: string) => void; unit: string }) {
  return (
    <label className="w-full">
      <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">{label}</div>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="0"
          className="input w-full pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400 select-none">
          {unit}
        </span>
      </div>
    </label>
  )
}

function PreviewChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs
                     bg-[hsl(var(--muted))] dark:bg-white/[0.06]
                     border border-[hsl(var(--border))] dark:border-white/10">
      <span className="w-1 h-1 rounded-full bg-emerald-500" />
      <span className="text-gray-700 dark:text-gray-200">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  )
}

function MiniBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs
                     bg-[hsl(var(--muted))] dark:bg-white/[0.06]
                     border border-[hsl(var(--border))] dark:border-white/10">
      <span className="w-1 h-1 rounded-full bg-emerald-500" />
      {children}
    </span>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
      <path className="opacity-75" d="M12 2a10 10 0 0 1 10 10h-3A7 7 0 0 0 12 5V2z" fill="currentColor"></path>
    </svg>
  )
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <svg className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition"
           viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 17v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="8" r="1" fill="currentColor"/>
      </svg>
      <span className="absolute left-1/2 -translate-x-1/2 top-[130%] w-64 z-10
                       hidden group-hover:block text-xs p-2 rounded-md
                       bg-black/80 text-white shadow-lg">
        {text}
      </span>
    </span>
  )
}

/* Icons */
function ThermoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M10 4a2 2 0 1 1 4 0v7.1a4.5 4.5 0 1 1-4 0V4z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 13v-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 5a5 5 0 0 0-5 5v2.5l-1.3 2.2a1 1 0 0 0 .9 1.5h10.8a1 1 0 0 0 .9-1.5L17 12.5V10a5 5 0 0 0-5-5z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
