import React from "react"
import { useLocation } from "react-router-dom"

export default function Topbar() {
  const { pathname } = useLocation()
  const title = getTitle(pathname)
  const [isAtTop, setIsAtTop] = React.useState(true)

  React.useEffect(() => {
    document.title = `${title} · TerraTrak`
  }, [title])

  React.useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY
      setIsAtTop(scrolled < 10)
    }

    handleScroll() // Check initial position
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const quotes = [
    "Compost today, nourish tomorrow.",
    "Healthy soil starts with steady care.",
    "Balance carbon and nitrogen, and the worms will thrive.",
    "Moist, airy, and patient—perfect compost in time.",
    "Feed the bin, and the bin feeds the earth."
  ]
  const q = quotes[new Date().getDate() % quotes.length]

  return (
    <>
      {/* Desktop Topbar - Sticky positioning */}
      <header
        className={[
          "hidden sm:block sticky top-0 z-50",
          "bg-white/20 dark:bg-zinc-900/20",
          "backdrop-blur-xl",
          "border-b border-white/10 dark:border-white/5"
        ].join(" ")}
        style={{ WebkitBackdropFilter: 'blur(24px)' }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg md:text-xl lg:text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {title}
            </h1>
            
            <div
              className="flex items-center gap-2 cursor-default rounded-full px-3 py-1.5 min-w-0
                         bg-white/40 dark:bg-white/10 backdrop-blur-md
                         border border-white/40 dark:border-white/20
                         shadow-[0_4px_12px_rgba(0,0,0,0.08)]
                         transition-all duration-200 ease-out
                         hover:scale-105 hover:shadow-[0_6px_18px_rgba(0,0,0,0.15)]
                         hover:ring-2 hover:ring-emerald-400/40"
              title={q}
              aria-label="Vermicompost tip"
              style={{ WebkitBackdropFilter: 'blur(12px)' }}
            >
              <LeafIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 drop-shadow-sm shrink-0" />
              <span className="hidden md:inline text-emerald-600/40 dark:text-emerald-400/40">•</span>
              <p className="text-xs md:text-sm text-gray-800 dark:text-gray-100 italic truncate">
                {q}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Topbar - Fixed positioning (like mobile sidebar) */}
      <header
        className={[
          "sm:hidden fixed top-0 left-0 right-0 z-50",
          "bg-white/25 dark:bg-zinc-900/35",
          "backdrop-blur-xl",
          "border-b border-white/40 dark:border-white/25",
          "shadow-[0_4px_24px_rgba(0,0,0,0.12)]",
          "transition-all duration-300 ease-out"
        ].join(" ")}
        style={{ WebkitBackdropFilter: 'blur(24px)' }}
      >
        <div className="px-3 py-2.5">
          <h1 className="text-base font-semibold tracking-tight text-gray-900 dark:text-gray-50 text-center">
            {title}
          </h1>
          
          {/* Quote - Only visible at top */}
          <div
            className={[
              "overflow-hidden transition-all duration-300 ease-out",
              isAtTop ? "max-h-20 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"
            ].join(" ")}
          >
            <div
              className="flex items-center justify-center gap-2 rounded-full px-3 py-1.5 mx-auto max-w-fit
                         bg-white/50 dark:bg-white/10 backdrop-blur-md
                         border border-white/50 dark:border-white/25
                         shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
              style={{ WebkitBackdropFilter: 'blur(12px)' }}
            >
              <LeafIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 drop-shadow-sm shrink-0" />
              <p className="text-xs text-gray-800 dark:text-gray-100 italic">
                {q}
              </p>
            </div>
          </div>
        </div>
      </header>
    </>
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
