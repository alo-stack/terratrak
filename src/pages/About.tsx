import React from "react"
import Icon from "../components/Icon"

export default function About() {
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

        {/* Quick stats (hover lift + soft ring) */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Sensors" value="10+" hint="Temp · Moist · NPK" />
          <Stat label="Cycle time" value="~4–8 wks" hint="steady conditions" />
          <Stat label="Pilot sites" value="1" hint="farm" />
          <Stat label="Fertilizer spend" value="↓ 25–40%" hint="target reduction" />
        </div>

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

        {/* Data analysis card: simple explanations for users */}
        <div className="mt-4 rounded-2xl border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--card))] p-4">
          <h3 className="text-sm font-semibold mb-2">Data analyses on this dashboard</h3>
          <div className="text-xs text-gray-700 dark:text-gray-200 space-y-2">
            <div><strong>Moving average:</strong> averages the last few readings to smooth noise and show the true direction of temperature, moisture, and NPK.</div>
            <div><strong>Standard deviation (SD):</strong> shows how much readings swing around the average. Low SD means steady; high SD means unstable.</div>
            <div><strong>Anomaly detection:</strong> flags unusual spikes or drops that are far from normal, so sudden issues are easier to spot.</div>
            <div><strong>Trend (change over time):</strong> combines slope and percent change to label each metric as rising, falling, or stable.</div>
            <div><strong>Correlation:</strong> checks whether two metrics move together (for example moisture and nutrients), which helps reveal linked behavior.</div>
            <div><strong>Stability score:</strong> combines variability across key metrics into one stability index. Higher score means more consistent conditions.</div>
            <div><strong>NPK analytics:</strong> breaks N, P, and K into separate trends, SD, and anomaly counts to highlight nutrient imbalance early.</div>
            <div><strong>Weekly summary:</strong> gives a 7-day snapshot with averages, out-of-range counts, and quick guidance for corrective actions.</div>
            <div><strong>CSV export:</strong> downloads the weekly table (timestamp, temperature, moisture, N, P, K) for records or sharing.</div>
          </div>
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

        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mt-2 mb-2">Researchers</h3>
        <ul className="space-y-2">
          <Person name="Corcino, Daniel Justine" />
          <Person name="De Mesa, Charisse Anne" />
          <Person name="Lagrimas, Angelo" />
          <Person name="Zurbito, Pierre Victor" />
        </ul>

        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <Info label="Organization" value="Polytechnic University of the Philippines" />
          <Info label="Sub-Organization" value="College of Engineering: Computer Engineering" />
          <Info label="Farm" value="—" />
        </div>

        <div className="mt-5 border-t border-[hsl(var(--border))] dark:border-white/10 pt-4 grid sm:grid-cols-2 gap-3">
          <MiniBadge>Research</MiniBadge>
          <MiniBadge>Field testing</MiniBadge>
          <MiniBadge>Electronics</MiniBadge>
          <MiniBadge>Software</MiniBadge>
        </div>
      </section>

      {/* Detailed Guides */}
      <section className="relative xl:col-span-12 card card-live p-5 md:p-6 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60
                     bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50"
        />
        <div
          className="pointer-events-none absolute -top-10 -right-14 w-48 h-48 rounded-full
                     bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10"
        />

        <Header icon={<Icon name="info" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />} title="Getting Started" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Bedding Prep */}
          <div className="rounded-lg border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--card))] p-4">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">🛏️ Bedding Preparation</h4>
            <ol className="text-sm text-gray-700 dark:text-gray-200 space-y-2">
              <li><strong>1) Build the base:</strong> Shred cardboard or newspaper into strips. Fill the bin about 2/3 with dry bedding.</li>
              <li><strong>2) Moisten:</strong> Add water and mix until it feels like a wrung-out sponge. No dripping water.</li>
              <li><strong>3) Add structure:</strong> Mix in a handful of dry leaves or coconut coir to keep air pockets.</li>
              <li><strong>4) Add grit:</strong> Sprinkle a small amount of crushed eggshells or garden lime for worm digestion.</li>
              <li><strong>5) Add starter feed:</strong> Bury a small handful of food scraps in one corner. Cover with bedding.</li>
              <li><strong>6) Rest and check:</strong> Wait 24 hours, then add worms. If it smells sour, add more bedding.</li>
            </ol>
          </div>

          {/* Food & Bedding Guide */}
          <div className="rounded-lg border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--card))] p-4">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">🍎 Food & Bedding Guide</h4>
            <div className="text-sm text-gray-700 dark:text-gray-200 space-y-2">
              <div><strong>Feed weekly:</strong> Add a small amount, wait until most is gone before adding more.</div>
              <div><strong>Good foods:</strong> Fruit & veg scraps, coffee grounds, tea bags, crushed eggshells.</div>
              <div><strong>Balance with browns:</strong> Shredded cardboard, paper, dry leaves keep the bin airy.</div>
              <div><strong>Avoid:</strong> Meat, dairy, oily foods, salty/spicy foods, excessive citrus or onion.</div>
              <div><strong>Ratio:</strong> About 2–3 parts bedding (browns) to 1 part food (greens).</div>
            </div>
          </div>
        </div>

        {/* General Tips */}
        <div className="mt-6 rounded-lg border border-[hsl(var(--border))] dark:border-white/10 bg-white/40 dark:bg-gray-900/40 p-4">
          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">💡 Key Tips for Success</h4>
          <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-2">
            <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span> <span>Keep nutrient balance; excess salts can stress the bin.</span></li>
            <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span> <span>Turn or lift bedding weekly to prevent anaerobic pockets and improve airflow.</span></li>
            <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span> <span>Small, frequent feedings reduce odor and prevent heating spikes.</span></li>
            <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span> <span>Maintain a moist, wrung-out sponge feel—too wet limits air flow.</span></li>
            <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span> <span>Shred carbon-rich materials (cardboard) to balance nitrogen-rich food scraps.</span></li>
          </ul>
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
