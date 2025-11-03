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
  { key: "sensors",  label: "Sensors",   icon: "gauge",     to: "/sensors" },
  { key: "settings", label: "Settings",  icon: "cog",       to: "/settings" },
  { key: "about",    label: "About",     icon: "info",      to: "/about" },
]

/* Compact circular icon button for the mobile rail */
function RailBtn({
  to, label, icon, active,
}:{
  to:string; label:string; icon:Item["icon"]; active?:boolean
}) {
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={[
        "relative w-9 h-9 rounded-full grid place-items-center",
        "bg-[hsl(var(--card))]/65 dark:bg-white/5 backdrop-blur",
        "ring-1 ring-[hsl(var(--border))]/70 dark:ring-white/10",
        "transition-colors duration-150 hover:bg-[hsl(var(--muted))]/70 dark:hover:bg-white/[0.08]",
        active ? "ring-emerald-500/50" : ""
      ].join(" ")}
    >
      <Icon
        name={icon}
        className={[
          "w-4 h-4",
          active ? "text-emerald-400" : "text-gray-600 dark:text-gray-300"
        ].join(" ")}
      />
    </Link>
  )
}

export default function SidebarNav() {
  const { pathname } = useLocation()
  const active: NavKey =
    pathname.startsWith("/sensors")  ? "sensors"  :
    pathname.startsWith("/settings") ? "settings" :
    pathname.startsWith("/about")    ? "about"    :
    "overview"

  return (
    <>
      {/* ---------------- Desktop sidebar (normal look) ---------------- */}
      <aside
        className="
          hidden md:flex flex-col w-64 shrink-0
          px-4 py-6 bg-[hsl(var(--bg))]
        "
        aria-label="Sidebar"
      >
        <div className="mb-7 flex items-center pl-1">
          {/* normal logo, not forced circular; slightly smaller for a tidy feel */}
          <img
            src={logo}
            alt="TerraTrak"
            className="w-8 h-8 object-contain"
          />
        </div>

        <nav className="flex flex-col gap-2">
          {items.map((it) => {
            const selected = it.key === active
            return (
              <Link
                key={it.key}
                to={it.to}
                className={[
                  "sidebar-item group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40",
                  selected
                    ? "bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-sm"
                    : "hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.06]"
                ].join(" ")}
                aria-current={selected ? "page" : undefined}
              >
                <Icon
                  name={it.icon}
                  className={[
                    "w-4 h-4 shrink-0 transition-transform duration-150",
                    selected ? "scale-[1.05]" : "group-hover:scale-105"
                  ].join(" ")}
                />
                <span className={selected ? "font-semibold" : "font-medium"}>
                  {it.label}
                </span>
              </Link>
            )
          })}

        <div className="mt-2 mb-1 h-px bg-[hsl(var(--border))] dark:bg-white/10" />
          <div className="pl-1 pt-1">
            <ThemeToggle />
          </div>
        </nav>
      </aside>

      {/* ---------------- Mobile slim vertical rail (small & clean) ---------------- */}
      <aside
        className="
          md:hidden sticky top-0 h-[100dvh] w-12 shrink-0 z-40
          bg-[hsl(var(--bg))]/92 backdrop-blur
          border-r border-[hsl(var(--border))] dark:border-white/10
          flex flex-col items-center justify-between py-2
        "
        aria-label="Mobile sidebar"
      >
        {/* Brand — small, normal logo (no circle crop) */}
        <div className="flex flex-col items-center gap-2">
          <img
            src={logo}
            alt="TerraTrak"
            className="w-7 h-7 object-contain"
          />

          {/* Vertical compact nav */}
          <nav className="mt-1 flex flex-col items-center gap-1.5">
            <RailBtn to="/"         label="Dashboard" icon="dashboard" active={active==="overview"} />
            <RailBtn to="/sensors"  label="Sensors"   icon="gauge"     active={active==="sensors"} />
            <RailBtn to="/settings" label="Settings"  icon="cog"       active={active==="settings"} />
            <RailBtn to="/about"    label="About"     icon="info"      active={active==="about"} />
          </nav>
        </div>

        {/* Single, compact theme toggle at bottom */}
        <div className="pb-1">
          <div className="scale-90 origin-bottom">
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  )
}
