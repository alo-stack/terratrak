import React from "react"
import { useLocation } from "react-router-dom"

export default function Topbar() {
  const { pathname } = useLocation()
  const title = getTitle(pathname)

  React.useEffect(() => {
    document.title = `${title} · TerraTrak`
  }, [title])

  const quotes = [
    "Compost today, nourish tomorrow.",
    "Healthy soil starts with steady care.",
    "Balance carbon and nitrogen, and the worms will thrive.",
    "Moist, airy, and patient—perfect compost in time.",
    "Feed the bin, and the bin feeds the earth."
  ]
  const q = quotes[new Date().getDate() % quotes.length]

  return (
    <header
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3
                 bg-white/20 dark:bg-zinc-900/20 backdrop-blur-md sticky top-0 z-50"
    >
      {/* Dynamic page title */}
      <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 text-center sm:text-left">
        {title}
      </h1>

      {/* Responsive quote capsule */}
      <div
        className={[
          "flex items-center justify-center gap-2 cursor-default text-center",
          "rounded-full px-3 py-1.5 max-w-full sm:max-w-none",
          "bg-white/40 dark:bg-white/10 backdrop-blur-md",
          "border border-white/40 dark:border-white/20",
          "shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
          "transition-all duration-300 ease-out",
          "hover:scale-105 hover:shadow-[0_6px_18px_rgba(0,0,0,0.15)]",
          "hover:ring-2 hover:ring-emerald-400/40"
        ].join(" ")}
        title={q}
        aria-label="Vermicompost tip"
      >
        <LeafIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 drop-shadow-sm shrink-0" />
        
        {/* TerraTrak text (visible only on mobile) */}
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 sm:hidden">
          TerraTrak •
        </span>

        <p className="text-xs md:text-sm text-gray-800 dark:text-gray-100 italic truncate">
          {q}
        </p>
      </div>
    </header>
  )
}

function getTitle(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/overview")) return "Dashboard"
  if (pathname.startsWith("/sensors")) return "Sensors"
  if (pathname.startsWith("/settings")) return "Settings"
  if (pathname.startsWith("/about")) return "About"
  const seg = pathname.split("/").filter(Boolean)[0] || "Dashboard"
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

function LeafIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M20.5 3.5c-6.5.6-10.6 3.1-13 5.5C5 11.5 4.2 14 5.9 16.1c1.7 2.1 4.8 2.6 7.1.9 2.4-1.8 4.9-6.1 5.5-13z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 18c3-2.2 5.2-4.1 8-8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
