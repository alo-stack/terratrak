import React from "react"
import { useLocation } from "react-router-dom"

export default function Topbar() {
  const { pathname } = useLocation()

  // Map path -> title
  const title = getTitle(pathname)

  // Optional: also reflect in the browser tab title
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
    <header className="flex items-center justify-between px-4 py-3">
      {/* Dynamic page title */}
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
        {title}
      </h1>

      {/* Glassy quote capsule with hover effects */}
      <div
        className={[
          "hidden sm:flex items-center gap-2 cursor-default",
          "rounded-full px-3 py-1.5",
          "bg-white/30 dark:bg-white/10 backdrop-blur-md",
          "border border-white/40 dark:border-white/20",
          "shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
          "transition-all duration-300 ease-out",
          "hover:scale-105 hover:shadow-[0_6px_18px_rgba(0,0,0,0.15)]",
          "hover:ring-2 hover:ring-emerald-400/40"
        ].join(" ")}
        title={q}
        aria-label="Vermicompost tip"
      >
        <LeafIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 drop-shadow-sm" />
        <p className="text-xs md:text-sm text-gray-800 dark:text-gray-100 italic">
          {q}
        </p>
      </div>
    </header>
  )
}

function getTitle(pathname: string): string {
  // Normalize and map
  if (pathname === "/" || pathname.startsWith("/overview")) return "Dashboard"
  if (pathname.startsWith("/sensors")) return "Sensors"
  if (pathname.startsWith("/settings")) return "Settings"
  if (pathname.startsWith("/about")) return "About"
  // Fallback: Title-case the first path segment
  const seg = pathname.split("/").filter(Boolean)[0] || "Dashboard"
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

function LeafIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M20.5 3.5c-6.5.6-10.6 3.1-13 5.5C5 11.5 4.2 14 5.9 16.1c1.7 2.1 4.8 2.6 7.1.9 2.4-1.8 4.9-6.1 5.5-13z"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M6 18c3-2.2 5.2-4.1 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
