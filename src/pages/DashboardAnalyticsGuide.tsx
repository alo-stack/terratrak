import React from "react"
import { Link } from "react-router-dom"
import Icon from "../components/Icon"

type AnalysisItem = {
  title: string
  description: string
  icon: "gauge" | "dashboard" | "info" | "cog"
}

const analysisItems: AnalysisItem[] = [
  {
    title: "Moving average",
    description:
      "Averages the last few readings to smooth noise and show the true direction of temperature, moisture, and NPK.",
    icon: "gauge",
  },
  {
    title: "Standard deviation (SD)",
    description:
      "Shows how much readings swing around the average. Low SD means steady; high SD means unstable.",
    icon: "dashboard",
  },
  {
    title: "Anomaly detection",
    description:
      "Flags unusual spikes or drops that are far from normal, so sudden issues are easier to spot.",
    icon: "info",
  },
  {
    title: "Trend (change over time)",
    description:
      "Combines slope and percent change to label each metric as rising, falling, or stable.",
    icon: "gauge",
  },
  {
    title: "Correlation",
    description:
      "Checks whether two metrics move together (for example moisture and nutrients), which helps reveal linked behavior.",
    icon: "dashboard",
  },
  {
    title: "Stability score",
    description:
      "Combines variability across key metrics into one stability index. Higher score means more consistent conditions.",
    icon: "cog",
  },
  {
    title: "NPK analytics",
    description:
      "Breaks N, P, and K into separate trends, SD, and anomaly counts to highlight nutrient imbalance early.",
    icon: "dashboard",
  },
  {
    title: "Weekly summary",
    description:
      "Gives a 7-day snapshot with averages, out-of-range counts, and quick guidance for corrective actions.",
    icon: "info",
  },
  {
    title: "CSV export",
    description:
      "Downloads the weekly table (timestamp, temperature, moisture, N, P, K) for records or sharing.",
    icon: "cog",
  },
]

export default function DashboardAnalyticsGuide() {
  return (
    <div className="grid grid-cols-1 gap-4 animate-fade-in-up">
      <section className="relative card card-live p-5 md:p-6 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60
                     bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50"
        />
        <div
          className="pointer-events-none absolute -top-12 -right-16 w-52 h-52 rounded-full
                     bg-cyan-400/15 blur-2xl dark:bg-cyan-300/10"
        />

        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Icon name="dashboard" className="w-4 h-4 text-cyan-600 dark:text-cyan-300" />
              <h2 className="text-lg font-semibold">Dashboard Analytics Guide</h2>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-200 max-w-2xl leading-6">
              A clear breakdown of every analytics method used in TerraTrak so users can interpret trends,
              anomalies, and nutrient behavior with confidence.
            </p>
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <Link
              to="/about"
              className="inline-flex items-center rounded-md border border-[hsl(var(--border))] dark:border-white/10 px-3 py-2 text-xs
                         hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.06] transition-colors"
            >
              Back to About
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {analysisItems.map((item, i) => (
            <article
              key={item.title}
              className="rounded-xl border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--card))] p-4
                         transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:shadow-sm
                         animate-fade-in-up"
              style={{ animationDelay: `${80 + i * 50}ms` }}
            >
              <div className="flex items-start gap-2 mb-2">
                <span className="inline-grid place-items-center w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-700 dark:text-cyan-200 border border-cyan-500/20">
                  <Icon name={item.icon} className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-6">{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
