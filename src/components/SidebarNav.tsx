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
        "relative w-11 h-11 rounded-2xl grid place-items-center",
        "backdrop-blur-xl border border-white/10 transition-all duration-200 ease-out",
        active
          ? "bg-emerald-500/10 border-emerald-400/60 ring-2 ring-emerald-500/30 shadow-emerald-400/20 scale-105"
          : "bg-white/10 dark:bg-white/[0.07] hover:bg-white/[0.18] hover:scale-105",
      ].join(" ")}
    >
      <Icon
        name={icon}
        className={[
          "w-5 h-5 transition-transform duration-150",
          active
            ? "text-emerald-400 scale-110"
            : "text-gray-400 dark:text-gray-300 group-hover:scale-110",
        ].join(" ")}
      />
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
          md:hidden fixed bottom-4 left-1/2 -translate-x-1/2
          flex items-center justify-around gap-3
          w-[92%] max-w-sm rounded-3xl py-2.5 px-4
          bg-white/20 dark:bg-zinc-900/30 backdrop-blur-xl
          border border-white/30 dark:border-white/20
          shadow-[0_8px_30px_rgba(0,0,0,0.2)]
          transition-all duration-300 ease-out
          hover:shadow-[0_10px_40px_rgba(0,0,0,0.25)]
          z-50
        "
        aria-label='Mobile navigation bar'
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

        <div className='ml-1'>
          <ThemeToggle />
        </div>
      </aside>
    </>
  )
}
