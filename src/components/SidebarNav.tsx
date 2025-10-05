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

export default function SidebarNav() {
  const { pathname } = useLocation()
  const active: NavKey =
    pathname.startsWith("/sensors")  ? "sensors"  :
    pathname.startsWith("/settings") ? "settings" :
    pathname.startsWith("/about")    ? "about"    :
    "overview"

  return (
    <aside
      className="
        hidden md:flex flex-col w-64 shrink-0
        px-4 py-6
        bg-[hsl(var(--bg))]
      "
      aria-label="Sidebar"
    >
      {/* Logo aligned left */}
      <div className="mb-7 flex items-center pl-1">
        <img
          src={logo}
          alt="TerraTrak"
          className="w-10 h-10 object-contain drop-shadow-sm dark:drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]"
        />
      </div>

      {/* Nav list (toggle will go right after About) */}
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

        {/* Divider before the toggle */}
        <div className="mt-2 mb-1 h-px bg-[hsl(var(--border))] dark:bg-white/10" />

        {/* Theme toggle lives directly under About */}
        <div className="pl-1 pt-1">
          <ThemeToggle />
        </div>
      </nav>
    </aside>
  )
}
