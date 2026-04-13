import React from "react"
import { Link } from "react-router-dom"
import Icon from "../components/Icon"

export default function About() {
  const guidesRef = React.useRef<HTMLElement | null>(null)
  const [guidesInView, setGuidesInView] = React.useState(false)

  React.useEffect(() => {
    if (!guidesRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setGuidesInView(true)
        observer.disconnect()
      },
      { threshold: 0.2 }
    )

    observer.observe(guidesRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 animate-fade-in-up">
      {/* About TerraTrak — wider on xl */}
      <section className="relative xl:col-span-7 card card-live p-5 md:p-6 overflow-hidden">
        {/* subtle top shimmer accent */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60
                     bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50"
        />
        {/* faint emerald glow in the corner */}
        <div
          className="pointer-events-none absolute -top-10 -right-14 w-48 h-48 rounded-full
                     bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10"
        />

        <Header icon={<StarIcon />} title="About TerraTrak" />

        {/* Body (constrained for better reading) */}
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200 leading-6 max-w-prose">
          <p className="text-gray-900 dark:text-gray-100 font-medium">
            TerraTrak unifies composting and soil health in one smart, data-driven system so users
            can produce consistent, high-quality compost, without guesswork.
          </p>
          <p>
            Many farmers and gardeners struggle with uncertainty: too much moisture or
            unstable soil quality leads to poor results, pushing reliance on chemical fertilizers.
            Existing tools are often costly, fragmented, or focus on either soil monitoring or
            composting, but not both.
          </p>
          <p>
            TerraTrak uses sensors to track <em>temperature</em>, <em>humidity</em>, and
            <em> nutrients</em>, surfacing real-time insights via an online dashboard. The result:
            consistent compost, healthier soils, and a modern and sustainable alternative to chemical fertilizers
            —in a solution that’s affordable and accessible for everyday users.
          </p>
        </div>

        {/* Profile strip */}
        <div className="mt-4 rounded-xl border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--muted))/0.35] dark:bg-white/[0.03] p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <MiniBadge>Smart composting</MiniBadge>
            <MiniBadge>Soil intelligence</MiniBadge>
            <MiniBadge>Pilot-ready deployment</MiniBadge>
          </div>
        </div>

        <SectionDivider label="System Snapshot" color="emerald" />

        {/* Quick stats (hover lift + soft ring) */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Sensors" value="10+" hint="Temp · Moist · NPK" />
          <Stat label="Cycle time" value="~4–8 wks" hint="steady conditions" />
          <Stat label="Pilot sites" value="1" hint="farm" />
          <Stat label="Fertilizer spend" value="↓ 25–40%" hint="target reduction" />
        </div>

        <SectionDivider label="Value Highlights" color="cyan" />

        {/* Value bullets */}
        <div className="mt-5 border-t border-[hsl(var(--border))] dark:border-white/10 pt-4 grid md:grid-cols-2 gap-3">
          <Bullet text="Real-time guidance removes trial & error" />
          <Bullet text="One system for compost & soil health" />
          <Bullet text="Affordable, modular hardware" />
          <Bullet text="Clear, actionable UI for daily decisions" />
        </div>

        {/* Tags with gentle float animation */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Tag float>Temperature</Tag>
          <Tag>Humidity</Tag>
          <Tag>Nutrients</Tag>
          <Tag>Dashboard</Tag>
          <Tag float>Alerts</Tag>
        </div>

      </section>

      {/* Team — narrower on xl */}
      <section className="relative xl:col-span-5 card card-live p-5 md:p-6 overflow-hidden">
        {/* subtle top shimmer accent (added) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60
                     bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50"
        />
        {/* subtle corner glow */}
        <div
          className="pointer-events-none absolute -bottom-10 -left-14 w-48 h-48 rounded-full
                     bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10"
        />
        <Header
          icon={<Icon name="info" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          title="Who made TerraTrak possible?"
        />

        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mt-2 mb-1">Researchers</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">Core team behind system design, testing, and field implementation.</p>
        <ul className="space-y-2">
          <Person name="Corcino, Daniel Justine" />
          <Person name="De Mesa, Charisse Anne" />
          <Person name="Lagrimas, Angelo" />
          <Person name="Zurbito, Pierre Victor" />
        </ul>

        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <Info label="Organization" value="Polytechnic University of the Philippines" />
          <Info label="Sub-Organization" value="College of Engineering: Computer Engineering" />
          <Info label="Farm" value="Victa Ranch Pampanga (Pilot Site)" />
        </div>

        <div className="mt-5 border-t border-[hsl(var(--border))] dark:border-white/10 pt-4 grid sm:grid-cols-2 gap-3">
          <MiniBadge>Research</MiniBadge>
          <MiniBadge>Field testing</MiniBadge>
          <MiniBadge>Electronics</MiniBadge>
          <MiniBadge>Software</MiniBadge>
        </div>

        <SectionDivider label="Deployment Partner" color="emerald" />

        <div className="mt-3 rounded-lg border border-emerald-300/30 dark:border-emerald-400/20 bg-emerald-50/35 dark:bg-emerald-500/10 p-3">
          <div className="text-xs text-gray-600 dark:text-gray-300">Pilot Site</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Victa Ranch Pampanga</div>
        </div>
      </section>

      {/* Guides hub */}
      <section ref={guidesRef} className="relative xl:col-span-12 card card-live p-5 md:p-6 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60
                     bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50"
        />
        <div
          className="pointer-events-none absolute -top-10 -right-14 w-48 h-48 rounded-full
                     bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10"
        />

        <Header icon={<Icon name="info" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />} title="Guides & Learning Hub" />

        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 mb-3 max-w-3xl">
          Choose a learning path based on what you need right now, analytics interpretation or hands-on vermiculture operations.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-1">
          <article
            className={[
              "rounded-xl border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--card))] p-4 md:p-5",
              "transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/35 hover:shadow-sm",
              guidesInView ? "animate-fade-in-up opacity-100" : "opacity-0 translate-y-2"
            ].join(" ")}
            style={{ animationDelay: guidesInView ? "100ms" : "0ms" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-grid place-items-center w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/20">
                <Icon name="dashboard" className="w-4 h-4 text-cyan-700 dark:text-cyan-200" />
              </span>
              <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100">Dashboard Analytics Guide</h3>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-200 leading-6">
              Understand moving averages, standard deviation, anomaly detection, trend labeling, and export insights in one practical explainer.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <MiniBadge>Trend reading</MiniBadge>
              <MiniBadge>Anomaly spotting</MiniBadge>
              <MiniBadge>CSV workflow</MiniBadge>
            </div>

            <div className="mt-4 h-[2px] rounded-full bg-gradient-to-r from-cyan-400/50 via-cyan-300/20 to-transparent" />

            <div className="mt-4">
              <Link
                to="/about/dashboard-analytics-guide"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold
                           bg-cyan-600 text-white hover:bg-cyan-500 transition-colors duration-200"
              >
                Explore dashboard analytics guide
              </Link>
            </div>
          </article>

          <article
            className={[
              "rounded-xl border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--card))] p-4 md:p-5",
              "transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/35 hover:shadow-sm",
              guidesInView ? "animate-fade-in-up opacity-100" : "opacity-0 translate-y-2"
            ].join(" ")}
            style={{ animationDelay: guidesInView ? "220ms" : "0ms" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-grid place-items-center w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
                <Icon name="info" className="w-4 h-4 text-emerald-700 dark:text-emerald-200" />
              </span>
              <h3 className="text-sm md:text-base font-semibold text-gray-900 dark:text-gray-100">Vermicomposting Guide</h3>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-200 leading-6">
              Get a complete ANC setup guide including feeding routines, moisture management, do's and don'ts, and step-by-step vermiculture flow.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <MiniBadge>ANC handling</MiniBadge>
              <MiniBadge>Feeding guide</MiniBadge>
              <MiniBadge>Bilingual support</MiniBadge>
            </div>

            <div className="mt-4 h-[2px] rounded-full bg-gradient-to-r from-emerald-400/50 via-emerald-300/20 to-transparent" />

            <div className="mt-4">
              <Link
                to="/about/vermicomposting-guide"
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold
                           bg-emerald-600 text-white hover:bg-emerald-500
                           transition-colors duration-200"
              >
                Learn more about vermicomposting
              </Link>
            </div>
          </article>
        </div>
      </section>
    </div>
  )
}

/* ---------- UI bits with motion ---------- */

function Header({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-lg md:text-lg font-semibold">{title}</h2>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--card))] px-3 py-2
                    transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-sm">
      <div className="text-xs text-gray-600 dark:text-gray-300">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
      {hint && <div className="text-xs text-gray-500 dark:text-gray-400">{hint}</div>}
    </div>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 group">
      <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/80 dark:bg-emerald-400/80
                       transition-transform group-hover:scale-125" />
      <p className="text-sm text-gray-700 dark:text-gray-200">{text}</p>
    </div>
  )
}

function Tag({ children, float }: { children: React.ReactNode; float?: boolean }) {
  return (
    <span
      className={[
        "px-2.5 py-1 rounded-full text-xs",
        "bg-emerald-50 text-emerald-700 border border-emerald-100",
        "dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/20",
        "transition-transform duration-200 hover:translate-y-[-1px]",
        float ? "animate-float-slow" : ""
      ].join(" ")}
    >
      {children}
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

function Person({ name }: { name: string }) {
  const initials = name
    .split(/[ ,]+/).filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join("")

  return (
    <li className="flex items-center gap-3 rounded-lg px-1 py-1 transition-colors
                   hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.05]">
      <div className="w-8 h-8 rounded-full grid place-items-center
                      bg-emerald-500/15 text-emerald-700 border border-emerald-500/20
                      dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/20
                      text-xs font-semibold transition-transform duration-200
                      group-hover:translate-y-[-1px]">
        {initials || "TT"}
      </div>
      <span className="text-sm text-gray-800 dark:text-gray-200">{name}</span>
    </li>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="transition-all duration-200 hover:-translate-y-0.5">
      <div className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</div>
      <div className="text-sm text-gray-800 dark:text-gray-200">{value}</div>
    </div>
  )
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-emerald-600 dark:text-emerald-400">
      <path d="M12 3l2.1 4.3L19 8l-3.5 3.4L16 17l-4-2.1L8 17l.5-5.6L5 8l4.9-.7L12 3z"
            stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function SectionDivider({ label, color }: { label: string; color: "emerald" | "cyan" }) {
  const tint = color === "emerald"
    ? "from-emerald-400/40 via-emerald-300/20"
    : "from-cyan-400/40 via-cyan-300/20"

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-300">{label}</span>
        <span className="w-1 h-1 rounded-full bg-emerald-400/80" />
      </div>
      <div className={`mt-1 h-[1px] rounded-full bg-gradient-to-r ${tint} to-transparent`} />
    </div>
  )
}
