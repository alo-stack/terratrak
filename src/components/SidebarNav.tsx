import React from "react"
import { Link, useLocation } from "react-router-dom"
import Icon from "./Icon"
import ThemeToggle from "./ThemeToggle"
import logo from "../assets/logo.png"

type NavKey = "overview" | "sensors" | "settings" | "about"
type Item = {
  key: NavKey
  label: string
  icon: "dashboard" | "gauge" | "cog" | "info"
  to: string
}

const items: Item[] = [
  { key: "overview", label: "Dashboard", icon: "dashboard", to: "/" },
  { key: "sensors", label: "Sensors", icon: "gauge", to: "/sensors" },
  { key: "settings", label: "Settings", icon: "cog", to: "/settings" },
  { key: "about", label: "About", icon: "info", to: "/about" },
]

function RailBtn({
  to,
  label,
  icon,
  active,
}: {
  to: string
  label: string
  icon: Item["icon"]
  active?: boolean
}) {
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={[
        "relative w-11 h-11 rounded-2xl grid place-items-center shrink-0",
        "backdrop-blur-xl border transition-all duration-200 ease-out",
        active
          ? "bg-emerald-500/15 border-emerald-400/70 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-400/20"
          : "bg-white/15 dark:bg-white/[0.08] border-white/20 dark:border-white/15 hover:bg-white/25 dark:hover:bg-white/[0.12] hover:scale-105 active:scale-95",
      ].join(" ")}
    >
      <Icon
        name={icon}
        className={[
          "w-5 h-5 transition-all duration-200 stroke-[1.8]",
          active
            ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]"
            : "text-gray-600 dark:text-gray-300",
        ].join(" ")}
      />
      {active && (
        <div className="absolute inset-0 rounded-2xl bg-emerald-400/5 animate-pulse" />
      )}
    </Link>
  )
}

export default function SidebarNav() {
  const { pathname } = useLocation()
  const active: NavKey =
    pathname.startsWith("/sensors")
      ? "sensors"
      : pathname.startsWith("/settings")
      ? "settings"
      : pathname.startsWith("/about")
      ? "about"
      : "overview"

  return (
    <>
      {/* -------- Desktop Sidebar -------- */}
      <aside
        className="
          hidden md:flex flex-col w-64 shrink-0 px-5 py-6
          bg-[hsl(var(--bg))] border-r border-[hsl(var(--border))]/60 dark:border-white/10
        "
        aria-label='Sidebar'
      >
        <div className="mb-8 flex items-center gap-2 pl-1">
          <img src={logo} alt='TerraTrak' className='w-8 h-8 object-contain' />
          <h2 className='text-lg font-semibold tracking-tight'>TerraTrak</h2>
        </div>

        <nav className='flex flex-col gap-2'>
          {items.map((it) => {
            const selected = it.key === active
            return (
              <Link
                key={it.key}
                to={it.to}
                className={[
                  "sidebar-item group flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40",
                  selected
                    ? "bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm text-emerald-400"
                    : "hover:bg-[hsl(var(--muted))]/60 dark:hover:bg-white/[0.05]",
                ].join(" ")}
                aria-current={selected ? "page" : undefined}
              >
                <Icon
                  name={it.icon}
                  className={[
                    "w-4 h-4 shrink-0",
                    selected
                      ? "text-emerald-400"
                      : "text-gray-500 dark:text-gray-300",
                  ].join(" ")}
                />
                <span
                  className={[
                    "text-sm transition-all duration-200",
                    selected ? "font-semibold" : "font-medium",
                  ].join(" ")}
                >
                  {it.label}
                </span>
              </Link>
            )
          })}

          <div className='mt-3 mb-2 h-px bg-[hsl(var(--border))]/70 dark:bg-white/10' />
          <div className='pl-1 pt-1'>
            <ThemeToggle />
          </div>
        </nav>
      </aside>

      {/* -------- Mobile Sidebar with Glassmorphism -------- */}
      <aside
        className="
          md:hidden fixed bottom-3 left-1/2 -translate-x-1/2
          flex items-center justify-center gap-3
          w-auto rounded-3xl py-2.5 px-3
          bg-white/25 dark:bg-zinc-900/35 backdrop-blur-xl
          border border-white/40 dark:border-white/25
          shadow-[0_8px_32px_rgba(0,0,0,0.25),0_2px_8px_rgba(0,0,0,0.1)]
          transition-all duration-300 ease-out
          hover:shadow-[0_12px_48px_rgba(0,0,0,0.3)]
          z-50
          safe-area-inset-bottom
        "
        aria-label='Mobile navigation bar'
        style={{ WebkitBackdropFilter: 'blur(16px)' }}
      >
        {/* Left and Right Nav Buttons */}
        {items.map((it) => (
          <RailBtn
            key={it.key}
            to={it.to}
            label={it.label}
            icon={it.icon}
            active={it.key === active}
          />
        ))}

        <div className='w-px h-8 bg-white/20 dark:bg-white/15 mx-1' />
        
        <div className='shrink-0'>
          <ThemeToggle />
        </div>
      </aside>
    </>
  )
}
